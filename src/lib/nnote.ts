/**
 * `.nnote` container codec — ZIP archive with a DEFLATED `manifest.json`, optional
 * DEFLATED `flow.xml`, and STORED binary assets. Mirrors `format/DocumentCodec.kt`.
 */
import JSZip from 'jszip';
import type {
  AudioClipItem, AudioTrack, Bookmark, CanvasItem, GroupItem, ImageItem,
  MindMapItem, MindMapNode, NNoteDocument, Page, PageStyle, Rgba, Rect,
  ShapeItem, StickyNoteItem, StrokeItem, TableItem, TapeItem, TextItem, ToolConfig, Pt,
} from '../types/model';
import { A4, blankPage, uid } from '../types/model';
import { normalizeConfig } from './toolDefaults';

type Obj = Record<string, unknown>;

export interface NNoteFile {
  doc: NNoteDocument;
  assets: Map<string, Blob>;
}

const asObj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {});
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d = false) => (typeof v === 'boolean' ? v : d);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function rgba(v: unknown, d: Rgba = [0, 0, 0, 255]): Rgba {
  const a = arr(v);
  if (a.length < 3) return d;
  return [num(a[0], d[0]), num(a[1], d[1]), num(a[2], d[2]), num(a[3], d[3])];
}

function pt(v: unknown, d: Pt = [0, 0]): Pt {
  const a = arr(v);
  return [num(a[0], d[0]), num(a[1], d[1])];
}

function rect(v: unknown, d: Rect = [0, 0, 0, 0]): Rect {
  const a = arr(v);
  return [num(a[0], d[0]), num(a[1], d[1]), num(a[2], d[2]), num(a[3], d[3])];
}

function parseStyle(v: unknown): PageStyle | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = asObj(v);
  if (o.page_color === undefined && o.pattern === undefined && o.pattern_color === undefined && o.spacing === undefined) return undefined;
  return {
    page_color: o.page_color !== undefined ? rgba(o.page_color) : undefined,
    pattern: o.pattern as PageStyle['pattern'],
    pattern_color: o.pattern_color !== undefined ? rgba(o.pattern_color) : undefined,
    spacing: o.spacing !== undefined ? num(o.spacing, 28) : undefined,
  };
}

function parseStroke(o: Obj): StrokeItem {
  const tool = str(o.tool, 'pen') as StrokeItem['tool'];
  return {
    uid: uid(),
    kind: 'stroke',
    tool,
    config: normalizeConfig(asObj(o.config) as Partial<ToolConfig>, tool),
    samples: arr(o.samples).map((s) => {
      const a = arr(s);
      const base: [number, number, number] = [num(a[0], 0), num(a[1], 0), num(a[2], 0.5)];
      return a.length > 3 ? [...base, num(a[3], 0)] : base;
    }),
    speed_scale: num(o.speed_scale, 1),
    straight: bool(o.straight),
    audio_time_ms: o.audio_time_ms !== undefined ? num(o.audio_time_ms, 0) : undefined,
    audio_track_id: o.audio_track_id !== undefined ? str(o.audio_track_id) : undefined,
    locked: bool(o.locked),
  };
}

function parseItems(raw: unknown): CanvasItem[] {
  return arr(raw).map((v) => {
    const o = asObj(v);
    const item = parseItem(o);
    if (item && o.rotation !== undefined) item.rotation = num(o.rotation, 0);
    return item;
  }).filter((x): x is CanvasItem => x !== null);
}

function parseItem(o: Obj): CanvasItem | null {
  const kind = str(o.kind);
  const locked = bool(o.locked);
  switch (kind) {
    case 'stroke': return parseStroke(o);
    case 'text': {
      const item: TextItem = {
        uid: uid(), kind: 'text', pos: pt(o.pos), width: num(o.width, 200),
        text: str(o.text), rgba: rgba(o.rgba), point_size: num(o.point_size, 16),
        locked,
      };
      if (o.height !== undefined) item.height = num(o.height, 20);
      if (o.font_face !== undefined) item.font_face = str(o.font_face);
      if (o.bold !== undefined) item.bold = bool(o.bold);
      return item;
    }
    case 'shape': {
      const item: ShapeItem = {
        uid: uid(), kind: 'shape', shape: str(o.shape, 'rectangle') as ShapeItem['shape'],
        start: pt(o.start), end: pt(o.end), stroke_rgba: rgba(o.stroke_rgba),
        stroke_width: num(o.stroke_width, 2), fill_rgba: o.fill_rgba === null ? null : rgba(o.fill_rgba, [0, 0, 0, 0]),
        locked,
      };
      if (o.points !== undefined) item.points = arr(o.points).map((p) => pt(p));
      if (o.neon !== undefined) item.neon = bool(o.neon);
      if (o.neon_strength !== undefined) item.neon_strength = num(o.neon_strength, 0.6);
      return item;
    }
    case 'image': {
      const item: ImageItem = {
        uid: uid(), kind: 'image', asset: str(o.asset), rect: rect(o.rect),
        src_w: num(o.src_w, 100), src_h: num(o.src_h, 100), locked,
      };
      if (o.orientation !== undefined) item.orientation = num(o.orientation, 0) as ImageItem['orientation'];
      if (o.crop !== undefined) item.crop = rect(o.crop);
      return item;
    }
    case 'table': {
      const item: TableItem = {
        uid: uid(), kind: 'table', rect: rect(o.rect), rows: num(o.rows, 2), cols: num(o.cols, 2),
        row_fracs: arr(o.row_fracs).map((f) => num(f, 1)),
        col_fracs: arr(o.col_fracs).map((f) => num(f, 1)),
        stroke_rgba: rgba(o.stroke_rgba), stroke_width: num(o.stroke_width, 1),
        style: str(o.style, 'grid') as TableItem['style'], corner_radius: num(o.corner_radius, 0), locked,
      };
      if (o.fills !== undefined) item.fills = arr(o.fills).map((f) => (f === null ? null : rgba(f)));
      if (o.cell_fills !== undefined) item.cell_fills = arr(o.cell_fills).map((c) => {
        const x = asObj(c);
        return { r: num(x.r, 0), c: num(x.c, 0), color: rgba(x.color) };
      });
      if (o.cells !== undefined) item.cells = arr(o.cells).map((c) => str(c));
      return item;
    }
    case 'tape': {
      const item: TapeItem = {
        uid: uid(), kind: 'tape', rect: rect(o.rect), color: rgba(o.color),
        pattern: str(o.pattern, 'translucent') as TapeItem['pattern'],
        revealed: bool(o.revealed), label: str(o.label), strokes: parseItems(o.strokes) as StrokeItem[], locked,
      };
      return item;
    }
    case 'sticky_note': {
      const item: StickyNoteItem = {
        uid: uid(), kind: 'sticky_note', rect: rect(o.rect), color: rgba(o.color),
        text: str(o.text), is_folded: bool(o.is_folded),
        style: str(o.style, 'blank') as StickyNoteItem['style'],
        fastener: str(o.fastener, 'clean') as StickyNoteItem['fastener'],
        scroll_offset: num(o.scroll_offset, 0), strokes: parseItems(o.strokes) as StrokeItem[], locked,
      };
      if (o.text_size !== undefined) item.text_size = num(o.text_size, 14);
      if (o.text_color !== undefined) item.text_color = rgba(o.text_color);
      if (o.text_bold !== undefined) item.text_bold = bool(o.text_bold);
      if (o.text_face !== undefined) item.text_face = str(o.text_face);
      return item;
    }
    case 'mind_map': {
      const parseNode = (v: unknown): MindMapNode => {
        const n = asObj(v);
        const node: MindMapNode = { id: str(n.id, uid()), text: str(n.text) };
        if (n.collapsed !== undefined) node.collapsed = bool(n.collapsed);
        if (n.shape !== undefined) node.shape = str(n.shape);
        if (n.color !== undefined) node.color = rgba(n.color);
        if (n.font_size !== undefined) node.font_size = num(n.font_size, 14);
        if (n.width !== undefined) node.width = num(n.width, 120);
        if (n.icon !== undefined) node.icon = str(n.icon);
        if (n.children !== undefined) node.children = arr(n.children).map(parseNode);
        return node;
      };
      const item: MindMapItem = {
        uid: uid(), kind: 'mind_map', pos: pt(o.pos), layout: str(o.layout, 'tree'),
        branch_style: str(o.branch_style, 'curve'), theme: str(o.theme, 'default'),
        default_shape: str(o.default_shape, 'rounded'), cell_density: num(o.cell_density, 1),
        root: parseNode(o.root), locked,
      };
      if (o.connections !== undefined) item.connections = arr(o.connections).map((c) => {
        const x = asObj(c);
        return { from: str(x.from), to: str(x.to) };
      });
      return item;
    }
    case 'audio_clip': {
      const item: AudioClipItem = {
        uid: uid(), kind: 'audio_clip', id: str(o.id, uid()), track_id: str(o.track_id),
        title: str(o.title), duration_ms: num(o.duration_ms, 0), rect: rect(o.rect),
        color: rgba(o.color), locked,
      };
      if (o.audio_asset !== undefined) item.audio_asset = str(o.audio_asset);
      if (o.transcript !== undefined) item.transcript = str(o.transcript);
      return item;
    }
    case 'group': {
      const item: GroupItem = { uid: uid(), kind: 'group', items: parseItems(o.items), locked };
      return item;
    }
    default:
      return null; // unknown kinds are skipped, matching the app's forgiving reader
  }
}

function parsePage(o: Obj): Page {
  const page: Page = {
    uid: uid(),
    // A4-only notebook: every imported page is normalised to the fixed A4 canvas.
    width: A4.width,
    height: A4.height,
    pdf_page: o.pdf_page === null || o.pdf_page === undefined ? null : num(o.pdf_page, 0),
    style: parseStyle(o.style),
    items: parseItems(o.items),
  };
  if (o.pdf_asset !== undefined) page.pdf_asset = str(o.pdf_asset);
  return page;
}

export async function parseNNote(input: ArrayBuffer | Uint8Array | Blob): Promise<NNoteFile> {
  let zip: JSZip;
  let manifestText: string;
  try {
    zip = await JSZip.loadAsync(input);
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) throw new Error('missing manifest');
    manifestText = await manifestFile.async('string');
  } catch {
    throw new Error('This is not a valid .nnote file');
  }
  let m: Obj;
  try { m = asObj(JSON.parse(manifestText)); }
  catch { throw new Error('This .nnote file is corrupted'); }
  const format = str(m.format, 'nnote');
  if (format !== 'nnote' && format !== 'xnote') throw new Error('Not an Nnotes document');

  const pages = arr(m.pages).map((p) => parsePage(asObj(p)));
  const bookmarks: Bookmark[] = arr(m.bookmarks).map((b) => {
    const x = asObj(b);
    return { page: num(x.page, 0), label: str(x.label) };
  });
  const audio_tracks: AudioTrack[] = arr(m.audio_tracks).map((t) => {
    const x = asObj(t);
    return {
      id: str(x.id), name: str(x.name), entry: str(x.entry),
      duration_ms: num(x.duration_ms, 0), created_at: num(x.created_at, 0),
      transcript: x.transcript !== undefined ? str(x.transcript) : undefined,
    };
  });

  const flowFile = zip.file('flow.xml');
  const assets = new Map<string, Blob>();
  await Promise.all(Object.values(zip.files).map(async (entry) => {
    if (entry.dir || entry.name === 'manifest.json' || entry.name === 'flow.xml') return;
    const data = await entry.async('uint8array');
    const type = entry.name.endsWith('.png') ? 'image/png'
      : entry.name.endsWith('.svg') ? 'image/svg+xml'
        : entry.name.endsWith('.pdf') ? 'application/pdf'
          : entry.name.endsWith('.m4a') ? 'audio/mp4' : 'application/octet-stream';
    assets.set(entry.name, new Blob([data as BlobPart], { type }));
  }));

  const doc: NNoteDocument = {
    format: format as NNoteDocument['format'],
    version: num(m.version, 1),
    dpi: num(m.dpi, 150),
    is_board: bool(m.is_board),
    has_pdf: bool(m.has_pdf),
    style: parseStyle(m.style) ?? {},
    bookmarks,
    audio_tracks,
    pages: pages.length ? pages : [blankPage()],
    flow: flowFile ? await flowFile.async('string') : undefined,
    name: 'Untitled',
  };
  return { doc, assets };
}

function configToJson(c: ToolConfig): Obj {
  return {
    base_width: c.base_width,
    pressure_enabled: c.pressure_enabled,
    pressure_min_factor: c.pressure_min_factor,
    direction_strength: c.direction_strength,
    rgba: c.rgba,
    speed_strength: c.speed_strength,
    taper_enabled: c.taper_enabled,
    taper_min_factor: c.taper_min_factor,
    neon: c.neon,
    neon_strength: c.neon_strength,
    dash_length: c.dash_length,
    dash_gap: c.dash_gap,
    highlighter_alpha: c.highlighter_alpha,
  };
}

function itemToJson(item: CanvasItem): Obj {
  const locked: Obj = item.locked ? { locked: true } : {};
  switch (item.kind) {
    case 'stroke': {
      const o: Obj = {
        kind: 'stroke', tool: item.tool, config: configToJson(item.config),
        samples: item.samples, speed_scale: item.speed_scale, straight: item.straight,
      };
      if (item.audio_time_ms !== undefined) o.audio_time_ms = item.audio_time_ms;
      if (item.audio_track_id !== undefined) o.audio_track_id = item.audio_track_id;
      return { ...o, ...locked };
    }
    case 'text': {
      const o: Obj = {
        kind: 'text', pos: item.pos, width: item.width, text: item.text,
        rgba: item.rgba, point_size: item.point_size,
      };
      if (item.height !== undefined) o.height = item.height;
      if (item.font_face !== undefined) o.font_face = item.font_face;
      if (item.bold !== undefined) o.bold = item.bold;
      return { ...o, ...locked };
    }
    case 'shape': {
      const o: Obj = {
        kind: 'shape', shape: item.shape, start: item.start, end: item.end,
        stroke_rgba: item.stroke_rgba, stroke_width: item.stroke_width, fill_rgba: item.fill_rgba,
      };
      if (item.points !== undefined) o.points = item.points;
      if (item.neon !== undefined) o.neon = item.neon;
      if (item.neon_strength !== undefined) o.neon_strength = item.neon_strength;
      return { ...o, ...locked };
    }
    case 'image': {
      const o: Obj = { kind: 'image', asset: item.asset, rect: item.rect, src_w: item.src_w, src_h: item.src_h };
      if (item.orientation !== undefined) o.orientation = item.orientation;
      if (item.crop !== undefined) o.crop = item.crop;
      return { ...o, ...locked };
    }
    case 'table': {
      const o: Obj = {
        kind: 'table', rect: item.rect, rows: item.rows, cols: item.cols,
        row_fracs: item.row_fracs, col_fracs: item.col_fracs,
        stroke_rgba: item.stroke_rgba, stroke_width: item.stroke_width,
        style: item.style, corner_radius: item.corner_radius,
      };
      if (item.fills !== undefined) o.fills = item.fills;
      if (item.cell_fills !== undefined) o.cell_fills = item.cell_fills;
      if (item.cells !== undefined) o.cells = item.cells;
      return { ...o, ...locked };
    }
    case 'tape':
      return {
        kind: 'tape', rect: item.rect, color: item.color, pattern: item.pattern,
        revealed: item.revealed, label: item.label,
        strokes: item.strokes.map(itemToJson), ...locked,
      };
    case 'sticky_note': {
      const o: Obj = {
        kind: 'sticky_note', rect: item.rect, color: item.color, text: item.text,
        is_folded: item.is_folded, style: item.style, fastener: item.fastener,
        scroll_offset: item.scroll_offset, strokes: item.strokes.map(itemToJson),
      };
      if (item.text_size !== undefined) o.text_size = item.text_size;
      if (item.text_color !== undefined) o.text_color = item.text_color;
      if (item.text_bold !== undefined) o.text_bold = item.text_bold;
      if (item.text_face !== undefined) o.text_face = item.text_face;
      return { ...o, ...locked };
    }
    case 'mind_map': {
      const nodeToJson = (n: MindMapNode): Obj => {
        const o: Obj = { id: n.id, text: n.text, collapsed: !!n.collapsed };
        if (n.shape !== undefined) o.shape = n.shape;
        if (n.color !== undefined) o.color = n.color;
        if (n.font_size !== undefined) o.font_size = n.font_size;
        if (n.width !== undefined) o.width = n.width;
        if (n.icon !== undefined) o.icon = n.icon;
        if (n.children !== undefined) o.children = n.children.map(nodeToJson);
        return o;
      };
      const o: Obj = {
        kind: 'mind_map', pos: item.pos, layout: item.layout, branch_style: item.branch_style,
        theme: item.theme, default_shape: item.default_shape, cell_density: item.cell_density,
        root: nodeToJson(item.root),
      };
      if (item.connections !== undefined) o.connections = item.connections;
      return { ...o, ...locked };
    }
    case 'audio_clip': {
      const o: Obj = {
        kind: 'audio_clip', id: item.id, track_id: item.track_id, title: item.title,
        duration_ms: item.duration_ms, rect: item.rect, color: item.color, ...locked,
      };
      if (item.audio_asset !== undefined) o.audio_asset = item.audio_asset;
      if (item.transcript !== undefined) o.transcript = item.transcript;
      return o;
    }
    case 'group':
      return { kind: 'group', items: item.items.map(itemToJson), ...locked };
  }
}

export async function serializeNNote(file: NNoteFile): Promise<Blob> {
  const zip = new JSZip();
  const manifest = {
    format: 'nnote',
    version: 1,
    dpi: file.doc.dpi,
    is_board: file.doc.is_board,
    has_pdf: file.doc.has_pdf,
    style: file.doc.style,
    bookmarks: file.doc.bookmarks,
    audio_tracks: file.doc.audio_tracks,
    pages: file.doc.pages.map((p) => ({
      width: p.width,
      height: p.height,
      pdf_page: p.pdf_page,
      ...(p.pdf_asset ? { pdf_asset: p.pdf_asset } : {}),
      ...(p.style ? { style: p.style } : {}),
      items: p.items.map((it) => {
        const o = itemToJson(it);
        if (it.rotation) o.rotation = it.rotation;
        return o;
      }),
    })),
  };
  zip.file('manifest.json', JSON.stringify(manifest), { compression: 'DEFLATE' });
  if (file.doc.flow) zip.file('flow.xml', file.doc.flow, { compression: 'DEFLATE' });
  for (const [name, blob] of file.assets) {
    zip.file(name, blob, { compression: 'STORE' });
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
