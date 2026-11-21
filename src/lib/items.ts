/** Item creation, cloning and geometric transforms used by the object tools. */
import type { CanvasItem, Pt, Rect, StrokeItem, ShapeItem, TextItem, TableItem, TapeItem, StickyNoteItem, MindMapItem, AudioClipItem, GroupItem, ImageItem, ShapeKind } from '../types/model';
import { uid } from '../types/model';
import { itemBounds } from '../canvas/renderer';
import { pointInRect, rectFromPoints } from './geometry';
import { defaultToolConfig } from './toolDefaults';

export function cloneItem(item: CanvasItem, freshUid = true): CanvasItem {
  const copy = structuredClone(item);
  if (freshUid) {
    copy.uid = uid();
    if (copy.kind === 'group') copy.items = copy.items.map((c) => cloneItem(c));
  }
  return copy;
}

function mapRects(item: CanvasItem, fn: (r: Rect) => Rect) {
  switch (item.kind) {
    case 'image': case 'table': case 'tape': case 'sticky_note': case 'audio_clip':
      item.rect = fn(item.rect);
      break;
    case 'shape':
      item.start = fn([item.start[0], item.start[1], 0, 0]).slice(0, 2) as Pt;
      item.end = fn([item.end[0], item.end[1], 0, 0]).slice(0, 2) as Pt;
      if (item.points) item.points = item.points.map((p) => fn([p[0], p[1], 0, 0]).slice(0, 2) as Pt);
      break;
  }
}

export function translateItem(item: CanvasItem, dx: number, dy: number) {
  switch (item.kind) {
    case 'stroke':
      item.samples = item.samples.map((s) => [s[0] + dx, s[1] + dy, s[2], ...(s.length > 3 ? [s[3]] : [])] as StrokeItem['samples'][number]);
      break;
    case 'text':
      item.pos = [item.pos[0] + dx, item.pos[1] + dy];
      break;
    case 'mind_map':
      item.pos = [item.pos[0] + dx, item.pos[1] + dy];
      break;
    default:
      mapRects(item, (r) => [r[0] + dx, r[1] + dy, r[2], r[3]]);
  }
  if (item.kind === 'group') item.items.forEach((c) => translateItem(c, dx, dy));
}

export function scaleItem(item: CanvasItem, sx: number, sy: number, anchor: Pt) {
  const t = (p: Pt): Pt => [anchor[0] + (p[0] - anchor[0]) * sx, anchor[1] + (p[1] - anchor[1]) * sy];
  switch (item.kind) {
    case 'stroke':
      item.samples = item.samples.map((s) => {
        const p = t([s[0], s[1]]);
        return [p[0], p[1], s[2], ...(s.length > 3 ? [s[3]] : [])] as StrokeItem['samples'][number];
      });
      item.config.base_width *= (sx + sy) / 2;
      break;
    case 'text':
      item.pos = t(item.pos);
      item.width *= sx;
      item.point_size *= (sx + sy) / 2;
      break;
    case 'mind_map':
      item.pos = t(item.pos);
      break;
    default:
      mapRects(item, (r) => {
        const p = t([r[0], r[1]]);
        return [p[0], p[1], Math.max(8, r[2] * sx), Math.max(8, r[3] * sy)];
      });
  }
  if (item.kind === 'group') item.items.forEach((c) => scaleItem(c, sx, sy, anchor));
}

export function itemCenter(item: CanvasItem): Pt {
  const b = itemBounds(item);
  return b ? [b[0] + b[2] / 2, b[1] + b[3] / 2] : item.kind === 'text' ? item.pos : [0, 0];
}

export function itemContains(item: CanvasItem, p: Pt, zoom: number): boolean {
  if (item.kind === 'stroke') {
    const r = 10 / zoom + item.config.base_width / 2;
    return item.samples.some((s) => Math.hypot(s[0] - p[0], s[1] - p[1]) <= r);
  }
  const b = itemBounds(item);
  return b ? pointInRect(p, b) : false;
}

export function makeStroke(tool: StrokeItem['tool'], samples: StrokeItem['samples'], config?: Partial<StrokeItem['config']>): StrokeItem {
  return {
    uid: uid(),
    kind: 'stroke',
    tool,
    config: { ...defaultToolConfig(tool), ...config },
    samples,
    speed_scale: 1,
    straight: false,
  };
}

export function makeShape(kind: ShapeKind, a: Pt, b: Pt, color: [number, number, number, number], fill: [number, number, number, number] | null = null, points?: Pt[]): ShapeItem {
  return {
    uid: uid(), kind: 'shape', shape: kind, start: a, end: b,
    stroke_rgba: color, stroke_width: 2, fill_rgba: fill, points,
  };
}

export function makeText(p: Pt, text = 'Text'): TextItem {
  return { uid: uid(), kind: 'text', pos: p, width: 260, text, rgba: [30, 41, 59, 255], point_size: 20 };
}

export function makeSticky(rect: Rect): StickyNoteItem {
  return {
    uid: uid(), kind: 'sticky_note', rect, color: [255, 241, 150, 255], text: '',
    is_folded: false, style: 'lined', fastener: 'tape', scroll_offset: 0,
    text_size: 14, text_color: [40, 40, 40, 255], strokes: [],
  };
}

export function makeTable(rect: Rect, rows: number, cols: number): TableItem {
  return {
    uid: uid(), kind: 'table', rect, rows, cols,
    row_fracs: Array(rows).fill(1 / rows), col_fracs: Array(cols).fill(1 / cols),
    stroke_rgba: [80, 90, 110, 200], stroke_width: 1, style: 'grid', corner_radius: 4,
    cell_fills: [],
  };
}

export function makeTape(rect: Rect): TapeItem {
  return {
    uid: uid(), kind: 'tape', rect, color: [250, 220, 130, 160], pattern: 'translucent',
    revealed: true, label: '', strokes: [],
  };
}

export function makeMindMap(p: Pt): MindMapItem {
  return {
    uid: uid(), kind: 'mind_map', pos: p, layout: 'tree', branch_style: 'curve',
    theme: 'default', default_shape: 'rounded', cell_density: 1,
    root: { id: uid(), text: 'Central idea', children: [{ id: uid(), text: 'Branch 1' }] },
  };
}

export function makeAudioClip(rect: Rect): AudioClipItem {
  return { uid: uid(), kind: 'audio_clip', id: uid(), track_id: '', title: 'Voice note', duration_ms: 0, rect, color: [99, 102, 241, 255] };
}

export function makeImage(rect: Rect, asset: string, w: number, h: number): ImageItem {
  return { uid: uid(), kind: 'image', asset, rect, src_w: w, src_h: h };
}

export function makeGroup(items: CanvasItem[]): GroupItem {
  return { uid: uid(), kind: 'group', items };
}

/** Screen-space handle positions for the given bounds (8 box handles + rotate grip). */
export function selectionHandles(rect: Rect): { id: string; p: Pt }[] {
  const [x, y, w, h] = rect;
  const cx = x + w / 2, cy = y + h / 2;
  return [
    { id: 'tl', p: [x, y] }, { id: 't', p: [cx, y] }, { id: 'tr', p: [x + w, y] },
    { id: 'r', p: [x + w, cy] }, { id: 'br', p: [x + w, y + h] }, { id: 'b', p: [cx, y + h] },
    { id: 'bl', p: [x, y + h] }, { id: 'l', p: [x, cy] },
    { id: 'rotate', p: [cx, y - 28] },
  ];
}

export function bandBounds(a: Pt, b: Pt): Rect { return rectFromPoints(a, b); }
