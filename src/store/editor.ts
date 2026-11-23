import { create } from 'zustand';
import type {
  CanvasItem, EditorTool, NNoteDocument, Page, Rgba, ShapeKind, StickyStyle, TapePattern, ToolConfig,
} from '../types/model';
import { blankDocument, blankPage, uid } from '../types/model';
import { DEFAULT_INK, normalizeConfig } from '../lib/toolDefaults';

export type ThemeMode = 'light' | 'dark' | 'oled';

interface Snapshot {
  pages: Page[];
  label: string;
}

const HISTORY_LIMIT = 64;
const clonePages = (pages: Page[]): Page[] => structuredClone(pages);

export interface EditorState {
  docId: string;
  doc: NNoteDocument;
  assets: Map<string, Blob>;
  pageIndex: number;
  tool: EditorTool;
  ink: Rgba;
  configs: Partial<Record<EditorTool, ToolConfig>>;
  zoom: number;
  origin: { x: number; y: number };
  theme: ThemeMode;
  lang: string;
  presenting: boolean;
  vectorPdf: boolean;
  toolbarDock: 'left' | 'right' | 'top' | 'bottom';
  showGrid: boolean;
  shapeKind: ShapeKind;
  stickyStyle: StickyStyle;
  tableRows: number;
  tableCols: number;
  tapePattern: TapePattern;
  scribbleToErase: boolean;
  ruler: { visible: boolean; y: number; angle: number; locked: boolean };
  editingUid: string | null;
  selection: string[];
  history: Snapshot[];
  future: Snapshot[];
  dirty: boolean;

  setTool: (tool: EditorTool) => void;
  setInk: (ink: Rgba) => void;
  setConfig: (tool: EditorTool, patch: Partial<ToolConfig>) => void;
  configFor: (tool: EditorTool) => ToolConfig;
  setPage: (index: number) => void;
  addPage: () => void;
  deletePage: (index: number) => void;
  setZoom: (zoom: number, anchor?: { x: number; y: number }) => void;
  setOrigin: (origin: { x: number; y: number }) => void;
  setTheme: (theme: ThemeMode) => void;
  setLang: (lang: string) => void;
  setPresenting: (presenting: boolean) => void;
  setVectorPdf: (vector: boolean) => void;
  setToolbarDock: (dock: 'left' | 'right' | 'top' | 'bottom') => void;
  setShowGrid: (show: boolean) => void;
  setShapeKind: (kind: ShapeKind) => void;
  setStickyStyle: (style: StickyStyle) => void;
  setTableDims: (rows: number, cols: number) => void;
  setTapePattern: (pattern: TapePattern) => void;
  setScribbleToErase: (enabled: boolean) => void;
  setRuler: (ruler: Partial<EditorState['ruler']>) => void;
  setEditingUid: (uid: string | null) => void;
  setSelection: (ids: string[]) => void;
  commit: (label: string, mutate: (pages: Page[]) => void) => void;
  addAssets: (entries: Map<string, Blob>) => void;
  addItem: (item: CanvasItem, label?: string) => void;
  replacePageItems: (items: CanvasItem[], label?: string) => void;
  undo: () => void;
  redo: () => void;
  loadDocument: (doc: NNoteDocument, assets: Map<string, Blob>, docId: string, name: string) => void;
  newDocument: () => void;
  markSaved: () => void;
  setDocName: (name: string) => void;
  addBookmark: (page: number, label: string) => void;
  removeBookmark: (index: number) => void;
  setFlow: (text: string) => void;
}

export const useEditor = create<EditorState>()((set, get) => ({
  docId: uid(),
  doc: blankDocument(),
  assets: new Map(),
  pageIndex: 0,
  tool: 'pen',
  ink: DEFAULT_INK,
  configs: {},
  zoom: 0.6,
  origin: { x: 40, y: 40 },
  theme: 'dark',
  lang: 'en',
  presenting: false,
  vectorPdf: true,
  toolbarDock: 'left',
  showGrid: true,
  shapeKind: 'rectangle',
  stickyStyle: 'lined',
  tableRows: 3,
  tableCols: 3,
  tapePattern: 'translucent',
  scribbleToErase: false,
  ruler: { visible: false, y: 300, angle: 0, locked: false },
  editingUid: null,
  selection: [],
  history: [],
  future: [],
  dirty: false,

  setTool: (tool) => set({ tool, selection: [] }),
  setInk: (ink) => set((s) => {
    const tool = s.tool;
    return { ink, configs: { ...s.configs, [tool]: { ...get().configFor(tool), rgba: ink } } };
  }),
  setConfig: (tool, patch) => set((s) => ({
    configs: { ...s.configs, [tool]: { ...get().configFor(tool), ...patch } },
  })),
  configFor: (tool) => normalizeConfig(get().configs[tool], tool),

  setPage: (index) => set((s) => ({
    pageIndex: Math.max(0, Math.min(s.doc.pages.length - 1, index)),
    selection: [],
  })),
  addPage: () => {
    const nextIndex = get().doc.pages.length;
    get().commit('Add page', (pages) => { pages.push(blankPage()); });
    set({ pageIndex: nextIndex });
  },
  deletePage: (index) => {
    if (get().doc.pages.length <= 1) return;
    get().commit('Delete page', (pages) => { if (pages[index]) pages.splice(index, 1); });
    set((s) => ({ pageIndex: Math.min(s.pageIndex, s.doc.pages.length - 1) }));
  },

  setZoom: (zoom, anchor) => set((s) => {
    const next = Math.min(16, Math.max(0.12, zoom));
    if (!anchor) return { zoom: next };
    const k = next / s.zoom;
    return {
      zoom: next,
      origin: {
        x: anchor.x - (anchor.x - s.origin.x) * k,
        y: anchor.y - (anchor.y - s.origin.y) * k,
      },
    };
  }),
  setOrigin: (origin) => set({ origin }),
  setTheme: (theme) => set({ theme }),
  setLang: (lang) => set({ lang }),
  // Presentation is fullscreen A4 viewing only — the app has no infinite board mode.
  setPresenting: (presenting) => set({ presenting }),
  setVectorPdf: (vectorPdf) => set({ vectorPdf }),
  setToolbarDock: (toolbarDock) => set({ toolbarDock }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setShapeKind: (shapeKind) => set({ shapeKind }),
  setStickyStyle: (stickyStyle) => set({ stickyStyle }),
  setTableDims: (tableRows, tableCols) => set({ tableRows, tableCols }),
  setTapePattern: (tapePattern) => set({ tapePattern }),
  setScribbleToErase: (scribbleToErase) => set({ scribbleToErase }),
  setRuler: (patch) => set((s) => ({ ruler: { ...s.ruler, ...patch } })),
  setEditingUid: (editingUid) => set({ editingUid }),
  setSelection: (selection) => set({ selection }),

  commit: (label, mutate) => set((s) => {
    const before = clonePages(s.doc.pages);
    const pages = clonePages(s.doc.pages);
    mutate(pages);
    return {
      doc: { ...s.doc, pages },
      history: [...s.history, { pages: before, label }].slice(-HISTORY_LIMIT),
      future: [],
      dirty: true,
    };
  }),

  addAssets: (entries) => set((s) => ({
    assets: new Map([...s.assets, ...entries]),
    dirty: true,
  })),

  addItem: (item, label = 'Add') => get().commit(label, (pages) => {
    const page = pages[get().pageIndex];
    if (page) page.items.push(item);
  }),

  replacePageItems: (items, label = 'Edit') => get().commit(label, (pages) => {
    const page = pages[get().pageIndex];
    if (page) page.items = items;
  }),

  undo: () => set((s) => {
    if (!s.history.length) return s;
    const snap = s.history[s.history.length - 1];
    return {
      doc: { ...s.doc, pages: snap.pages },
      history: s.history.slice(0, -1),
      future: [...s.future, { pages: clonePages(s.doc.pages), label: snap.label }],
      pageIndex: Math.min(s.pageIndex, snap.pages.length - 1),
      selection: [],
      dirty: true,
    };
  }),

  redo: () => set((s) => {
    if (!s.future.length) return s;
    const snap = s.future[s.future.length - 1];
    return {
      doc: { ...s.doc, pages: snap.pages },
      future: s.future.slice(0, -1),
      history: [...s.history, { pages: clonePages(s.doc.pages), label: snap.label }].slice(-HISTORY_LIMIT),
      pageIndex: Math.min(s.pageIndex, snap.pages.length - 1),
      selection: [],
      dirty: true,
    };
  }),

  loadDocument: (doc, assets, docId, name) => set({
    doc: { ...doc, name },
    assets,
    docId,
    pageIndex: 0,
    selection: [],
    history: [],
    future: [],
    dirty: false,
  }),
  newDocument: () => set({
    docId: uid(),
    doc: blankDocument(),
    assets: new Map(),
    pageIndex: 0,
    selection: [],
    history: [],
    future: [],
    dirty: false,
  }),
  markSaved: () => set({ dirty: false }),
  setDocName: (name) => set((s) => ({ doc: { ...s.doc, name }, dirty: true })),
  addBookmark: (page, label) => set((s) => {
    if (s.doc.bookmarks.some((b) => b.page === page)) return s;
    return { doc: { ...s.doc, bookmarks: [...s.doc.bookmarks, { page, label }] }, dirty: true };
  }),
  removeBookmark: (index) => set((s) => ({
    doc: { ...s.doc, bookmarks: s.doc.bookmarks.filter((_, i) => i !== index) }, dirty: true,
  })),
  setFlow: (text) => set((s) => ({ doc: { ...s.doc, flow: text }, dirty: true })),
}));

export function currentPage(s: EditorState): Page | undefined {
  return s.doc.pages[s.pageIndex];
}

// Keyed by the blob itself so reopening a document (which replaces the asset map)
// never hands back a URL that points at the previous document's bytes.
const urlCache = new WeakMap<Blob, string>();
export function assetUrl(name: string): string | undefined {
  const blob = useEditor.getState().assets.get(name);
  if (!blob) return undefined;
  let url = urlCache.get(blob);
  if (!url) { url = URL.createObjectURL(blob); urlCache.set(blob, url); }
  return url;
}
