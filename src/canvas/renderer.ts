/**
 * Immediate-mode canvas renderer, mirroring Nnotes' layered onDraw pipeline:
 * paper → ruling/background → ink → MULTIPLY highlighter pass → overlay.
 */
import type {
  CanvasItem, NNoteDocument, PageStyle, Pt, Rect, ShapeItem,
  StrokeItem, TableItem, TapeItem, StickyNoteItem, MindMapItem, MindMapNode,
  GroupItem, ImageItem, AudioClipItem, TextItem,
} from '../types/model';
import { DEFAULT_STYLE } from '../types/model';
import { buildStrokeGeometry, centerlinePath, strokePath, type StrokeGeometry } from '../lib/ink';
import { rgbaCss } from '../lib/geometry';
import type { ThemeMode } from '../store/editor';

const SELECTION = '#38bdf8';

export const PALETTES: Record<ThemeMode, { bg: string; paper: string; border: string; text: string; dim: string; panel: string }> = {
  dark: { bg: '#121316', paper: '#1a1b20', border: '#30333d', text: '#e9eaee', dim: '#9aa0ad', panel: '#1e2028' },
  light: { bg: '#dfe2e8', paper: '#ffffff', border: '#cbd0da', text: '#20242c', dim: '#6b7280', panel: '#ffffff' },
  oled: { bg: '#000000', paper: '#080808', border: '#222222', text: '#e9eaee', dim: '#8a8a8a', panel: '#0c0c0c' },
};

export interface RenderInput {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  doc: NNoteDocument;
  pageIndex: number;
  zoom: number;
  origin: { x: number; y: number };
  theme: ThemeMode;
  selection: string[];
  boardMode?: boolean;
  ruler?: { visible: boolean; y: number; angle: number; locked: boolean };
  liveShape?: ShapeItem | null;
  liveRect?: Rect | null;
  liveStroke?: StrokeItem | null;
  fadingStrokes?: { stroke: StrokeItem; born: number }[];
  eraserCursor?: { x: number; y: number; radius: number } | null;
  assetUrl: (name: string) => string | undefined;
}

const geomCache = new WeakMap<StrokeItem, StrokeGeometry>();
const imageCache = new Map<string, HTMLImageElement>();

function cachedImage(url: string): HTMLImageElement | null {
  let img = imageCache.get(url);
  if (!img) {
    img = new Image();
    img.onload = () => window.dispatchEvent(new Event('nnotes-asset-loaded'));
    img.src = url;
    imageCache.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

function geometryOf(item: StrokeItem, live: boolean): StrokeGeometry {
  if (live) return buildStrokeGeometry(item.samples, item.config, {
    speedScale: item.speed_scale,
    holdEnds: item.tool === 'pen' || item.tool === 'highlighter',
    finished: false,
  });
  let g = geomCache.get(item);
  if (!g) {
    g = buildStrokeGeometry(item.samples, item.config, {
      speedScale: item.speed_scale,
      holdEnds: item.tool === 'pen' || item.tool === 'highlighter',
      finished: true,
    });
    geomCache.set(item, g);
  }
  return g;
}

function resolveStyle(doc: NNoteDocument, pageStyle?: PageStyle): Required<PageStyle> {
  return {
    page_color: pageStyle?.page_color ?? doc.style.page_color ?? DEFAULT_STYLE.page_color,
    pattern: pageStyle?.pattern ?? doc.style.pattern ?? DEFAULT_STYLE.pattern,
    pattern_color: pageStyle?.pattern_color ?? doc.style.pattern_color ?? DEFAULT_STYLE.pattern_color,
    spacing: pageStyle?.spacing ?? doc.style.spacing ?? DEFAULT_STYLE.spacing,
  };
}

function drawRuling(ctx: CanvasRenderingContext2D, w: number, h: number, style: Required<PageStyle>) {
  if (style.pattern === 'none') return;
  const s = style.spacing;
  ctx.save();
  ctx.strokeStyle = rgbaCss(style.pattern_color);
  ctx.fillStyle = rgbaCss(style.pattern_color);
  ctx.lineWidth = 1;

  if (style.pattern === 'lines' || style.pattern === 'cornell' || style.pattern === 'planner') {
    for (let y = s; y < h; y += s) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    if (style.pattern === 'cornell') {
      ctx.beginPath(); ctx.moveTo(w * 0.28, 0); ctx.lineTo(w * 0.28, h); ctx.stroke();
      for (let y = s * 2; y < h; y += s * 2) {
        ctx.beginPath(); ctx.moveTo(w * 0.28, y); ctx.lineTo(w, y); ctx.stroke();
      }
    }
    if (style.pattern === 'planner') {
      ctx.beginPath(); ctx.moveTo(w * 0.32, 0); ctx.lineTo(w * 0.32, h); ctx.stroke();
    }
  } else if (style.pattern === 'grid' || style.pattern === 'engineering' || style.pattern === 'isometric') {
    for (let x = s; x < w; x += s) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = s; y < h; y += s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    if (style.pattern === 'engineering') {
      for (let x = 0; x < w; x += s * 5) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += s * 5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }
  } else if (style.pattern === 'dots') {
    for (let x = s; x < w; x += s) for (let y = s; y < h; y += s) {
      ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
    }
  } else if (style.pattern === 'hex') {
    const r = s / 2;
    const dx = r * 1.5;
    const dy = r * Math.sqrt(3);
    for (let col = 0, x = 0; x < w + dx; col++, x = col * dx) {
      for (let row = 0, y = (col % 2) * dy / 2; y < h + dy; row++, y = row * dy + (col % 2) * dy / 2) {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k;
          const px = x + Math.cos(a) * r;
          const py = y + Math.sin(a) * r;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.stroke();
      }
    }
  } else if (style.pattern === 'music') {
    for (let y = s; y < h; y += s * 1.6) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      for (let x = s; x < w; x += s * 1.6) { ctx.beginPath(); ctx.arc(x, y - s * 0.4, 2, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  ctx.restore();
}

function drawStroke(ctx: CanvasRenderingContext2D, item: StrokeItem, live: boolean) {
  const c = item.config;
  const g = geometryOf(item, live);
  const color = c.rgba;
  ctx.save();
  if (item.tool === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = c.highlighter_alpha;
  }
  if (c.neon && item.tool !== 'highlighter') {
    ctx.shadowColor = rgbaCss(color, 0.9);
    ctx.shadowBlur = (6 + c.neon_strength * 18) * Math.max(1, g.halfWidths[0] ?? 1) / 3;
  }
  if (item.tool === 'dashed') {
    ctx.strokeStyle = rgbaCss(color);
    ctx.lineWidth = c.base_width;
    ctx.lineCap = 'round';
    ctx.setLineDash([c.dash_length, c.dash_gap]);
    ctx.stroke(centerlinePath(g));
  } else if (item.tool === 'pencil') {
    ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.78;
    ctx.fillStyle = rgbaCss(color);
    ctx.fill(strokePath(g));
  } else {
    ctx.fillStyle = rgbaCss(color);
    ctx.fill(strokePath(g));
  }
  ctx.restore();
}

function polygonPath(pts: Pt[], closed: boolean): Path2D {
  const path = new Path2D();
  if (!pts.length) return path;
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
  if (closed) path.closePath();
  return path;
}

function boxPoints(item: ShapeItem, count: number, rotation = -Math.PI / 2): Pt[] {
  const cx = (item.start[0] + item.end[0]) / 2;
  const cy = (item.start[1] + item.end[1]) / 2;
  const rx = Math.abs(item.end[0] - item.start[0]) / 2;
  const ry = Math.abs(item.end[1] - item.start[1]) / 2;
  return Array.from({ length: count }, (_, i) => {
    const a = rotation + (i * Math.PI * 2) / count;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt;
  });
}

function starPoints(item: ShapeItem, points = 5): Pt[] {
  const cx = (item.start[0] + item.end[0]) / 2;
  const cy = (item.start[1] + item.end[1]) / 2;
  const rx = Math.abs(item.end[0] - item.start[0]) / 2;
  const ry = Math.abs(item.end[1] - item.start[1]) / 2;
  const out: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const k = i % 2 === 0 ? 1 : 0.42;
    out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return out;
}

function heartPath(item: ShapeItem): Path2D {
  const x = Math.min(item.start[0], item.end[0]);
  const y = Math.min(item.start[1], item.end[1]);
  const w = Math.abs(item.end[0] - item.start[0]);
  const h = Math.abs(item.end[1] - item.start[1]);
  const path = new Path2D();
  path.moveTo(x + w / 2, y + h * 0.9);
  path.bezierCurveTo(x - w * 0.2, y + h * 0.45, x + w * 0.1, y - h * 0.15, x + w / 2, y + h * 0.28);
  path.bezierCurveTo(x + w * 0.9, y - h * 0.15, x + w * 1.2, y + h * 0.45, x + w / 2, y + h * 0.9);
  path.closePath();
  return path;
}

function shapePath(item: ShapeItem): { path: Path2D; closed: boolean } {
  const [x1, y1] = item.start;
  const [x2, y2] = item.end;
  const x = Math.min(x1, x2), y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
  switch (item.shape) {
    case 'line': return { path: polygonPath([[x1, y1], [x2, y2]], false), closed: false };
    case 'arrow': {
      const a = Math.atan2(y2 - y1, x2 - x1);
      const head = Math.max(8, Math.min(w, h) * 0.22);
      const p = polygonPath([
        [x1, y1], [x2, y2],
        [x2 - head * Math.cos(a - 0.5), y2 - head * Math.sin(a - 0.5)],
        [x2 - head * Math.cos(a + 0.5), y2 - head * Math.sin(a + 0.5)],
      ], true);
      return { path: p, closed: false };
    }
    case 'double_arrow': return { path: polygonPath([[x1, y1], [x2, y2]], false), closed: false };
    case 'curved_arrow': {
      const p = new Path2D();
      p.moveTo(x1, y1);
      p.quadraticCurveTo(x1, y2, x2, y2);
      return { path: p, closed: false };
    }
    case 'polyline': return { path: polygonPath(item.points ?? [], false), closed: false };
    case 'curve': {
      const p = new Path2D();
      const pts = item.points ?? [];
      if (pts.length) {
        p.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2;
          const my = (pts[i][1] + pts[i + 1][1]) / 2;
          p.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        const last = pts[pts.length - 1];
        if (pts.length > 1) p.lineTo(last[0], last[1]);
      }
      return { path: p, closed: false };
    }
    case 'rectangle': case 'cube': case 'prism': case 'cylinder': {
      const p = new Path2D(); p.rect(x, y, w, h); return { path: p, closed: true };
    }
    case 'ellipse': case 'circle': case 'sphere': case 'cone': case 'pyramid': {
      const p = new Path2D(); p.ellipse(x + w / 2, y + h / 2, Math.max(0.1, w / 2), Math.max(0.1, h / 2), 0, 0, Math.PI * 2);
      return { path: p, closed: true };
    }
    case 'triangle': return { path: polygonPath([[x + w / 2, y], [x + w, y + h], [x, y + h]], true), closed: true };
    case 'diamond': return { path: polygonPath([[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]], true), closed: true };
    case 'parallelogram': return { path: polygonPath([[x + w * 0.2, y], [x + w, y], [x + w * 0.8, y + h], [x, y + h]], true), closed: true };
    case 'trapezoid': return { path: polygonPath([[x + w * 0.2, y], [x + w * 0.8, y], [x + w, y + h], [x, y + h]], true), closed: true };
    case 'pentagon': return { path: polygonPath(boxPoints(item, 5), true), closed: true };
    case 'hexagon': return { path: polygonPath(boxPoints(item, 6, 0), true), closed: true };
    case 'star': return { path: polygonPath(starPoints(item), true), closed: true };
    case 'heart': return { path: heartPath(item), closed: true };
    case 'cloud': {
      const p = new Path2D();
      p.ellipse(x + w * 0.35, y + h * 0.55, w * 0.28, h * 0.3, 0, 0, Math.PI * 2);
      p.ellipse(x + w * 0.65, y + h * 0.5, w * 0.3, h * 0.35, 0, 0, Math.PI * 2);
      p.rect(x + w * 0.2, y + h * 0.45, w * 0.6, h * 0.35);
      return { path: p, closed: true };
    }
    case 'callout': {
      const p = new Path2D();
      p.roundRect(x, y, w, h * 0.75, Math.min(12, w / 8));
      p.moveTo(x + w * 0.2, y + h * 0.75);
      p.lineTo(x + w * 0.32, y + h);
      p.lineTo(x + w * 0.42, y + h * 0.75);
      p.closePath();
      return { path: p, closed: true };
    }
    case 'block_arrow_right': return { path: polygonPath([[x, y + h * 0.3], [x + w * 0.65, y + h * 0.3], [x + w * 0.65, y], [x + w, y + h / 2], [x + w * 0.65, y + h], [x + w * 0.65, y + h * 0.7], [x, y + h * 0.7]], true), closed: true };
    case 'block_arrow_left': return { path: polygonPath([[x + w, y + h * 0.3], [x + w * 0.35, y + h * 0.3], [x + w * 0.35, y], [x, y + h / 2], [x + w * 0.35, y + h], [x + w * 0.35, y + h * 0.7], [x + w, y + h * 0.7]], true), closed: true };
    case 'block_arrow_up': return { path: polygonPath([[x + w * 0.3, y + h], [x + w * 0.3, y + h * 0.35], [x, y + h * 0.35], [x + w / 2, y], [x + w, y + h * 0.35], [x + w * 0.7, y + h * 0.35], [x + w * 0.7, y + h]], true), closed: true };
    case 'block_arrow_down': return { path: polygonPath([[x + w * 0.3, y], [x + w * 0.3, y + h * 0.65], [x, y + h * 0.65], [x + w / 2, y + h], [x + w, y + h * 0.65], [x + w * 0.7, y + h * 0.65], [x + w * 0.7, y]], true), closed: true };
    case 'compass': {
      const p = new Path2D();
      p.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      return { path: p, closed: true };
    }
    case 'polygon': return { path: polygonPath(item.points ?? [], true), closed: true };
    default: {
      const p = new Path2D(); p.rect(x, y, w, h); return { path: p, closed: true };
    }
  }
}

function drawShape(ctx: CanvasRenderingContext2D, item: ShapeItem) {
  const { path, closed } = shapePath(item);
  ctx.save();
  if (item.neon) {
    ctx.shadowColor = rgbaCss(item.stroke_rgba, 0.9);
    ctx.shadowBlur = 10 + (item.neon_strength ?? 0.6) * 20;
  }
  if (closed && item.fill_rgba) {
    ctx.fillStyle = rgbaCss(item.fill_rgba);
    ctx.fill(path);
  }
  ctx.strokeStyle = rgbaCss(item.stroke_rgba);
  ctx.lineWidth = item.stroke_width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(path);
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, item: TextItem) {
  ctx.save();
  ctx.fillStyle = rgbaCss(item.rgba);
  const face = item.font_face === 'serif' ? 'Georgia, serif' : item.font_face === 'mono' ? 'monospace' : 'Inter, system-ui, sans-serif';
  ctx.font = `${item.bold ? '700 ' : ''}${item.point_size}px ${face}`;
  ctx.textBaseline = 'top';
  const lines = item.text.split('\n');
  lines.forEach((line, i) => ctx.fillText(line, item.pos[0], item.pos[1] + i * item.point_size * 1.25, item.width));
  ctx.restore();
}

function drawImage(ctx: CanvasRenderingContext2D, item: ImageItem, assetUrl: (name: string) => string | undefined) {
  const url = assetUrl(item.asset);
  if (!url) return;
  const img = cachedImage(url);
  if (!img) return;
  ctx.save();
  const [x, y, w, h] = item.rect;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(((item.orientation ?? 0) * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawTable(ctx: CanvasRenderingContext2D, item: TableItem) {
  const [x, y, w, h] = item.rect;
  const rows = Math.max(1, item.rows), cols = Math.max(1, item.cols);
  const rowFracs = normalizeFracs(item.row_fracs, rows);
  const colFracs = normalizeFracs(item.col_fracs, cols);
  ctx.save();
  ctx.strokeStyle = rgbaCss(item.stroke_rgba);
  ctx.lineWidth = item.stroke_width;
  const xs = [x];
  colFracs.forEach((f) => xs.push(xs[xs.length - 1] + f * w));
  const ys = [y];
  rowFracs.forEach((f) => ys.push(ys[ys.length - 1] + f * h));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cellFill = item.cell_fills?.find((f) => f.r === r && f.c === c);
    const fill = cellFill?.color ?? item.fills?.[r];
    if (fill) { ctx.fillStyle = rgbaCss(fill); ctx.fillRect(xs[c], ys[r], xs[c + 1] - xs[c], ys[r + 1] - ys[r]); }
    ctx.strokeRect(xs[c], ys[r], xs[c + 1] - xs[c], ys[r + 1] - ys[r]);
    const cell = item.cells?.[r * cols + c];
    if (cell) {
      ctx.fillStyle = '#374151';
      ctx.font = '13px Inter, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(cell, xs[c] + 6, ys[r] + 6, xs[c + 1] - xs[c] - 12);
    }
  }
  ctx.restore();
}

function normalizeFracs(fracs: number[], count: number): number[] {
  const out = Array.from({ length: count }, (_, i) => Math.max(0.01, fracs[i] ?? 1));
  const sum = out.reduce((a, b) => a + b, 0);
  return out.map((f) => f / sum);
}

function drawTape(ctx: CanvasRenderingContext2D, item: TapeItem) {
  const [x, y, w, h] = item.rect;
  ctx.save();
  ctx.fillStyle = rgbaCss(item.color, 0.72);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = rgbaCss(item.color);
  ctx.lineWidth = 1;
  if (item.pattern === 'stripes' || item.pattern === 'grid') {
    ctx.beginPath();
    const step = item.pattern === 'stripes' ? 12 : 18;
    for (let i = step; i < w; i += step) { ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + h); }
    for (let i = step; i < h; i += step) { ctx.moveTo(x, y + i); ctx.lineTo(x + w, y + i); }
    ctx.stroke();
  } else if (item.pattern === 'dots') {
    ctx.fillStyle = rgbaCss(item.color, 0.6);
    for (let i = 10; i < w; i += 14) for (let j = 10; j < h; j += 14) {
      ctx.beginPath(); ctx.arc(x + i, y + j, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (item.revealed) item.strokes.forEach((s) => drawStroke(ctx, s, false));
  ctx.fillStyle = 'rgba(30,30,30,0.8)';
  ctx.font = '13px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(item.label, x + 8, y + h / 2, w - 16);
  ctx.restore();
}

function drawSticky(ctx: CanvasRenderingContext2D, item: StickyNoteItem) {
  const [x, y, w, h] = item.rect;
  ctx.save();
  ctx.fillStyle = rgbaCss(item.color);
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 12;
  ctx.fillRect(x, y, w, item.is_folded ? Math.min(h, 48) : h);
  ctx.shadowBlur = 0;
  if (item.fastener === 'tape') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + w * 0.35, y - 8, w * 0.3, 16);
  } else if (item.fastener === 'pin') {
    ctx.fillStyle = '#e05252';
    ctx.beginPath(); ctx.arc(x + w / 2, y + 4, 7, 0, Math.PI * 2); ctx.fill();
  }
  if (!item.is_folded) {
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    const step = item.style === 'grid' ? 22 : 28;
    if (item.style === 'grid') {
      for (let i = step; i < w; i += step) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + h); ctx.stroke(); }
      for (let j = step; j < h; j += step) { ctx.beginPath(); ctx.moveTo(x, y + j); ctx.lineTo(x + w, y + j); ctx.stroke(); }
    } else {
      for (let j = step; j < h; j += step) { ctx.beginPath(); ctx.moveTo(x + 10, y + j); ctx.lineTo(x + w - 10, y + j); ctx.stroke(); }
    }
    if (item.style === 'checklist') {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      for (let j = step; j < h; j += step) ctx.strokeRect(x + 12, y + j - 14, 12, 12);
    }
    ctx.fillStyle = rgbaCss(item.text_color ?? [30, 30, 30, 255]);
    ctx.font = `${item.text_bold ? '700 ' : ''}${item.text_size ?? 14}px ${item.text_face ?? 'Inter, sans-serif'}`;
    ctx.textBaseline = 'top';
    item.text.split('\n').forEach((line, i) => ctx.fillText(line, x + 12, y + 12 + i * (item.text_size ?? 14) * 1.3 - item.scroll_offset, w - 24));
    item.strokes.forEach((s) => drawStroke(ctx, s, false));
  }
  ctx.restore();
}

function drawMindNode(ctx: CanvasRenderingContext2D, node: MindMapNode, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = node.color ? rgbaCss(node.color) : '#eef2ff';
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1e293b';
  ctx.font = `${node.font_size ?? 13}px Inter, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(node.text, x + 10, y + h / 2, w - 20);
  ctx.restore();
}

function drawMindMap(ctx: CanvasRenderingContext2D, item: MindMapItem) {
  const walk = (node: MindMapNode, x: number, y: number, depth: number): number => {
    const w = node.width ?? 130;
    const h = 38;
    let childY = y;
    const children = node.collapsed ? [] : (node.children ?? []);
    for (const child of children) {
      const cy = walk(child, x + w + 70, childY, depth + 1);
      ctx.save();
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w, y + h / 2);
      ctx.bezierCurveTo(x + w + 35, y + h / 2, x + 35 + w, cy + h / 2, x + w + 70, cy + h / 2);
      ctx.stroke();
      ctx.restore();
      childY = cy + h + 16;
    }
    const ownY = children.length ? (y + childY - h - 16 + y) / 2 : y;
    drawMindNode(ctx, node, x, ownY, w, h);
    return ownY;
  };
  walk(item.root, item.pos[0], item.pos[1], 0);
}

function drawAudioClip(ctx: CanvasRenderingContext2D, item: AudioClipItem) {
  const [x, y, w, h] = item.rect;
  ctx.save();
  ctx.fillStyle = rgbaCss(item.color);
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(x + 14, y + h / 2 - 7); ctx.lineTo(x + 14, y + h / 2 + 7); ctx.lineTo(x + 26, y + h / 2); ctx.closePath(); ctx.fill();
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText(item.title, x + 36, y + h / 2 + 4, w - 44);
  ctx.restore();
}

function drawItem(ctx: CanvasRenderingContext2D, item: CanvasItem, assetUrl: (name: string) => string | undefined) {
  if (item.rotation) {
    const b = itemBounds(item);
    if (b) {
      const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((item.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
  }
  switch (item.kind) {
    case 'stroke': drawStroke(ctx, item, false); break;
    case 'text': drawText(ctx, item); break;
    case 'shape': drawShape(ctx, item); break;
    case 'image': drawImage(ctx, item, assetUrl); break;
    case 'table': drawTable(ctx, item); break;
    case 'tape': drawTape(ctx, item); break;
    case 'sticky_note': drawSticky(ctx, item); break;
    case 'mind_map': drawMindMap(ctx, item); break;
    case 'audio_clip': drawAudioClip(ctx, item); break;
    case 'group': (item as GroupItem).items.forEach((child) => drawItem(ctx, child, assetUrl)); break;
  }
  if (item.rotation && itemBounds(item)) ctx.restore();
}

export function itemBounds(item: CanvasItem): Rect | null {
  switch (item.kind) {
    case 'stroke': {
      const g = geometryOf(item, false);
      if (!g.centerline.length) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      g.centerline.forEach(([x, y], i) => {
        const r = g.halfWidths[i] ?? 0;
        minX = Math.min(minX, x - r); maxX = Math.max(maxX, x + r);
        minY = Math.min(minY, y - r); maxY = Math.max(maxY, y + r);
      });
      return [minX, minY, maxX - minX, maxY - minY];
    }
    case 'text': return [item.pos[0], item.pos[1], item.width, item.point_size * 1.3 * Math.max(1, item.text.split('\n').length)];
    case 'shape': return [Math.min(item.start[0], item.end[0]), Math.min(item.start[1], item.end[1]), Math.abs(item.end[0] - item.start[0]), Math.abs(item.end[1] - item.start[1])];
    case 'image': case 'table': case 'tape': case 'sticky_note': case 'audio_clip': return item.rect;
    case 'mind_map': return [item.pos[0], item.pos[1], 400, 400];
    case 'group': {
      const bounds = (item as GroupItem).items.map(itemBounds).filter((b): b is Rect => b !== null);
      if (!bounds.length) return null;
      const x = Math.min(...bounds.map((b) => b[0]));
      const y = Math.min(...bounds.map((b) => b[1]));
      return [x, y, Math.max(...bounds.map((b) => b[0] + b[2])) - x, Math.max(...bounds.map((b) => b[1] + b[3])) - y];
    }
  }
}

export function renderScene(input: RenderInput): void {
  const { ctx, width, height, dpr, doc, pageIndex, zoom, origin, theme, selection, boardMode, ruler, liveShape, liveRect, liveStroke, fadingStrokes, eraserCursor, assetUrl } = input;
  const palette = PALETTES[theme];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  const page = doc.pages[pageIndex];
  if (!page) return;

  ctx.save();
  ctx.translate(origin.x, origin.y);
  ctx.scale(zoom, zoom);

  const style = resolveStyle(doc, page.style);
  const vx = -origin.x / zoom, vy = -origin.y / zoom;
  const vw = width / zoom, vh = height / zoom;
  const ox = boardMode ? vx : 0, oy = boardMode ? vy : 0;
  const bw = boardMode ? vw : page.width, bh = boardMode ? vh : page.height;
  ctx.fillStyle = rgbaCss(style.page_color);
  ctx.fillRect(ox, oy, bw, bh);
  if (!boardMode && page.pdf_asset) {
    const url = assetUrl(page.pdf_asset);
    const img = url ? cachedImage(url) : null;
    if (img) ctx.drawImage(img, 0, 0, page.width, page.height);
  }
  ctx.save();
  ctx.translate(ox, oy);
  drawRuling(ctx, bw, bh, style);
  ctx.restore();
  if (!boardMode) {
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1 / zoom;
    ctx.strokeRect(0, 0, page.width, page.height);
  }

  // Opaque ink first, then highlighters in a MULTIPLY pass, matching the app.
  page.items.filter((it) => it.kind !== 'stroke' || it.tool !== 'highlighter').forEach((it) => drawItem(ctx, it, assetUrl));
  page.items.filter((it): it is StrokeItem => it.kind === 'stroke' && it.tool === 'highlighter').forEach((it) => drawStroke(ctx, it, false));

  if (liveRect) {
    const [rx, ry, rw, rh] = liveRect;
    ctx.save();
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.strokeStyle = SELECTION;
    ctx.lineWidth = 1.5 / zoom;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();
  }
  if (liveShape) drawShape(ctx, liveShape);
  if (liveStroke) drawStroke(ctx, liveStroke, true);
  if (fadingStrokes?.length) {
    const now = performance.now();
    fadingStrokes.forEach(({ stroke, born }) => {
      const alpha = now < born ? 1 : Math.max(0, 1 - (now - born) / 500);
      if (alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      drawStroke(ctx, stroke, true);
      ctx.restore();
    });
  }

  selection.forEach((id) => {
    const item = page.items.find((it) => it.uid === id);
    if (!item) return;
    const b = itemBounds(item);
    if (!b) return;
    ctx.save();
    ctx.fillStyle = 'rgba(56,189,248,0.12)';
    ctx.strokeStyle = SELECTION;
    ctx.lineWidth = 1.5 / zoom;
    ctx.fillRect(b[0], b[1], b[2], b[3]);
    ctx.strokeRect(b[0], b[1], b[2], b[3]);
    const hs = 7 / zoom;
    const [x, y, w, h] = b;
    const cx = x + w / 2, cy = y + h / 2;
    [
      [x, y], [cx, y], [x + w, y], [x + w, cy],
      [x + w, y + h], [cx, y + h], [x, y + h], [x, cy],
    ].forEach(([hx, hy]) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
    });
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, y - 28 / zoom);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, y - 30 / zoom, hs * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  if (eraserCursor) {
    ctx.save();
    ctx.strokeStyle = 'rgba(239,68,68,0.8)';
    ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath();
    ctx.arc(eraserCursor.x, eraserCursor.y, eraserCursor.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  if (ruler?.visible) {
    ctx.save();
    ctx.translate(width / 2, ruler.y);
    ctx.rotate((ruler.angle * Math.PI) / 180);
    const half = Math.max(width, height);
    ctx.fillStyle = 'rgba(56,189,248,0.10)';
    ctx.strokeStyle = 'rgba(56,189,248,0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(-half, -22, half * 2, 44);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let x = -half; x <= half; x += 10) {
      const major = Math.round(x / 10) % 5 === 0;
      ctx.moveTo(x, -22);
      ctx.lineTo(x, major ? -8 : -15);
    }
    ctx.stroke();
    ctx.fillStyle = SELECTION;
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(`${Math.round(ruler.angle)}°  ${ruler.locked ? 'locked' : 'free'}`, -half + 8, 16);
    ctx.restore();
  }
}
