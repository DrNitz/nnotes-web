import { useCallback, useEffect, useRef } from 'react';
import type { CanvasItem, Pt, Rect, ShapeItem, StrokeItem, StrokeSample } from '../types/model';
import { uid } from '../types/model';
import { useEditor, assetUrl, type EditorState } from '../store/editor';
import { dist, pointInRect, rectFromPoints } from '../lib/geometry';
import { recognizeShape } from '../lib/shapeRecognition';
import {
  cloneItem, itemCenter, itemContains, makeAudioClip, makeMindMap, makeShape,
  makeSticky, makeTable, makeTape, makeText, scaleItem, selectionHandles, translateItem,
} from '../lib/items';
import { renderScene, itemBounds } from './renderer';
import { pageCache } from './CanvasCache';

interface PointerInfo { x: number; y: number }
type Mode = 'idle' | 'draw' | 'scribble' | 'erase' | 'pan' | 'select' | 'lasso' | 'pinch'
  | 'place-shape' | 'place-rect' | 'move' | 'resize' | 'rotate' | 'ruler';

function localPoint(el: HTMLElement, e: { clientX: number; clientY: number }) {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function toContent(s: EditorState, p: { x: number; y: number }): Pt {
  return [(p.x - s.origin.x) / s.zoom, (p.y - s.origin.y) / s.zoom];
}

function toScreen(s: EditorState, p: Pt) {
  return { x: s.origin.x + p[0] * s.zoom, y: s.origin.y + p[1] * s.zoom };
}

function eraseFragments(stroke: StrokeItem, center: Pt, radius: number): StrokeItem[] {
  const runs: StrokeSample[][] = [];
  let current: StrokeSample[] = [];
  for (const sample of stroke.samples) {
    if (Math.hypot(sample[0] - center[0], sample[1] - center[1]) <= radius) {
      if (current.length) runs.push(current);
      current = [];
    } else current.push(sample);
  }
  if (current.length) runs.push(current);
  return runs.map((samples) => ({ ...stroke, uid: uid(), samples }));
}

const DEFAULT_RECT: Record<string, [number, number]> = {
  sticky_note: [220, 180], table: [320, 200], tape: [280, 52],
  image: [320, 220], audio_clip: [240, 54], mind_map: [1, 1], screenshot: [200, 140],
};

export function CanvasStage({ onRequestImage }: { onRequestImage: (rect: Rect) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef<() => void>(() => {});
  const sizeRef = useRef({ width: 1, height: 1, dpr: 1 });

  const pointers = useRef(new Map<number, PointerInfo>());
  const mode = useRef<Mode>('idle');
  const liveStroke = useRef<StrokeItem | null>(null);
  const fading = useRef<{ stroke: StrokeItem; born: number }[]>([]);
  const liveShape = useRef<ShapeItem | null>(null);
  const liveRect = useRef<Rect | null>(null);
  const liveItems = useRef<CanvasItem[] | null>(null);
  const lastSample = useRef<Pt | null>(null);
  const lastMoveTime = useRef(0);
  const strokeStart = useRef(0);
  const startScreen = useRef({ x: 0, y: 0 });
  const startOrigin = useRef({ x: 0, y: 0 });
  const startContent = useRef<Pt>([0, 0]);
  const pinch = useRef<{ distance: number; zoom: number; center: { x: number; y: number } } | null>(null);
  const eraseSet = useRef(new Set<string>());
  const band = useRef<Pt | null>(null);
  const lasso = useRef<Pt[]>([]);
  const eraserCursor = useRef<{ x: number; y: number; radius: number } | null>(null);
  const activeHandle = useRef<string>('');
  const originals = useRef<Map<string, CanvasItem>>(new Map());
  const startBounds = useRef<Rect>([0, 0, 1, 1]);
  const rotateStart = useRef(0);
  const rulerStart = useRef({ y: 0, angle: 0 });
  /** True once a drag has actually changed pixels, so no-op clicks create no history entry. */
  const dragMoved = useRef(false);

  const requestRender = useCallback(() => requestAnimationFrame(() => renderRef.current()), []);
  const fadeLoop = useRef<() => void>(() => {});

  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const s = useEditor.getState();
      renderScene({
        ctx,
        width: sizeRef.current.width, height: sizeRef.current.height, dpr: sizeRef.current.dpr,
        doc: s.doc, pageIndex: s.pageIndex, zoom: s.zoom, origin: s.origin, theme: s.theme,
        selection: s.selection, overrideItems: liveItems.current,
        ruler: s.ruler, liveShape: liveShape.current,
        liveRect: liveRect.current, liveStroke: liveStroke.current,
        fadingStrokes: fading.current, eraserCursor: eraserCursor.current, assetUrl,
      });
    };
    renderRef.current = render;
    const unsub = useEditor.subscribe(render);
    const resize = () => {
      const el = wrapRef.current, canvas = canvasRef.current;
      if (!el || !canvas) return;
      const r = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { width: r.width, height: r.height, dpr };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      render();
    };
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    // React registers wheel handlers as passive, so preventDefault has to be attached
    // natively or the page scrolls while pinch/wheel zooming.
    const canvas = canvasRef.current;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!canvas) return;
      const p = localPoint(canvas, e);
      const s = useEditor.getState();
      // The store subscription repaints, so no extra frame is requested here.
      s.setZoom(s.zoom * Math.exp(-e.deltaY * (e.ctrlKey || e.metaKey ? 0.01 : 0.0015)), p);
    };
    canvas?.addEventListener('wheel', onWheel, { passive: false });
    const onAssetLoaded = () => { pageCache.clear(); render(); };
    window.addEventListener('nnotes-asset-loaded', onAssetLoaded);
    let fadeRaf = 0;
    fadeLoop.current = () => {
      cancelAnimationFrame(fadeRaf);
      const tick = () => {
        const now = performance.now();
        const had = fading.current.length;
        fading.current = fading.current.filter((f) => now < f.born + 500);
        render();
        if (fading.current.length) fadeRaf = requestAnimationFrame(tick);
        else if (had) fading.current = [];
      };
      fadeRaf = requestAnimationFrame(tick);
    };
    resize();
    return () => {
      unsub(); ro.disconnect(); cancelAnimationFrame(fadeRaf);
      window.removeEventListener('nnotes-asset-loaded', onAssetLoaded);
      canvas?.removeEventListener('wheel', onWheel);
    };
  }, []);

  const content = (p: { x: number; y: number }) => toContent(useEditor.getState(), p);

  /** Project a point onto the ruler band when it is close enough (magnet snapping). */
  const magnetize = (p: Pt): Pt => {
    const s = useEditor.getState();
    if (!s.ruler.visible || s.ruler.locked) return p;
    const screen = toScreen(s, p);
    const a = (-s.ruler.angle * Math.PI) / 180;
    const dx = screen.x - sizeRef.current.width / 2;
    const dy = screen.y - s.ruler.y;
    const ly = -Math.sin(a) * dx + Math.cos(a) * dy;
    if (Math.abs(ly) > 12) return p;
    const lx = Math.cos(a) * dx + Math.sin(a) * dy;
    const sy = s.ruler.y + Math.sin(a) * lx;
    const sx = sizeRef.current.width / 2 + Math.cos(a) * lx;
    return [(sx - s.origin.x) / s.zoom, (sy - s.origin.y) / s.zoom];
  };

  const copyScreenshot = async (rect: Rect) => {
    const src = canvasRef.current;
    if (!src) return;
    const s = useEditor.getState();
    const dpr = sizeRef.current.dpr;
    const x = (s.origin.x + rect[0] * s.zoom) * dpr;
    const y = (s.origin.y + rect[1] * s.zoom) * dpr;
    const w = Math.max(1, rect[2] * s.zoom * dpr);
    const h = Math.max(1, rect[3] * s.zoom * dpr);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    out.getContext('2d')!.drawImage(src, x, y, w, h, 0, 0, w, h);
    const blob = await new Promise<Blob>((resolve) => out.toBlob((b) => resolve(b!), 'image/png'));
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      window.dispatchEvent(new CustomEvent('nnotes-toast', { detail: 'Screenshot copied to clipboard' }));
    } catch {
      window.dispatchEvent(new CustomEvent('nnotes-toast', { detail: 'Clipboard unavailable — screenshot blocked by browser' }));
    }
  };

  /** Eraser radius in page-content units (constant on screen when `scale === false`). */
  const eraserRadius = (s: EditorState) => {
    const cfg = s.configFor('eraser');
    return cfg.scale === false ? cfg.base_width / s.zoom : cfg.base_width;
  };

  const applyErase = (c: Pt, radiusOverride?: number): boolean => {
    const s = useEditor.getState();
    const source = liveItems.current ?? s.doc.pages[s.pageIndex]?.items;
    if (!source) return false;
    const cfg = s.configFor('eraser');
    const radius = radiusOverride ?? eraserRadius(s);
    const eraseMode = cfg.erase_mode ?? 'area';
    const items: CanvasItem[] = [];
    let changed = false;
    for (const item of source) {
      if (eraseSet.current.has(item.uid)) continue;
      if (item.kind === 'stroke') {
        const near = item.samples.some((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) <= radius + item.config.base_width / 2);
        if (!near) { items.push(item); continue; }
        changed = true;
        if (eraseMode === 'stroke') { eraseSet.current.add(item.uid); continue; }
        items.push(...eraseFragments(item, c, radius));
      } else {
        const b = itemBounds(item);
        if (b && pointInRect(c, b)) { eraseSet.current.add(item.uid); changed = true; }
        else items.push(item);
      }
    }
    if (changed) liveItems.current = items;
    return changed;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2) return;
    const el = canvasRef.current!;
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
    dragMoved.current = false;
    const p = localPoint(el, e);
    pointers.current.set(e.pointerId, p);
    const s = useEditor.getState();

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: dist([a.x, a.y], [b.x, b.y]), zoom: s.zoom, center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      mode.current = 'pinch';
      liveStroke.current = null;
      return;
    }
    if (pointers.current.size > 2) return;

    startScreen.current = p;
    startOrigin.current = { ...s.origin };
    const c = content(p);
    startContent.current = c;
    lastMoveTime.current = performance.now();

    // Ruler drag: grab near the band in screen space.
    if (s.ruler.visible) {
      const a = (-s.ruler.angle * Math.PI) / 180;
      const dx = p.x - sizeRef.current.width / 2;
      const dy = p.y - s.ruler.y;
      const ly = -Math.sin(a) * dx + Math.cos(a) * dy;
      if (Math.abs(ly) < 26) {
        mode.current = 'ruler';
        rulerStart.current = { y: s.ruler.y, angle: s.ruler.angle };
        return;
      }
    }

    if (e.button === 1 || s.tool === 'pan') { mode.current = 'pan'; return; }

    if (s.tool === 'eraser') {
      mode.current = 'erase';
      liveItems.current = structuredClone(s.doc.pages[s.pageIndex]?.items ?? []);
      eraseSet.current = new Set();
      eraserCursor.current = { x: c[0], y: c[1], radius: eraserRadius(s) };
      dragMoved.current = applyErase(c);
      return;
    }

    if (s.tool === 'select') {
      const page = s.doc.pages[s.pageIndex];
      if (s.selection.length) {
        const sel = page?.items.filter((it) => s.selection.includes(it.uid)) ?? [];
        const bounds = sel.map((it) => itemBounds(it)).filter((b): b is Rect => !!b);
        if (bounds.length) {
          const x = Math.min(...bounds.map((b) => b[0])), y = Math.min(...bounds.map((b) => b[1]));
          const r = Math.max(...bounds.map((b) => b[0] + b[2])), bot = Math.max(...bounds.map((b) => b[1] + b[3]));
          const rect: Rect = [x, y, r - x, bot - y];
          const handle = selectionHandles(rect).find((h) => {
            const sp = toScreen(s, h.p);
            return dist([sp.x, sp.y], [p.x, p.y]) < 12 / Math.max(0.4, s.zoom);
          });
          if (handle) {
            activeHandle.current = handle.id;
            startBounds.current = rect;
            originals.current = new Map(sel.map((it) => [it.uid, cloneItem(it, false)]));
            liveItems.current = structuredClone(page?.items ?? []);
            mode.current = handle.id === 'rotate' ? 'rotate' : 'resize';
            if (mode.current === 'rotate') rotateStart.current = Math.atan2(p.y - toScreen(s, itemCenter(sel[0])).y, p.x - toScreen(s, itemCenter(sel[0])).x);
            return;
          }
        }
      }
      const hit = page?.items.filter((it) => itemContains(it, c, s.zoom)).pop();
      if (hit) {
        if (hit.kind === 'audio_clip' && hit.audio_asset) {
          const url = assetUrl(hit.audio_asset);
          if (url) void new Audio(url).play().catch(() => {});
        }
        s.setSelection(s.selection.includes(hit.uid) ? s.selection : [hit.uid]);
        originals.current = new Map(page!.items.filter((it) => s.selection.includes(it.uid) || it.uid === hit.uid).map((it) => [it.uid, cloneItem(it, false)]));
        liveItems.current = structuredClone(page!.items);
        mode.current = 'move';
      } else {
        s.setSelection([]);
        mode.current = 'select';
        band.current = c;
      }
      return;
    }

    if (s.tool === 'lasso') {
      s.setSelection([]);
      lasso.current = [c];
      mode.current = 'lasso';
      return;
    }

    if (s.tool === 'shape') {
      liveShape.current = makeShape(s.shapeKind, c, c, s.ink);
      mode.current = 'place-shape';
      return;
    }

    if (['text', 'sticky_note', 'table', 'tape', 'image', 'mind_map', 'audio_clip', 'screenshot'].includes(s.tool)) {
      const [dw, dh] = DEFAULT_RECT[s.tool] ?? [200, 120];
      liveRect.current = [c[0], c[1], dw, dh];
      startContent.current = c;
      mode.current = 'place-rect';
      return;
    }

    if (['pen', 'pencil', 'dashed', 'calligraphy', 'speed', 'taper', 'highlighter', 'tape', 'magic'].includes(s.tool)) {
      if (s.scribbleToErase && s.tool !== 'highlighter') {
        mode.current = 'scribble';
        liveItems.current = structuredClone(s.doc.pages[s.pageIndex]?.items ?? []);
        eraseSet.current = new Set();
        dragMoved.current = applyErase(c, 8 / s.zoom);
        return;
      }
      const config = structuredClone(s.configFor(s.tool as never));
      if (s.tool === 'magic') { config.base_width = 14; config.pressure_enabled = false; config.rgba = [...s.ink]; }
      const pressure = e.pointerType === 'mouse' ? 0.72 : Math.max(0.05, e.pressure || 0.5);
      const sample: StrokeSample = [...magnetize(c), pressure, 0];
      liveStroke.current = {
        uid: uid(), kind: 'stroke', tool: s.tool as StrokeItem['tool'], config,
        samples: [sample], speed_scale: s.zoom / (window.devicePixelRatio || 1),
        straight: !!config.straight_line,
      };
      lastSample.current = c;
      strokeStart.current = performance.now();
      mode.current = 'draw';
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = canvasRef.current!;
    const p = localPoint(el, e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
    const s = useEditor.getState();

    if (mode.current === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = dist([a.x, a.y], [b.x, b.y]);
      const start = pinch.current;
      if (start && start.distance > 1) s.setZoom(start.zoom * (d / start.distance), start.center);
      return;
    }
    if (mode.current === 'pan') {
      s.setOrigin({ x: startOrigin.current.x + (p.x - startScreen.current.x), y: startOrigin.current.y + (p.y - startScreen.current.y) });
      return;
    }
    if (mode.current === 'ruler') {
      s.setRuler({
        y: rulerStart.current.y + (p.y - startScreen.current.y),
        ...(s.ruler.locked ? {} : { angle: rulerStart.current.angle + (p.x - startScreen.current.x) * 0.3 }),
      });
      return;
    }

    const cRaw = content(p);
    const c = magnetize(cRaw);

    if (mode.current === 'draw' && liveStroke.current) {
      lastMoveTime.current = performance.now();
      const minDistance = 1 / s.zoom;
      if (lastSample.current && dist(lastSample.current, cRaw) < minDistance) return;
      const pressure = e.pointerType === 'mouse' ? 0.72 : Math.max(0.05, e.pressure || 0.5);
      liveStroke.current.samples.push([c[0], c[1], pressure, performance.now() - strokeStart.current]);
      lastSample.current = cRaw;
      return;
    }
    if (mode.current === 'scribble') {
      dragMoved.current = applyErase(c, 8 / s.zoom) || dragMoved.current;
      return;
    }
    if (mode.current === 'erase') {
      eraserCursor.current = { x: c[0], y: c[1], radius: eraserRadius(s) };
      dragMoved.current = applyErase(c) || dragMoved.current;
      return;
    }
    if (mode.current === 'place-shape' && liveShape.current) {
      liveShape.current.end = c;
      if (liveShape.current.shape === 'line' || liveShape.current.shape === 'arrow') {
        const snap = Math.abs(c[1] - startContent.current[1]) < 8 / s.zoom;
        liveShape.current.end = snap ? [c[0], startContent.current[1]] : c;
      }
      return;
    }
    if (mode.current === 'place-rect' && liveRect.current) {
      liveRect.current = rectFromPoints(startContent.current, c);
      return;
    }
    if (mode.current === 'move') {
      const dx = c[0] - startContent.current[0], dy = c[1] - startContent.current[1];
      if (dx || dy) dragMoved.current = true;
      const page = s.doc.pages[s.pageIndex];
      if (!page) return;
      const items = (liveItems.current ?? page.items).map((it) => {
        const original = originals.current.get(it.uid);
        if (!original) return it;
        const copy = cloneItem(original, false);
        translateItem(copy, dx, dy);
        return copy;
      });
      liveItems.current = items;
      return;
    }
    if (mode.current === 'resize') {
      dragMoved.current = true;
      const [x, y, w, h] = startBounds.current;
      const anchor: Pt = [x + w / 2, y + h / 2];
      const sx = Math.max(0.05, activeHandle.current.includes('l') ? (x + w - c[0]) / w : activeHandle.current.includes('r') ? (c[0] - x) / w : 1);
      const sy = Math.max(0.05, activeHandle.current.includes('t') ? (y + h - c[1]) / h : activeHandle.current.includes('b') ? (c[1] - y) / h : 1);
      void anchor;
      const page = s.doc.pages[s.pageIndex];
      if (!page) return;
      const items = (liveItems.current ?? page.items).map((it) => {
        const original = originals.current.get(it.uid);
        if (!original) return it;
        const copy = cloneItem(original, false);
        scaleItem(copy, sx, sy, [x, y]);
        return copy;
      });
      liveItems.current = items;
      return;
    }
    if (mode.current === 'rotate') {
      dragMoved.current = true;
      const page = s.doc.pages[s.pageIndex];
      if (!page || !originals.current.size) return;
      const center = toScreen(s, itemCenter([...originals.current.values()][0]));
      const angle = Math.atan2(p.y - center.y, p.x - center.x);
      const delta = ((angle - rotateStart.current) * 180) / Math.PI;
      const items = (liveItems.current ?? page.items).map((it) => {
        const original = originals.current.get(it.uid);
        if (!original) return it;
        const copy = cloneItem(original, false);
        copy.rotation = (original.rotation ?? 0) + delta;
        return copy;
      });
      liveItems.current = items;
      return;
    }
    if (mode.current === 'select' || mode.current === 'lasso') {
      if (mode.current === 'lasso') lasso.current.push(c);
      band.current = c;
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    pointers.current.delete(e.pointerId);
    const s = useEditor.getState();
    const p = localPoint(canvasRef.current!, e);
    const c = content(p);

    // One history entry per drag — no structuredClone on every pointer move, and no
    // entry at all when the drag did not change anything.
    if (dragMoved.current && liveItems.current && ['erase', 'scribble', 'move', 'resize', 'rotate'].includes(mode.current)) {
      const items = liveItems.current;
      const label = mode.current === 'move' ? 'Move'
        : mode.current === 'resize' ? 'Resize'
          : mode.current === 'rotate' ? 'Rotate' : 'Erase';
      const idx = s.pageIndex;
      s.commit(label, (pages) => { if (pages[idx]) pages[idx].items = items; });
      liveItems.current = null;
    }

    if (mode.current === 'draw' && liveStroke.current) {
      const stroke = liveStroke.current;
      const last = stroke.samples[stroke.samples.length - 1];
      if (dist([last[0], last[1]], c) > 0.5) stroke.samples.push([c[0], c[1], last[2], performance.now() - strokeStart.current]);

      if (s.tool === 'magic') {
        fading.current.push({ stroke, born: performance.now() + 1000 });
        fadeLoop.current();
        liveStroke.current = null;
        lastSample.current = null;
        return;
      }
      // Hold-to-snap: a stationary pause before lifting converts the ink to a perfect shape.
      const arc = stroke.samples.reduce((sum, sm, i) => i ? sum + dist([stroke.samples[i - 1][0], stroke.samples[i - 1][1]], [sm[0], sm[1]]) : 0, 0);
      if (performance.now() - lastMoveTime.current > 650 && arc > 40 && stroke.tool !== 'highlighter') {
        const recognized = recognizeShape(stroke.samples.map((sm) => [sm[0], sm[1]] as Pt));
        if (recognized) {
          s.addItem(makeShape(recognized.kind, recognized.start, recognized.end, stroke.config.rgba, null, recognized.vertices), 'Snap shape');
        } else s.addItem(stroke, 'Draw');
      } else s.addItem(stroke, 'Draw');
      liveStroke.current = null;
      lastSample.current = null;
    } else if (mode.current === 'place-shape' && liveShape.current) {
      const shape = liveShape.current;
      if (dist(shape.start, shape.end) > 4 / s.zoom) s.addItem(shape, 'Add shape');
      liveShape.current = null;
      s.setTool('select');
    } else if (mode.current === 'place-rect' && liveRect.current) {
      const r = liveRect.current;
      const rect: Rect = dist([r[0], r[1]], c) > 6 / s.zoom ? r : [startContent.current[0], startContent.current[1], r[2], r[3]];
      if (s.tool === 'screenshot') { void copyScreenshot(rect); liveRect.current = null; return; }
      switch (s.tool) {
        case 'text': {
          const item = makeText([rect[0], rect[1]]);
          s.addItem(item, 'Add text');
          s.setEditingUid(item.uid);
          break;
        }
        case 'sticky_note': {
          const item = makeSticky(rect);
          item.style = s.stickyStyle;
          s.addItem(item, 'Add sticky note');
          s.setEditingUid(item.uid);
          break;
        }
        case 'table': {
          const item = makeTable(rect, s.tableRows, s.tableCols);
          s.addItem(item, 'Add table');
          s.setEditingUid(item.uid);
          break;
        }
        case 'tape': {
          const item = makeTape(rect);
          item.pattern = s.tapePattern;
          s.addItem(item, 'Add tape');
          break;
        }
        case 'image':
          onRequestImage(rect);
          break;
        case 'mind_map':
          s.addItem(makeMindMap([rect[0], rect[1]]), 'Add mind map');
          break;
        case 'audio_clip':
          s.addItem(makeAudioClip(rect), 'Add audio clip');
          break;
      }
      liveRect.current = null;
      // Return to Select after placing an object, like the app's "switch back" behaviour.
      s.setTool('select');
    } else if (mode.current === 'select' && band.current) {
      const rect = rectFromPoints(startContent.current, band.current);
      const page = s.doc.pages[s.pageIndex];
      const ids = page?.items.filter((it) => {
        const b = itemBounds(it);
        return b && !(b[0] + b[2] < rect[0] || rect[0] + rect[2] < b[0] || b[1] + b[3] < rect[1] || rect[1] + rect[3] < b[1]);
      }).map((it) => it.uid) ?? [];
      s.setSelection(ids);
      band.current = null;
    } else if (mode.current === 'lasso' && lasso.current.length > 2) {
      const page = s.doc.pages[s.pageIndex];
      const poly = lasso.current;
      const ids = page?.items.filter((it) => {
        const b = itemBounds(it);
        if (!b) return false;
        const center = itemCenter(it);
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i], [xj, yj] = poly[j];
          if (yi > center[1] !== yj > center[1] && center[0] < ((xj - xi) * (center[1] - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      }).map((it) => it.uid) ?? [];
      s.setSelection(ids);
      lasso.current = [];
    }

    eraserCursor.current = null;
    liveItems.current = null;
    if (pointers.current.size < 2) { pinch.current = null; mode.current = 'idle'; }
  };

  // Avoid redrawing on every hover — only when a tool is actively modifying the canvas.
  const withRender = (fn: (e: React.PointerEvent<HTMLCanvasElement>) => void) =>
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const wasActive = mode.current !== 'idle';
      fn(e);
      if (wasActive || mode.current !== 'idle') requestRender();
    };

  const tool = useEditor((s) => s.tool);
  return (
    <div ref={wrapRef} className="canvas-wrap" data-tool={tool}>
      <canvas
        ref={canvasRef}
        className="canvas-surface"
        onPointerDown={withRender(onPointerDown)}
        onPointerMove={withRender(onPointerMove)}
        onPointerUp={withRender(onPointerUp)}
        onPointerCancel={withRender(onPointerUp)}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
