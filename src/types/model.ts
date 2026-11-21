/**
 * Runtime model mirroring the `.nnote` manifest schema.
 * All geometry is in page-local content pixels. Colours are 0..255 RGBA tuples.
 */

export type Rgba = [number, number, number, number];
export type Pt = [number, number];
export type Rect = [number, number, number, number];
/** [x, y, pressure] or [x, y, pressure, relative-time-ms] */
export type StrokeSample = [number, number, number] | [number, number, number, number];

export type InkTool =
  | 'pen'
  | 'pencil'
  | 'dashed'
  | 'calligraphy'
  | 'speed'
  | 'taper'
  | 'highlighter';

export type EditorTool =
  | InkTool
  | 'eraser'
  | 'pan'
  | 'select'
  | 'lasso'
  | 'shape'
  | 'text'
  | 'image'
  | 'tape'
  | 'screenshot';

export type EraseMode = 'stroke' | 'area';

export interface ToolConfig {
  base_width: number;
  pressure_enabled: boolean;
  pressure_min_factor: number;
  direction_strength: number;
  rgba: Rgba;
  speed_strength: number;
  taper_enabled: boolean;
  taper_min_factor: number;
  neon: boolean;
  neon_strength: number;
  dash_length: number;
  dash_gap: number;
  highlighter_alpha: number;
  erase_mode?: EraseMode;
  scale?: boolean;
  straight_line?: boolean;
  color_override?: Rgba | null;
  switch_back_after_erase?: boolean;
  switch_back_after_select?: boolean;
  scribble_to_erase?: boolean;
}

export interface ItemBase {
  /** Runtime identity. Never serialized. */
  uid: string;
  locked?: boolean;
}

export interface StrokeItem extends ItemBase {
  kind: 'stroke';
  tool: InkTool;
  config: ToolConfig;
  samples: StrokeSample[];
  speed_scale: number;
  straight: boolean;
  audio_time_ms?: number;
  audio_track_id?: string;
}

export interface TextItem extends ItemBase {
  kind: 'text';
  pos: Pt;
  width: number;
  height?: number;
  text: string;
  rgba: Rgba;
  point_size: number;
  font_face?: string;
  bold?: boolean;
}

export type ShapeKind =
  | 'line' | 'arrow' | 'double_arrow' | 'curved_arrow'
  | 'rectangle' | 'ellipse' | 'circle' | 'triangle'
  | 'diamond' | 'parallelogram' | 'trapezoid' | 'pentagon'
  | 'hexagon' | 'star' | 'heart' | 'cloud' | 'callout'
  | 'block_arrow_right' | 'block_arrow_left' | 'block_arrow_up'
  | 'block_arrow_down' | 'compass'
  | 'cube' | 'cylinder' | 'cone' | 'sphere' | 'pyramid' | 'prism'
  | 'polygon' | 'polyline' | 'curve';

export interface ShapeItem extends ItemBase {
  kind: 'shape';
  shape: ShapeKind;
  start: Pt;
  end: Pt;
  stroke_rgba: Rgba;
  stroke_width: number;
  fill_rgba: Rgba | null;
  points?: Pt[];
  neon?: boolean;
  neon_strength?: number;
}

export interface ImageItem extends ItemBase {
  kind: 'image';
  asset: string;
  rect: Rect;
  src_w: number;
  src_h: number;
  orientation?: 0 | 90 | 180 | 270;
  crop?: Rect;
}

export type TableStyle = 'grid' | 'header_accent' | 'zebra' | 'minimal_horizontal' | 'outline_only';

export interface TableItem extends ItemBase {
  kind: 'table';
  rect: Rect;
  rows: number;
  cols: number;
  row_fracs: number[];
  col_fracs: number[];
  stroke_rgba: Rgba;
  stroke_width: number;
  style: TableStyle;
  corner_radius: number;
  fills?: (Rgba | null)[];
  cell_fills?: { r: number; c: number; color: Rgba }[];
}

export type TapePattern = 'translucent' | 'stripes' | 'sparkle' | 'solid' | 'dots' | 'grid';

export interface TapeItem extends ItemBase {
  kind: 'tape';
  rect: Rect;
  color: Rgba;
  pattern: TapePattern;
  revealed: boolean;
  label: string;
  strokes: StrokeItem[];
}

export type StickyStyle = 'lined' | 'grid' | 'blank' | 'checklist';
export type Fastener = 'tape' | 'pin' | 'clean';

export interface StickyNoteItem extends ItemBase {
  kind: 'sticky_note';
  rect: Rect;
  color: Rgba;
  text: string;
  is_folded: boolean;
  style: StickyStyle;
  fastener: Fastener;
  scroll_offset: number;
  text_size?: number;
  text_color?: Rgba;
  text_bold?: boolean;
  text_face?: string;
  strokes: StrokeItem[];
}

export interface MindMapNode {
  id: string;
  text: string;
  collapsed?: boolean;
  shape?: string;
  color?: Rgba;
  font_size?: number;
  width?: number;
  icon?: string;
  children?: MindMapNode[];
}

export interface MindMapItem extends ItemBase {
  kind: 'mind_map';
  pos: Pt;
  layout: string;
  branch_style: string;
  theme: string;
  default_shape: string;
  cell_density: number;
  root: MindMapNode;
  connections?: { from: string; to: string }[];
}

export interface AudioClipItem extends ItemBase {
  kind: 'audio_clip';
  id: string;
  track_id: string;
  title: string;
  duration_ms: number;
  rect: Rect;
  color: Rgba;
}

export interface GroupItem extends ItemBase {
  kind: 'group';
  items: CanvasItem[];
}

export type CanvasItem =
  | StrokeItem
  | TextItem
  | ShapeItem
  | ImageItem
  | TableItem
  | TapeItem
  | StickyNoteItem
  | MindMapItem
  | AudioClipItem
  | GroupItem;

export type PagePattern =
  | 'none' | 'lines' | 'dots' | 'grid' | 'cornell' | 'hex'
  | 'music' | 'isometric' | 'planner' | 'engineering';

export interface PageStyle {
  page_color?: Rgba;
  pattern?: PagePattern;
  pattern_color?: Rgba;
  spacing?: number;
}

export interface Page {
  width: number;
  height: number;
  pdf_page: number | null;
  style?: PageStyle;
  items: CanvasItem[];
  /** Runtime-only page identity. */
  uid: string;
}

export interface Bookmark {
  page: number;
  label: string;
}

export interface AudioTrack {
  id: string;
  name: string;
  entry: string;
  duration_ms: number;
  created_at: number;
  transcript?: string;
}

export interface NNoteDocument {
  format: 'nnote' | 'xnote';
  version: number;
  dpi: number;
  is_board: boolean;
  has_pdf: boolean;
  style: PageStyle;
  bookmarks: Bookmark[];
  audio_tracks: AudioTrack[];
  pages: Page[];
  /** Runtime flow text (serialized to flow.xml), keyed by page index. */
  flow?: string;
  name: string;
}

export const DEFAULT_STYLE: Required<PageStyle> = {
  page_color: [255, 253, 245, 255],
  pattern: 'lines',
  pattern_color: [200, 200, 210, 100],
  spacing: 28,
};

export const A4 = { width: 1190, height: 1684 } as const;

export function uid(): string {
  return crypto.randomUUID();
}

export function blankPage(style?: PageStyle): Page {
  return {
    width: A4.width,
    height: A4.height,
    pdf_page: null,
    items: [],
    style,
    uid: uid(),
  };
}

export function blankDocument(name = 'Untitled'): NNoteDocument {
  return {
    format: 'nnote',
    version: 1,
    dpi: 150,
    is_board: false,
    has_pdf: false,
    style: { ...DEFAULT_STYLE },
    bookmarks: [],
    audio_tracks: [],
    pages: [blankPage()],
    name,
  };
}
