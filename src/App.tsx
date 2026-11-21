import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brush, Check, ChevronLeft, ChevronRight, Download, Eraser, FilePlus2,
  FolderOpen, Hand, Highlighter, Image, Lasso, LayoutPanelLeft, LayoutPanelTop,
  Minus, Moon, MousePointer2, PanelBottom, PanelRight, Pen, Pencil, Plus, Redo2,
  Save, ScanLine, Shapes, Sun, Trash2, Type, Undo2, Zap, ZoomIn, ZoomOut,
} from 'lucide-react';
import type { EditorTool, ToolConfig } from './types/model';
import { hexToRgba, rgbaToHex } from './lib/geometry';
import { normalizeConfig } from './lib/toolDefaults';
import { parseNNote, serializeNNote } from './lib/nnote';
import { listDocuments, loadDocument, saveDocument } from './lib/storage';
import { useEditor, type ThemeMode } from './store/editor';
import { CanvasStage } from './canvas/CanvasStage';

const INK_TOOLS: { id: EditorTool; label: string; icon: typeof Pen }[] = [
  { id: 'pen', label: 'Ballpoint pen', icon: Pen },
  { id: 'pencil', label: 'Graphite pencil', icon: Pencil },
  { id: 'dashed', label: 'Dashed pen', icon: Minus },
  { id: 'calligraphy', label: 'Calligraphy brush', icon: Brush },
  { id: 'speed', label: 'Speed pen', icon: Zap },
  { id: 'taper', label: 'Taper pen', icon: Pen },
  { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
];

const OTHER_TOOLS: { id: EditorTool; label: string; icon: typeof Pen }[] = [
  { id: 'eraser', label: 'Eraser', icon: Eraser },
  { id: 'pan', label: 'Pan', icon: Hand },
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'lasso', label: 'Lasso', icon: Lasso },
  { id: 'shape', label: 'Shapes', icon: Shapes },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'image', label: 'Image', icon: Image },
  { id: 'tape', label: 'Study tape', icon: ScanLine },
];

const SWATCHES = ['#00E676', '#FFB300', '#EF4444', '#22D3EE', '#A78BFA', '#9CA3AF', '#F8FAFC', '#1E293B'];

function ToolButton({ id, label, icon: Icon }: { id: EditorTool; label: string; icon: typeof Pen }) {
  const active = useEditor((s) => s.tool === id);
  const setTool = useEditor((s) => s.setTool);
  return (
    <button className={`tool-btn ${active ? 'active' : ''}`} title={label} aria-label={label} onClick={() => setTool(id)}>
      <Icon size={19} strokeWidth={1.8} />
    </button>
  );
}

function TopBar({ onSave, onExport, onOpen }: { onSave: () => void; onExport: () => void; onOpen: () => void }) {
  const name = useEditor((s) => s.doc.name);
  const dirty = useEditor((s) => s.dirty);
  const setDocName = useEditor((s) => s.setDocName);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.history.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const theme = useEditor((s) => s.theme);
  const setTheme = useEditor((s) => s.setTheme);
  const newDocument = useEditor((s) => s.newDocument);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);

  const nextTheme = (): ThemeMode => theme === 'dark' ? 'oled' : theme === 'oled' ? 'light' : 'dark';
  const ThemeIcon = theme === 'light' ? Sun : Moon;

  return (
    <header className="topbar">
      <div className="brand"><span className="brand-mark">N</span><span>Nnotes <b>Web</b></span></div>
      <input className="doc-name" value={name} onChange={(e) => setDocName(e.target.value)} aria-label="Document name" />
      {dirty && <span className="dirty-dot" title="Unsaved changes" />}
      <div className="spacer" />
      <div className="btn-group">
        <button className="icon-btn" title="Undo" disabled={!canUndo} onClick={undo}><Undo2 size={17} /></button>
        <button className="icon-btn" title="Redo" disabled={!canRedo} onClick={redo}><Redo2 size={17} /></button>
      </div>
      <div className="btn-group">
        <button className="icon-btn" title="Zoom out" onClick={() => setZoom(zoom / 1.25)}><ZoomOut size={17} /></button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button className="icon-btn" title="Zoom in" onClick={() => setZoom(zoom * 1.25)}><ZoomIn size={17} /></button>
      </div>
      <div className="btn-group">
        <button className="icon-btn" title="New note" onClick={newDocument}><FilePlus2 size={17} /></button>
        <button className="icon-btn" title="Open .nnote" onClick={onOpen}><FolderOpen size={17} /></button>
        <button className="icon-btn" title="Save to browser" onClick={onSave}><Save size={17} /></button>
        <button className="icon-btn" title="Export .nnote" onClick={onExport}><Download size={17} /></button>
        <button className="icon-btn" title="Switch theme" onClick={() => setTheme(nextTheme())}><ThemeIcon size={17} /></button>
      </div>
    </header>
  );
}

function ToolPanel() {
  const tool = useEditor((s) => s.tool);
  const configs = useEditor((s) => s.configs);
  const config = useMemo(() => normalizeConfig(configs[tool], tool), [configs, tool]);
  const setConfig = useEditor((s) => s.setConfig);
  const setInk = useEditor((s) => s.setInk);
  const dock = useEditor((s) => s.toolbarDock);
  const setDock = useEditor((s) => s.setToolbarDock);

  const patch = (p: Partial<ToolConfig>) => setConfig(tool, p);
  const isInk = ['pen', 'pencil', 'dashed', 'calligraphy', 'speed', 'taper', 'highlighter'].includes(tool);

  return (
    <aside className="tool-panel">
      <div className="panel-heading">TOOLS</div>
      <div className="tool-grid">
        {INK_TOOLS.map((t) => <ToolButton key={t.id} {...t} />)}
        <div className="tool-divider" />
        {OTHER_TOOLS.map((t) => <ToolButton key={t.id} {...t} />)}
      </div>

      <div className="panel-heading">DOCK</div>
      <div className="dock-grid">
        <button className={`icon-btn ${dock === 'left' ? 'active' : ''}`} title="Dock left" onClick={() => setDock('left')}><LayoutPanelLeft size={16} /></button>
        <button className={`icon-btn ${dock === 'right' ? 'active' : ''}`} title="Dock right" onClick={() => setDock('right')}><PanelRight size={16} /></button>
        <button className={`icon-btn ${dock === 'top' ? 'active' : ''}`} title="Dock top" onClick={() => setDock('top')}><LayoutPanelTop size={16} /></button>
        <button className={`icon-btn ${dock === 'bottom' ? 'active' : ''}`} title="Dock bottom" onClick={() => setDock('bottom')}><PanelBottom size={16} /></button>
      </div>

      {isInk && (
        <>
          <div className="panel-heading">INK</div>
          <div className="swatch-row">
            {SWATCHES.map((h) => {
              const c = hexToRgba(h);
              const active = c[0] === config.rgba[0] && c[1] === config.rgba[1] && c[2] === config.rgba[2];
              return (
                <button
                  key={h}
                  className={`swatch ${active ? 'active' : ''}`}
                  style={{ background: h }}
                  title={h}
                  onClick={() => { setInk(c); patch({ rgba: c }); }}
                >{active && <Check size={12} />}</button>
              );
            })}
          </div>
          <label className="hex-field">
            <span>HEX</span>
            <input value={rgbaToHex(config.rgba)} onChange={(e) => {
              try { const c = hexToRgba(e.target.value); setInk(c); patch({ rgba: c }); } catch { /* ignore partial input */ }
            }} />
          </label>
          <label className="slider-field">
            <span>Width <b>{config.base_width.toFixed(1)}</b></span>
            <input type="range" min={0.5} max={tool === 'highlighter' ? 40 : tool === 'pencil' ? 16 : 20} step={0.5}
              value={config.base_width} onChange={(e) => patch({ base_width: Number(e.target.value) })} />
          </label>
          <Toggle label="Pressure" checked={config.pressure_enabled} onChange={(v) => patch({ pressure_enabled: v })} />
          <Toggle label="Neon glow" checked={config.neon} onChange={(v) => patch({ neon: v })} />
          {config.neon && (
            <label className="slider-field">
              <span>Glow <b>{Math.round(config.neon_strength * 100)}</b></span>
              <input type="range" min={0} max={1} step={0.05} value={config.neon_strength}
                onChange={(e) => patch({ neon_strength: Number(e.target.value) })} />
            </label>
          )}
          {tool === 'dashed' && (
            <>
              <label className="slider-field"><span>Dash <b>{config.dash_length}</b></span>
                <input type="range" min={2} max={40} step={1} value={config.dash_length} onChange={(e) => patch({ dash_length: Number(e.target.value) })} /></label>
              <label className="slider-field"><span>Gap <b>{config.dash_gap}</b></span>
                <input type="range" min={2} max={40} step={1} value={config.dash_gap} onChange={(e) => patch({ dash_gap: Number(e.target.value) })} /></label>
            </>
          )}
          {tool === 'calligraphy' && (
            <label className="slider-field"><span>Nib <b>{config.direction_strength.toFixed(2)}</b></span>
              <input type="range" min={0} max={0.95} step={0.05} value={config.direction_strength} onChange={(e) => patch({ direction_strength: Number(e.target.value) })} /></label>
          )}
          {tool === 'speed' && (
            <label className="slider-field"><span>Speed <b>{config.speed_strength.toFixed(2)}</b></span>
              <input type="range" min={0} max={0.92} step={0.04} value={config.speed_strength} onChange={(e) => patch({ speed_strength: Number(e.target.value) })} /></label>
          )}
          {tool === 'taper' && (
            <Toggle label="Taper" checked={config.taper_enabled} onChange={(v) => patch({ taper_enabled: v })} />
          )}
          {tool === 'highlighter' && (
            <label className="slider-field"><span>Opacity <b>{Math.round(config.highlighter_alpha * 100)}%</b></span>
              <input type="range" min={0.1} max={0.9} step={0.05} value={config.highlighter_alpha} onChange={(e) => patch({ highlighter_alpha: Number(e.target.value) })} /></label>
          )}
          <Toggle label="Constant screen size" checked={config.scale === false} onChange={(v) => patch({ scale: !v })} />
        </>
      )}
      {tool === 'eraser' && (
        <>
          <div className="panel-heading">ERASER</div>
          <label className="slider-field"><span>Radius <b>{config.base_width.toFixed(0)}</b></span>
            <input type="range" min={1} max={80} step={1} value={config.base_width} onChange={(e) => patch({ base_width: Number(e.target.value) })} /></label>
          <div className="segmented">
            {(['stroke', 'area'] as const).map((m) => (
              <button key={m} className={(config.erase_mode ?? 'area') === m ? 'active' : ''} onClick={() => patch({ erase_mode: m })}>{m}</button>
            ))}
          </div>
        </>
      )}
      <div className="panel-note">Tip: pinch or Ctrl+scroll to zoom · middle-drag or Pan tool to move</div>
    </aside>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="toggle-row" onClick={() => onChange(!checked)}>
      <span>{label}</span><span className={`toggle ${checked ? 'on' : ''}`}><i /></span>
    </button>
  );
}

function PagePanel({ refreshKey }: { refreshKey: number }) {
  const pages = useEditor((s) => s.doc.pages);
  const pageIndex = useEditor((s) => s.pageIndex);
  const setPage = useEditor((s) => s.setPage);
  const addPage = useEditor((s) => s.addPage);
  const deletePage = useEditor((s) => s.deletePage);
  const [open, setOpen] = useState(true);
  return (
    <aside className={`page-panel ${open ? '' : 'collapsed'}`}>
      <button className="panel-toggle" onClick={() => setOpen(!open)}>{open ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
      {open && (
        <>
          <div className="panel-heading">PAGES · {pages.length}</div>
          <div className="page-list">
            {pages.map((p, i) => (
              <button key={p.uid} className={`page-item ${i === pageIndex ? 'active' : ''}`} onClick={() => setPage(i)}>
                <span className="page-thumb">{i + 1}</span>
                <span>Page {i + 1}<small>{p.items.length} items</small></span>
              </button>
            ))}
          </div>
          <div className="page-actions">
            <button className="icon-btn" title="Add page" onClick={addPage}><Plus size={16} /></button>
            <button className="icon-btn" title="Delete page" disabled={pages.length <= 1} onClick={() => deletePage(pageIndex)}><Trash2 size={16} /></button>
          </div>
          <Library refreshKey={refreshKey} />
        </>
      )}
    </aside>
  );
}

function StatusBar() {
  const pageIndex = useEditor((s) => s.pageIndex);
  const pages = useEditor((s) => s.doc.pages.length);
  const tool = useEditor((s) => s.tool);
  const zoom = useEditor((s) => s.zoom);
  const selection = useEditor((s) => s.selection.length);
  return (
    <footer className="statusbar">
      <span>Page {pageIndex + 1} / {pages}</span>
      <span className="dot">·</span>
      <span>Tool: {tool}</span>
      <span className="dot">·</span>
      <span>{Math.round(zoom * 100)}%</span>
      {selection > 0 && <><span className="dot">·</span><span>{selection} selected</span></>}
      <div className="spacer" />
      <span>Local-first · saved in your browser</span>
    </footer>
  );
}

function Library({ refreshKey }: { refreshKey: number }) {
  const [docs, setDocs] = useState<{ id: string; name: string; updatedAt: number }[]>([]);
  const load = useEditor((s) => s.loadDocument);
  useEffect(() => { listDocuments().then((all) => setDocs(all.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })))); }, [refreshKey]);
  if (!docs.length) return null;
  return (
    <div className="library">
      <div className="panel-heading">RECENT NOTES</div>
      {docs.slice(0, 5).map((d) => (
        <button key={d.id} className="library-item" onClick={async () => {
          const rec = await loadDocument(d.id);
          if (rec) { const parsed = await parseNNote(rec.blob); load(parsed.doc, parsed.assets, d.id, d.name); }
        }}>
          <FilePlus2 size={14} /><span>{d.name}</span>
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const dock = useEditor((s) => s.toolbarDock);
  const fileRef = useRef<HTMLInputElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const save = async () => {
    const s = useEditor.getState();
    const blob = await serializeNNote({ doc: s.doc, assets: s.assets });
    await saveDocument(s.docId, s.doc.name || 'Untitled', blob);
    s.markSaved();
    setRefreshKey((k) => k + 1);
  };

  const exportFile = async () => {
    const s = useEditor.getState();
    const blob = await serializeNNote({ doc: s.doc, assets: s.assets });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(s.doc.name || 'Untitled').replace(/[^\w\-]+/g, '_')}.nnote`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openFile = async (file: File) => {
    const parsed = await parseNNote(await file.arrayBuffer());
    const s = useEditor.getState();
    s.loadDocument(parsed.doc, parsed.assets, s.docId, file.name.replace(/\.nnote$/i, ''));
  };

  return (
    <div className="app">
      <TopBar onSave={save} onExport={exportFile} onOpen={() => fileRef.current?.click()} />
      <input ref={fileRef} type="file" accept=".nnote,.xnote" hidden onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void openFile(f);
        e.target.value = '';
      }} />
      <div className={`workspace dock-${dock}`}>
        {dock === 'top' && <ToolPanel />}
        <div className="workspace-row">
          {dock === 'left' && <ToolPanel />}
          <main className="stage-area"><CanvasStage /></main>
          {dock === 'right' && <ToolPanel />}
          <PagePanel refreshKey={refreshKey} />
        </div>
        {dock === 'bottom' && <ToolPanel />}
      </div>
      <StatusBar />
    </div>
  );
}

export { Library };
