import { useCallback, useEffect, useRef } from 'react';
import type { CanvasItem, StrokeItem, StrokeSample } from '../types/model';
import { uid } from '../types/model';
import { useEditor, assetUrl } from '../store/editor';
import { dist, pointInRect, rectFromPoints } from '../lib/geometry';
import { renderScene, itemBounds } from './renderer';

interface PointerInfo { x: number; y: number }
type Mode = 'idle' | 'draw' | 'erase' | 'pan' | 'select' | 'lasso' | 'pinch';

function localPoint(el: HTMLElement, e: { clientX: number; clientY: number }) {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function toContent(s: useEditorStateShape, p: { x: number; y: number }): [number, number] {
  return [(p.x - s.origin.x) / s.zoom, (p.y - s.origin.y) / s.zoom];
}

type useEditorStateShape = ReturnType<typeof useEditor.getState>;

function eraseFragments(stroke: StrokeItem, center: [number, number], radius: number): StrokeItem[] {
  const runs: StrokeSample[][] = [];
  let current: StrokeSample[] = [];
  for (const sample of stroke.samples) {
    if (Math.hypot(sample[0] - center[0], sample[1] - center[1]) <= radius) {
      if (current.length) runs.push(current);
      current = [];
    } else {
      current.push(sample);
    }
  }
  if (current.length) runs.push(current);
  return runs.map((samples) => ({ ...stroke, uid: uid(), samples }));
}

function hitItem(item: CanvasItem, p: [number, number], zoom: number): boolean {
  if (item.kind === 'stroke') {
    const r = 10 / zoom;
    return item.samples.some((s) => Math.hypot(s[0] - p[0], s[1] - p[1]) <= r + (item.config.base_width / 2));
  }
  const b = itemBounds(item);
  return b ? pointInRect(p, b) : false;
}

export function CanvasStage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef<() => void>(() => {});
  const sizeRef = useRef({ width: 1, height: 1, dpr: 1 });

  const pointers = useRef(new Map<number, PointerInfo>());
  const mode = useRef<Mode>('idle');
  const liveStroke = useRef<StrokeItem | null>(null);
  const lastSample = useRef<[number, number] | null>(null);
  const strokeStart = useRef(0);
  const startScreen = useRef({ x: 0, y: 0 });
  const startOrigin = useRef({ x: 0, y: 0 });
  const pinch = useRef<{ distance: number; zoom: number; center: { x: number; y: number } } | null>(null);
  const eraseSet = useRef(new Set<string>());
  const band = useRef<[number, number] | null>(null);
  const lasso = useRef<[number, number][]>([]);
  const eraserCursor = useRef<{ x: number; y: number; radius: number } | null>(null);

  const requestRender = useCallback(() => {
    requestAnimationFrame(() => renderRef.current());
  }, []);

  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const s = useEditor.getState();
      renderScene({
        ctx,
        width: sizeRef.current.width,
        height: sizeRef.current.height,
        dpr: sizeRef.current.dpr,
        doc: s.doc,
        pageIndex: s.pageIndex,
        zoom: s.zoom,
        origin: s.origin,
        theme: s.theme,
        selection: s.selection,
        liveStroke: liveStroke.current,
        eraserCursor: eraserCursor.current,
        assetUrl,
      });
    };
    renderRef.current = render;
    const unsub = useEditor.subscribe(render);

    const resize = () => {
      const el = wrapRef.current;
      const canvas = canvasRef.current;
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
    resize();
    return () => { unsub(); ro.disconnect(); };
  }, []);

  const screenToContent = (p: { x: number; y: number }): [number, number] => toContent(useEditor.getState(), p);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = canvasRef.current!;
    el.setPointerCapture(e.pointerId);
    const p = localPoint(el, e);
    pointers.current.set(e.pointerId, p);
    const s = useEditor.getState();

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: dist([a.x, a.y], [b.x, b.y]), zoom: s.zoom, center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      mode.current = 'pinch';
      liveStroke.current = null;
      requestRender();
      return;
    }
    if (pointers.current.size > 2) return;

    startScreen.current = p;
    startOrigin.current = { ...s.origin };
    const c = screenToContent(p);

    if (e.button === 1 || s.tool === 'pan') {
      mode.current = 'pan';
      return;
    }
    if (s.tool === 'eraser') {
      mode.current = 'erase';
      eraseSet.current = new Set();
      eraserCursor.current = { x: c[0], y: c[1], radius: s.configFor('eraser').base_width / (s.configFor('eraser').scale === false ? s.zoom : 1) };
      applyErase(c);
      return;
    }
    if (s.tool === 'select' || s.tool === 'lasso') {
      const page = s.doc.pages[s.pageIndex];
      const hit = page?.items.map((it) => ({ it, ok: hitItem(it, c, s.zoom) })).filter((x) => x.ok).pop();
      if (hit) {
        s.setSelection([hit.it.uid]);
        mode.current = 'idle';
      } else {
        s.setSelection([]);
        mode.current = s.tool === 'lasso' ? 'lasso' : 'select';
        band.current = c;
        lasso.current = [c];
      }
      requestRender();
      return;
    }
    if (['pen', 'pencil', 'dashed', 'calligraphy', 'speed', 'taper', 'highlighter', 'tape'].includes(s.tool)) {
      const config = structuredClone(s.configFor(s.tool as never));
      const pressure = e.pointerType === 'mouse' ? 0.72 : Math.max(0.05, e.pressure || 0.5);
      const sample: StrokeSample = [c[0], c[1], pressure, 0];
      liveStroke.current = {
        uid: uid(),
        kind: 'stroke',
        tool: s.tool === 'tape' ? 'highlighter' : s.tool as StrokeItem['tool'],
        config,
        samples: [sample],
        speed_scale: s.zoom / (window.devicePixelRatio || 1),
        straight: !!config.straight_line,
      };
      lastSample.current = c;
      strokeStart.current = performance.now();
      mode.current = 'draw';
      requestRender();
    }
  };

  const applyErase = (c: [number, number]) => {
    const s = useEditor.getState();
    const page = s.doc.pages[s.pageIndex];
    if (!page) return;
    const cfg = s.configFor('eraser');
    const radius = cfg.base_width / (cfg.scale === false ? s.zoom : 1);
    const modeErase = cfg.erase_mode ?? 'area';
    const items: CanvasItem[] = [];
    let changed = false;
    for (const item of page.items) {
      if (eraseSet.current.has(item.uid)) continue;
      if (item.kind === 'stroke') {
        const near = item.samples.some((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) <= radius + item.config.base_width / 2);
        if (!near) { items.push(item); continue; }
        changed = true;
        if (modeErase === 'stroke') { eraseSet.current.add(item.uid); continue; }
        items.push(...eraseFragments(item, c, radius));
      } else if (item.kind !== 'image' && itemBounds(item) && pointInRect(c, itemBounds(item)!)) {
        eraseSet.current.add(item.uid);
        changed = true;
      } else {
        items.push(item);
      }
    }
    if (changed) s.replacePageItems(items, 'Erase');
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
      if (start && start.distance > 1) {
        s.setZoom(start.zoom * (d / start.distance), start.center);
      }
      requestRender();
      return;
    }
    if (mode.current === 'pan') {
      s.setOrigin({ x: startOrigin.current.x + (p.x - startScreen.current.x), y: startOrigin.current.y + (p.y - startScreen.current.y) });
      requestRender();
      return;
    }
    const c = screenToContent(p);

    if (mode.current === 'draw' && liveStroke.current) {
      const minDistance = 1 / s.zoom;
      if (lastSample.current && dist(lastSample.current, c) < minDistance) return;
      const t = performance.now() - strokeStart.current;
      const pressure = e.pointerType === 'mouse' ? 0.72 : Math.max(0.05, e.pressure || 0.5);
      liveStroke.current.samples.push([c[0], c[1], pressure, t]);
      lastSample.current = c;
      requestRender();
      return;
    }
    if (mode.current === 'erase') {
      eraserCursor.current = { x: c[0], y: c[1], radius: s.configFor('eraser').base_width };
      applyErase(c);
      requestRender();
      return;
    }
    if (mode.current === 'select' || mode.current === 'lasso') {
      if (mode.current === 'lasso') lasso.current.push(c);
      band.current = c;
      requestRender();
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    canvasRef.current?.releasePointerCapture(e.pointerId);
    pointers.current.delete(e.pointerId);
    const s = useEditor.getState();

    if (mode.current === 'draw' && liveStroke.current) {
      const stroke = liveStroke.current;
      const c = screenToContent(localPoint(canvasRef.current!, e));
      const last = stroke.samples[stroke.samples.length - 1];
      if (dist([last[0], last[1]], c) > 0.5) {
        stroke.samples.push([c[0], c[1], last[2], performance.now() - strokeStart.current]);
      }
      s.addItem(stroke, 'Draw');
      liveStroke.current = null;
      lastSample.current = null;
    } else if (mode.current === 'select' && band.current) {
      const start = screenToContent(startScreen.current);
      const rect = rectFromPoints(start, band.current);
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
        const center: [number, number] = [b[0] + b[2] / 2, b[1] + b[3] / 2];
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

    if (pointers.current.size < 2) { pinch.current = null; mode.current = 'idle'; }
    eraserCursor.current = null;
    requestRender();
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const p = localPoint(canvasRef.current!, e);
    const s = useEditor.getState();
    if (e.ctrlKey || e.metaKey) s.setZoom(s.zoom * Math.exp(-e.deltaY * 0.01), p);
    else s.setZoom(s.zoom * Math.exp(-e.deltaY * 0.0015), p);
    requestRender();
  };

  const tool = useEditor((s) => s.tool);
  return (
    <div ref={wrapRef} className="canvas-wrap" data-tool={tool}>
      <canvas
        ref={canvasRef}
        className="canvas-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
