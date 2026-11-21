import { create } from 'zustand';
import type {
  CanvasItem, EditorTool, NNoteDocument, Page, Rgba, ToolConfig,
} from '../types/model';
import { blankDocument, uid } from '../types/model';
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
  toolbarDock: 'left' | 'right' | 'top' | 'bottom';
  showGrid: boolean;
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
  setToolbarDock: (dock: 'left' | 'right' | 'top' | 'bottom') => void;
  setShowGrid: (show: boolean) => void;
  setSelection: (ids: string[]) => void;
  commit: (label: string, mutate: (pages: Page[]) => void) => void;
  addItem: (item: CanvasItem, label?: string) => void;
  replacePageItems: (items: CanvasItem[], label?: string) => void;
  undo: () => void;
  redo: () => void;
  loadDocument: (doc: NNoteDocument, assets: Map<string, Blob>, docId: string, name: string) => void;
  newDocument: () => void;
  markSaved: () => void;
  setDocName: (name: string) => void;
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
  toolbarDock: 'left',
  showGrid: true,
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
  addPage: () => set((s) => ({
    doc: { ...s.doc, pages: [...s.doc.pages, {
      width: s.doc.pages[0]?.width ?? 1190,
      height: s.doc.pages[0]?.height ?? 1684,
      pdf_page: null,
      items: [],
      uid: uid(),
    }] },
    pageIndex: s.doc.pages.length,
    dirty: true,
  })),
  deletePage: (index) => set((s) => {
    if (s.doc.pages.length <= 1) return s;
    const pages = s.doc.pages.filter((_, i) => i !== index);
    return { doc: { ...s.doc, pages }, pageIndex: Math.min(s.pageIndex, pages.length - 1), dirty: true };
  }),

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
  setToolbarDock: (toolbarDock) => set({ toolbarDock }),
  setShowGrid: (showGrid) => set({ showGrid }),
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
}));

export function currentPage(s: EditorState): Page | undefined {
  return s.doc.pages[s.pageIndex];
}

const urlCache = new Map<string, string>();
export function assetUrl(name: string): string | undefined {
  const blob = useEditor.getState().assets.get(name);
  if (!blob) return undefined;
  let url = urlCache.get(name);
  if (!url) { url = URL.createObjectURL(blob); urlCache.set(name, url); }
  return url;
}
