import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark, Brush, Check, ChevronLeft, ChevronRight, Download, Eraser, FilePlus2, Monitor,
  Pause, Play,
  FolderOpen, Hand, Highlighter, Image, Lasso, LayoutPanelLeft, LayoutPanelTop,
  Minus, Moon, MousePointer2, PanelBottom, PanelRight, Pen, Pencil, Plus, Redo2,
  Save, ScanLine, Search, Shapes, Sparkles, Sun, Trash2, Type, Undo2, X, Zap, ZoomIn, ZoomOut,
} from 'lucide-react';
import type { CanvasItem, EditorTool, ShapeKind, StickyStyle, TapePattern, ToolConfig } from './types/model';
import { hexToRgba, rgbaToHex } from './lib/geometry';
import { normalizeConfig } from './lib/toolDefaults';
import { beautifySelected } from './lib/beautify';
import { cloneItem, makeAudioClip, makeGroup, makeImage, translateItem } from './lib/items';
import { VoiceRecorder } from './lib/voice';
import { assetUrl } from './store/editor';
import { parseNNote, serializeNNote } from './lib/nnote';
import { listDocuments, loadDocument, saveDocument, setPref } from './lib/storage';
import { useEditor, type ThemeMode } from './store/editor';
import { CanvasStage } from './canvas/CanvasStage';
import { ObjectEditor } from './canvas/ObjectEditor';
import { Minimap } from './canvas/Minimap';
import { DocumentSwitcher } from './DocumentSwitcher';
import { Studio } from './Studio';
import { LANGS, toolName, useT, type Lang } from './i18n';

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
  { id: 'sticky_note', label: 'Sticky note', icon: FilePlus2 },
  { id: 'table', label: 'Table', icon: LayoutPanelTop },
  { id: 'mind_map', label: 'Mind map', icon: Shapes },
  { id: 'audio_clip', label: 'Voice note', icon: ScanLine },
  { id: 'image', label: 'Image', icon: Image },
  { id: 'tape', label: 'Study tape', icon: ScanLine },
  { id: 'screenshot', label: 'Screenshot area', icon: ScanLine },
  { id: 'magic', label: 'Disappearing ink', icon: Brush },
];

const SWATCHES = ['#00E676', '#FFB300', '#EF4444', '#22D3EE', '#A78BFA', '#9CA3AF', '#F8FAFC', '#1E293B'];

const SHAPE_KINDS: ShapeKind[] = [
  'line', 'arrow', 'double_arrow', 'curved_arrow', 'rectangle', 'ellipse', 'circle',
  'triangle', 'diamond', 'parallelogram', 'trapezoid', 'pentagon', 'hexagon', 'star',
  'heart', 'cloud', 'callout', 'block_arrow_right', 'block_arrow_left', 'block_arrow_up',
  'block_arrow_down', 'compass', 'cube', 'cylinder', 'cone', 'sphere', 'pyramid', 'prism',
];
const STICKY_STYLES: StickyStyle[] = ['lined', 'grid', 'blank', 'checklist'];
const TAPE_PATTERNS: TapePattern[] = ['translucent', 'stripes', 'sparkle', 'solid', 'dots', 'grid'];

function ToolButton({ id, icon: Icon }: { id: EditorTool; icon: typeof Pen }) {
  const active = useEditor((s) => s.tool === id);
  const setTool = useEditor((s) => s.setTool);
  const lang = useEditor((s) => s.lang);
  const label = toolName(lang as Lang, id);
  return (
    <button className={`tool-btn ${active ? 'active' : ''}`} title={label} aria-label={label} onClick={() => setTool(id)}>
      <Icon size={19} strokeWidth={1.8} />
    </button>
  );
}

function TopBar({ onSave, onExport, onOpen, onImportPdf, onExportPdf, split, setSplit, onSwitchDocs, onStudio, onPresent, presenting }: {
  onSave: () => void; onExport: () => void; onOpen: () => void;
  onImportPdf: () => void; onExportPdf: () => void; split: boolean; setSplit: (v: boolean) => void;
  onSwitchDocs: () => void; onStudio: () => void; onPresent: () => void; presenting: boolean;
}) {
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

  const t = useT();
  const lang = useEditor((s) => s.lang);
  const setLang = useEditor((s) => s.setLang);
  const nextTheme = (): ThemeMode => theme === 'dark' ? 'oled' : theme === 'oled' ? 'light' : 'dark';
  const ThemeIcon = theme === 'light' ? Sun : Moon;

  return (
    <header className="topbar">
      <div className="brand"><span className="brand-mark">N</span><span>Nnotes <b>Web</b></span></div>
      <input className="doc-name" value={name} onChange={(e) => setDocName(e.target.value)} aria-label={t('untitled')} />
      {dirty && <span className="dirty-dot" title="Unsaved changes" />}
      <div className="spacer" />
      <div className="btn-group">
        <button className="icon-btn" title={t('undo')} disabled={!canUndo} onClick={undo}><Undo2 size={17} /></button>
        <button className="icon-btn" title={t('redo')} disabled={!canRedo} onClick={redo}><Redo2 size={17} /></button>
      </div>
      <div className="btn-group">
        <button className="icon-btn" title={t('zoomOut')} onClick={() => setZoom(zoom / 1.25)}><ZoomOut size={17} /></button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button className="icon-btn" title={t('zoomIn')} onClick={() => setZoom(zoom * 1.25)}><ZoomIn size={17} /></button>
      </div>
      <div className="btn-group">
        <select className="lang-select" title={t('language')} aria-label={t('language')} value={lang}
          onChange={(e) => { setLang(e.target.value); void setPref('lang', e.target.value); }}>
          {(Object.keys(LANGS) as Lang[]).map((l) => <option key={l} value={l}>{LANGS[l]}</option>)}
        </select>
        <button className="icon-btn" title={t('docSwitcher')} onClick={onSwitchDocs}><Search size={17} /></button>
        <button className="icon-btn" title={t('newNote')} onClick={newDocument}><FilePlus2 size={17} /></button>
        <button className="icon-btn" title={t('openNote')} onClick={onOpen}><FolderOpen size={17} /></button>
        <button className={`icon-btn ${split ? 'active' : ''}`} title={t('pdfReference')} onClick={() => setSplit(!split)}><LayoutPanelLeft size={17} /></button>
        <button className="icon-btn" title={t('importPdf')} onClick={onImportPdf}><FolderOpen size={17} /></button>
        <button className="icon-btn" title={t('exportPdf')} onClick={onExportPdf}><Download size={17} /></button>
        <button className="icon-btn" title={t('save')} onClick={onSave}><Save size={17} /></button>
        <button className="icon-btn" title={t('exportNnote')} onClick={onExport}><Download size={17} /></button>
        <button className={`icon-btn ${presenting ? 'active' : ''}`} title={t('present')} onClick={onPresent}><Monitor size={17} /></button>
        <button className="icon-btn" title={t('studio')} onClick={onStudio}><Sparkles size={17} /></button>
        <button className="icon-btn" title={t('theme')} onClick={() => setTheme(nextTheme())}><ThemeIcon size={17} /></button>
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
  const shapeKind = useEditor((s) => s.shapeKind);
  const setShapeKind = useEditor((s) => s.setShapeKind);
  const stickyStyle = useEditor((s) => s.stickyStyle);
  const setStickyStyle = useEditor((s) => s.setStickyStyle);
  const tapePattern = useEditor((s) => s.tapePattern);
  const setTapePattern = useEditor((s) => s.setTapePattern);
  const tableRows = useEditor((s) => s.tableRows);
  const tableCols = useEditor((s) => s.tableCols);
  const setTableDims = useEditor((s) => s.setTableDims);
  const scribbleToErase = useEditor((s) => s.scribbleToErase);
  const setScribbleToErase = useEditor((s) => s.setScribbleToErase);
  const ruler = useEditor((s) => s.ruler);
  const setRuler = useEditor((s) => s.setRuler);
  const vectorPdf = useEditor((s) => s.vectorPdf);
  const setVectorPdf = useEditor((s) => s.setVectorPdf);
  const t = useT();
  const recorder = useRef<VoiceRecorder | null>(null);
  const [recording, setRecording] = useState(false);

  const patch = (p: Partial<ToolConfig>) => setConfig(tool, p);
  const isInk = ['pen', 'pencil', 'dashed', 'calligraphy', 'speed', 'taper', 'highlighter'].includes(tool);

  const startRecording = async () => {
    try {
      const r = new VoiceRecorder();
      await r.start();
      recorder.current = r;
      setRecording(true);
    } catch {
      window.dispatchEvent(new CustomEvent('nnotes-toast', { detail: 'Microphone permission denied' }));
    }
  };

  const stopRecording = async () => {
    const r = recorder.current;
    if (!r) return;
    const { blob, transcript } = await r.stop();
    recorder.current = null;
    setRecording(false);
    const s = useEditor.getState();
    const asset = `assets/audio-${Date.now()}.webm`;
    s.addAssets(new Map([[asset, blob]]));
    const host = document.querySelector('.canvas-wrap')?.getBoundingClientRect();
    const center: [number, number] = [
      (-s.origin.x + (host?.width ?? 800) / 2) / s.zoom,
      (-s.origin.y + (host?.height ?? 600) / 2) / s.zoom,
    ];
    const clip = makeAudioClip([center[0] - 120, center[1] - 27, 240, 54]);
    clip.audio_asset = asset;
    clip.transcript = transcript;
    s.addItem(clip, 'Voice note');
    assetUrl(asset);
  };

  return (
    <aside className="tool-panel">
      <div className="panel-heading">{t('tools')}</div>
      <div className="tool-grid">
        {INK_TOOLS.map((t) => <ToolButton key={t.id} {...t} />)}
        <div className="tool-divider" />
        {OTHER_TOOLS.map((t) => <ToolButton key={t.id} {...t} />)}
      </div>

      <div className="panel-heading">{t('dock')}</div>
      <div className="dock-grid">
        <button className={`icon-btn ${dock === 'left' ? 'active' : ''}`} title="Dock left" onClick={() => setDock('left')}><LayoutPanelLeft size={16} /></button>
        <button className={`icon-btn ${dock === 'right' ? 'active' : ''}`} title="Dock right" onClick={() => setDock('right')}><PanelRight size={16} /></button>
        <button className={`icon-btn ${dock === 'top' ? 'active' : ''}`} title="Dock top" onClick={() => setDock('top')}><LayoutPanelTop size={16} /></button>
        <button className={`icon-btn ${dock === 'bottom' ? 'active' : ''}`} title="Dock bottom" onClick={() => setDock('bottom')}><PanelBottom size={16} /></button>
      </div>

      {isInk && (
        <>
          <div className="panel-heading">{t('ink')}</div>
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
              // Only commit complete 3/6-digit hex values so partially typed input can't
              // store NaN channels in the tool config.
              if (!/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(e.target.value.trim())) return;
              const c = hexToRgba(e.target.value);
              setInk(c);
              patch({ rgba: c });
            }} />
          </label>
          <label className="slider-field">
            <span>{t('width')} <b>{config.base_width.toFixed(1)}</b></span>
            <input type="range" min={0.5} max={tool === 'highlighter' ? 40 : tool === 'pencil' ? 16 : 20} step={0.5}
              value={config.base_width} onChange={(e) => patch({ base_width: Number(e.target.value) })} />
          </label>
          <Toggle label={t('pressure')} checked={config.pressure_enabled} onChange={(v) => patch({ pressure_enabled: v })} />
          <Toggle label={t('neonGlow')} checked={config.neon} onChange={(v) => patch({ neon: v })} />
          {config.neon && (
            <label className="slider-field">
              <span>{t('neonGlow')} <b>{Math.round(config.neon_strength * 100)}</b></span>
              <input type="range" min={0} max={1} step={0.05} value={config.neon_strength}
                onChange={(e) => patch({ neon_strength: Number(e.target.value) })} />
            </label>
          )}
          {tool === 'dashed' && (
            <>
              <label className="slider-field"><span>{t('dash')} <b>{config.dash_length}</b></span>
                <input type="range" min={2} max={40} step={1} value={config.dash_length} onChange={(e) => patch({ dash_length: Number(e.target.value) })} /></label>
              <label className="slider-field"><span>{t('gap')} <b>{config.dash_gap}</b></span>
                <input type="range" min={2} max={40} step={1} value={config.dash_gap} onChange={(e) => patch({ dash_gap: Number(e.target.value) })} /></label>
            </>
          )}
          {tool === 'calligraphy' && (
            <label className="slider-field"><span>{t('nib')} <b>{config.direction_strength.toFixed(2)}</b></span>
              <input type="range" min={0} max={0.95} step={0.05} value={config.direction_strength} onChange={(e) => patch({ direction_strength: Number(e.target.value) })} /></label>
          )}
          {tool === 'speed' && (
            <label className="slider-field"><span>{t('speed')} <b>{config.speed_strength.toFixed(2)}</b></span>
              <input type="range" min={0} max={0.92} step={0.04} value={config.speed_strength} onChange={(e) => patch({ speed_strength: Number(e.target.value) })} /></label>
          )}
          {tool === 'taper' && (
            <Toggle label={t('taper')} checked={config.taper_enabled} onChange={(v) => patch({ taper_enabled: v })} />
          )}
          {tool === 'highlighter' && (
            <label className="slider-field"><span>{t('opacity')} <b>{Math.round(config.highlighter_alpha * 100)}%</b></span>
              <input type="range" min={0.1} max={0.9} step={0.05} value={config.highlighter_alpha} onChange={(e) => patch({ highlighter_alpha: Number(e.target.value) })} /></label>
          )}
          <Toggle label={t('constantSize')} checked={config.scale === false} onChange={(v) => patch({ scale: !v })} />
        </>
      )}
      {tool === 'eraser' && (
        <>
          <div className="panel-heading">{t('eraser')}</div>
          <label className="slider-field"><span>{t('radius')} <b>{config.base_width.toFixed(0)}</b></span>
            <input type="range" min={1} max={80} step={1} value={config.base_width} onChange={(e) => patch({ base_width: Number(e.target.value) })} /></label>
          <div className="segmented">
            {(['stroke', 'area'] as const).map((m) => (
              <button key={m} className={(config.erase_mode ?? 'area') === m ? 'active' : ''} onClick={() => patch({ erase_mode: m })}>{m}</button>
            ))}
          </div>
        </>
      )}
      {tool === 'shape' && (
        <>
          <div className="panel-heading">{t('shape')} · {shapeKind}</div>
          <div className="chip-grid">
            {SHAPE_KINDS.map((k) => (
              <button key={k} className={`chip ${shapeKind === k ? 'active' : ''}`} onClick={() => setShapeKind(k)}>{k.replace(/_/g, ' ')}</button>
            ))}
          </div>
        </>
      )}
      {tool === 'sticky_note' && (
        <>
          <div className="panel-heading">{t('stickyStyle')}</div>
          <div className="chip-grid">
            {STICKY_STYLES.map((k) => <button key={k} className={`chip ${stickyStyle === k ? 'active' : ''}`} onClick={() => setStickyStyle(k)}>{k}</button>)}
          </div>
        </>
      )}
      {tool === 'tape' && (
        <>
          <div className="panel-heading">{t('tapePattern')}</div>
          <div className="chip-grid">
            {TAPE_PATTERNS.map((k) => <button key={k} className={`chip ${tapePattern === k ? 'active' : ''}`} onClick={() => setTapePattern(k)}>{k}</button>)}
          </div>
        </>
      )}
      {tool === 'audio_clip' && (
        <>
          <div className="panel-heading">{t('audioClip')}</div>
          <button className="record-btn" onClick={recording ? stopRecording : startRecording}>
            {recording ? <><Pause size={15} /> {t('stopRecording')}</> : <><Play size={15} /> {t('record')}</>}
          </button>
          <div className="panel-note">{t('recordHint')}</div>
        </>
      )}
      {tool === 'table' && (
        <>
          <div className="panel-heading">{t('tableSize')}</div>
          <label className="slider-field"><span>{t('rows')} <b>{tableRows}</b></span><input type="range" min={1} max={12} value={tableRows} onChange={(e) => setTableDims(Number(e.target.value), tableCols)} /></label>
          <label className="slider-field"><span>{t('columns')} <b>{tableCols}</b></span><input type="range" min={1} max={12} value={tableCols} onChange={(e) => setTableDims(tableRows, Number(e.target.value))} /></label>
        </>
      )}
      {tool === 'pen' && (
        <>
          <div className="panel-heading">{t('gestures')}</div>
          <Toggle label={t('scribbleToErase')} checked={scribbleToErase} onChange={setScribbleToErase} />
          <div className="panel-note">{t('gesturesHint')}</div>
        </>
      )}
      <div className="panel-heading">{t('export')}</div>
      <Toggle label={t('vectorPdf')} checked={vectorPdf} onChange={setVectorPdf} />
      <div className="panel-heading">{t('ruler')}</div>
      <Toggle label={t('showRuler')} checked={ruler.visible} onChange={(v) => setRuler({ visible: v })} />
      {ruler.visible && (
        <>
          <Toggle label={t('lockRuler')} checked={ruler.locked} onChange={(v) => setRuler({ locked: v })} />
          <label className="slider-field"><span>{t('rotate')} <b>{Math.round(ruler.angle)}°</b></span><input type="range" min={-90} max={90} value={ruler.angle} onChange={(e) => setRuler({ angle: Number(e.target.value) })} /></label>
        </>
      )}
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
  const bookmarks = useEditor((s) => s.doc.bookmarks);
  const addBookmark = useEditor((s) => s.addBookmark);
  const removeBookmark = useEditor((s) => s.removeBookmark);
  const flow = useEditor((s) => s.doc.flow ?? '');
  const setFlow = useEditor((s) => s.setFlow);
  const t = useT();
  const [open, setOpen] = useState(true);
  return (
    <aside className={`page-panel ${open ? '' : 'collapsed'}`}>
      <button className="panel-toggle" onClick={() => setOpen(!open)}>{open ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
      {open && (
        <>
          <div className="panel-heading">{t('pages')} · {pages.length}</div>
          <div className="page-list">
            {pages.map((p, i) => (
              <button key={p.uid} className={`page-item ${i === pageIndex ? 'active' : ''}`} onClick={() => setPage(i)}>
                <span className="page-thumb">{i + 1}</span>
                <span>{t('page')} {i + 1}<small>{p.items.length} {t('items')}</small></span>
              </button>
            ))}
          </div>
          <div className="page-actions">
            <button className="icon-btn" title={t('addPage')} onClick={addPage}><Plus size={16} /></button>
            <button className="icon-btn" title={t('deletePage')} disabled={pages.length <= 1} onClick={() => deletePage(pageIndex)}><Trash2 size={16} /></button>
            <button className="icon-btn" title={t('bookmark')} onClick={() => addBookmark(pageIndex, `${t('page')} ${pageIndex + 1}`)}><Bookmark size={16} /></button>
          </div>
          {bookmarks.length > 0 && (
            <>
              <div className="panel-heading">{t('bookmarks')}</div>
              {bookmarks.map((b, i) => (
                <div key={`${b.page}-${i}`} className="bookmark-row">
                  <button onClick={() => setPage(b.page)}>{b.label}</button>
                  <button className="icon-btn" title="Remove bookmark" onClick={() => removeBookmark(i)}><X size={13} /></button>
                </div>
              ))}
            </>
          )}
          <div className="panel-heading">{t('minimap')}</div>
          <Minimap />
          <div className="panel-heading">{t('flowText')}</div>
          <textarea className="flow-editor" placeholder={t('flowText')} value={flow} onChange={(e) => setFlow(e.target.value)} />
          <Library refreshKey={refreshKey} />
        </>
      )}
    </aside>
  );
}

function SelectionBar() {
  const selection = useEditor((s) => s.selection);
  const commit = useEditor((s) => s.commit);
  const setSelection = useEditor((s) => s.setSelection);
  const setEditingUid = useEditor((s) => s.setEditingUid);
  const t = useT();
  if (!selection.length) return null;

  const mutate = (label: string, fn: (items: CanvasItem[]) => void) => {
    commit(label, (pages) => {
      const page = pages[useEditor.getState().pageIndex];
      if (page) fn(page.items);
    });
  };

  return (
    <div className="selection-bar">
      <span>{selection.length} {t('selected')}</span>
      <button title={t('duplicate')} onClick={() => {
        mutate('Duplicate', (items) => {
          const copies = items.filter((i) => selection.includes(i.uid)).map((i) => {
            const c = cloneItem(i);
            c.rotation = i.rotation;
            translateItem(c, 24, 24);
            return c;
          });
          items.push(...copies);
        });
        setSelection([]);
      }}>{t('duplicate')}</button>
      <button title={t('group')} onClick={() => {
        mutate('Group', (items) => {
          const chosen = items.filter((i) => selection.includes(i.uid));
          const rest = items.filter((i) => !selection.includes(i.uid));
          items.splice(0, items.length, ...rest, makeGroup(chosen.map((i) => cloneItem(i))));
        });
        setSelection([]);
      }}>{t('group')}</button>
      <button title={t('front')} onClick={() => mutate('Bring to front', (items) => {
        const chosen = items.filter((i) => selection.includes(i.uid));
        items.splice(0, items.length, ...items.filter((i) => !selection.includes(i.uid)), ...chosen);
      })}>{t('front')}</button>
      <button title={t('back')} onClick={() => mutate('Send to back', (items) => {
        const chosen = items.filter((i) => selection.includes(i.uid));
        items.splice(0, items.length, ...chosen, ...items.filter((i) => !selection.includes(i.uid)));
      })}>{t('back')}</button>
      <button title={t('beautify')} onClick={() => {
        mutate('Beautify', (items) => items.splice(0, items.length, ...beautifySelected(items, selection)));
      }}><Sparkles size={13} /> {t('beautify')}</button>
      <button title={t('rotate')} onClick={() => mutate('Rotate', (items) => items.forEach((i) => { if (selection.includes(i.uid)) i.rotation = (i.rotation ?? 0) + 90; }))}>{t('rotate')}</button>
      <button title={t('edit')} onClick={() => setEditingUid(selection[0])}>{t('edit')}</button>
      <button className="danger" title={t('delete')} onClick={() => {
        mutate('Delete', (items) => items.splice(0, items.length, ...items.filter((i) => !selection.includes(i.uid))));
        setSelection([]);
      }}>{t('delete')}</button>
    </div>
  );
}

function SplitView() {
  const pages = useEditor((s) => s.doc.pages);
  const pageIndex = useEditor((s) => s.pageIndex);
  const setPage = useEditor((s) => s.setPage);
  const t = useT();
  const pdfPages = pages.map((p, i) => ({ p, i })).filter(({ p }) => p.pdf_asset);
  if (!pdfPages.length) return <aside className="split-view"><div className="panel-heading">{t('pdfReference')}</div><div className="panel-note">{t('importPdfHint')}</div></aside>;
  return (
    <aside className="split-view">
      <div className="panel-heading">PDF · {pdfPages.length} {t('pages')}</div>
      <div className="pdf-thumbs">
        {pdfPages.map(({ p, i }) => {
          const url = p.pdf_asset ? assetUrl(p.pdf_asset) : undefined;
          return (
            <button key={p.uid} className={`pdf-thumb ${i === pageIndex ? 'active' : ''}`} onClick={() => setPage(i)}>
              {url && <img src={url} alt={`PDF page ${i + 1}`} />}
              <span>{i + 1}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function Toast() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const onToast = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      setTimeout(() => setMessage(''), 2600);
    };
    window.addEventListener('nnotes-toast', onToast);
    return () => window.removeEventListener('nnotes-toast', onToast);
  }, []);
  if (!message) return null;
  return <div className="toast">{message}</div>;
}

function StatusBar() {
  const pageIndex = useEditor((s) => s.pageIndex);
  const pages = useEditor((s) => s.doc.pages.length);
  const tool = useEditor((s) => s.tool);
  const zoom = useEditor((s) => s.zoom);
  const selection = useEditor((s) => s.selection.length);
  const t = useT();
  return (
    <footer className="statusbar">
      <span>{t('page')} {pageIndex + 1} / {pages}</span>
      <span className="dot">·</span>
      <span>{t('tool')}: {tool}</span>
      <span className="dot">·</span>
      <span>{Math.round(zoom * 100)}%</span>
      {selection > 0 && <><span className="dot">·</span><span>{selection} {t('selected')}</span></>}
      <div className="spacer" />
      <span>{t('localFirst')}</span>
    </footer>
  );
}

function Library({ refreshKey }: { refreshKey: number }) {
  const [docs, setDocs] = useState<{ id: string; name: string; updatedAt: number }[]>([]);
  const load = useEditor((s) => s.loadDocument);
  const t = useT();
  useEffect(() => { listDocuments().then((all) => setDocs(all.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })))); }, [refreshKey]);
  if (!docs.length) return null;
  return (
    <div className="library">
      <div className="panel-heading">{t('recentNotes')}</div>
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
  const imageRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const pendingImageRect = useRef<[number, number, number, number] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [split, setSplit] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const [busy, setBusy] = useState('');
  const presenting = useEditor((s) => s.presenting);
  const setPresenting = useEditor((s) => s.setPresenting);
  const t = useT();

  const togglePresent = () => {
    const next = !useEditor.getState().presenting;
    setPresenting(next);
    if (next) document.querySelector('.stage-area')?.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) void document.exitFullscreen();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return;
      const s = useEditor.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo(); else s.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const copies = (s.doc.pages[s.pageIndex]?.items ?? []).filter((i) => s.selection.includes(i.uid)).map((i) => {
          const c = cloneItem(i);
          translateItem(c, 24, 24);
          return c;
        });
        if (copies.length) s.commit('Duplicate', (pages) => { pages[s.pageIndex]?.items.push(...copies); });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = s.selection;
        if (ids.length) {
          s.commit('Delete', (pages) => {
            const page = pages[s.pageIndex];
            if (page) page.items = page.items.filter((i) => !ids.includes(i.uid));
          });
          s.setSelection([]);
        }
      } else if (e.key === 'Escape') {
        if (s.presenting) togglePresent();
        s.setSelection([]);
        s.setEditingUid(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const notifyError = (e: unknown) => {
    window.dispatchEvent(new CustomEvent('nnotes-toast', {
      detail: e instanceof Error ? e.message : 'Something went wrong',
    }));
  };

  const save = async () => {
    try {
      const s = useEditor.getState();
      const blob = await serializeNNote({ doc: s.doc, assets: s.assets });
      await saveDocument(s.docId, s.doc.name || 'Untitled', blob);
      s.markSaved();
      setRefreshKey((k) => k + 1);
    } catch (e) { notifyError(e); }
  };

  const exportFile = async () => {
    try {
      const s = useEditor.getState();
      const blob = await serializeNNote({ doc: s.doc, assets: s.assets });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(s.doc.name || 'Untitled').replace(/[^\w\-]+/g, '_')}.nnote`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { notifyError(e); }
  };

  const requestImage = (rect: [number, number, number, number]) => {
    pendingImageRect.current = rect;
    imageRef.current?.click();
  };

  const insertImage = async (file: File) => {
    try {
      const rect = pendingImageRect.current ?? [40, 40, 320, 220];
      const buffer = await file.arrayBuffer();
      const asset = `assets/image-${Date.now()}.png`;
      const s = useEditor.getState();
      s.addAssets(new Map([[asset, new Blob([buffer], { type: file.type || 'image/png' })]]));
      s.addItem(makeImage(rect, asset, 1000, 1000), 'Add image');
      assetUrl(asset);
      pendingImageRect.current = null;
    } catch (e) { notifyError(e); }
  };

  const importPdfFile = async (file: File) => {
    setBusy('Importing PDF…');
    try {
      const { importPdf } = await import('./lib/pdf');
      const result = await importPdf(file);
      const s = useEditor.getState();
      const assets = new Map(s.assets);
      result.assets.forEach((v, k) => assets.set(k, v));
      const firstNewPage = s.doc.pages.length;
      s.loadDocument({
        ...s.doc,
        has_pdf: true,
        pages: [...s.doc.pages, ...result.pages],
        bookmarks: [...s.doc.bookmarks, { page: firstNewPage, label: file.name }],
      }, assets, s.docId, s.doc.name);
      useEditor.getState().setPage(firstNewPage);
      setSplit(true);
      setRefreshKey((k) => k + 1);
    } catch (e) { notifyError(e); }
    finally { setBusy(''); }
  };

  const exportPdfFile = async () => {
    setBusy('Exporting PDF…');
    try {
      const s = useEditor.getState();
      const blob = s.vectorPdf
        ? await (await import('./lib/pdfVector')).exportPdfVector(s.doc, s.doc.name || 'Untitled', s.theme)
        : await (await import('./lib/pdf')).exportPdf(s.doc, s.doc.name || 'Untitled', s.theme);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(s.doc.name || 'Untitled').replace(/[^\w\-]+/g, '_')}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { notifyError(e); }
    finally { setBusy(''); }
  };

  const openFile = async (file: File) => {
    setBusy('Opening note…');
    try {
      const parsed = await parseNNote(await file.arrayBuffer());
      const s = useEditor.getState();
      s.loadDocument(parsed.doc, parsed.assets, s.docId, file.name.replace(/\.nnote$/i, ''));
    } catch (e) { notifyError(e); }
    finally { setBusy(''); }
  };

  return (
    <div className={`app ${presenting ? 'presenting' : ''}`}>
      <TopBar
        onSave={save} onExport={exportFile} onOpen={() => fileRef.current?.click()}
        onImportPdf={() => pdfRef.current?.click()} onExportPdf={exportPdfFile}
        split={split} setSplit={setSplit}
        onSwitchDocs={() => setShowSwitcher(true)}
        onStudio={() => setShowStudio(true)}
        onPresent={togglePresent} presenting={presenting}
      />
      <input ref={fileRef} type="file" accept=".nnote,.xnote" hidden onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void openFile(f);
        e.target.value = '';
      }} />
      <input ref={pdfRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void importPdfFile(f);
        e.target.value = '';
      }} />
      <input ref={imageRef} type="file" accept="image/*" hidden onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void insertImage(f);
        e.target.value = '';
      }} />
      <div className={`workspace dock-${dock}`}>
        {dock === 'top' && <ToolPanel />}
        <div className="workspace-row">
          {dock === 'left' && <ToolPanel />}
          <main className="stage-area">
            <CanvasStage onRequestImage={requestImage} />
            <ObjectEditor />
            <SelectionBar />
            {presenting && (
              <button className="exit-present" title={t('exitPresent')} onClick={togglePresent}><X size={18} /> {t('exitPresent')}</button>
            )}
          </main>
          {split && <SplitView />}
          {dock === 'right' && <ToolPanel />}
          <PagePanel refreshKey={refreshKey} />
        </div>
        {dock === 'bottom' && <ToolPanel />}
      </div>
      <StatusBar />
      <Toast />
      {busy && <div className="busy-overlay"><div className="busy-card">{busy}</div></div>}
      {showSwitcher && <DocumentSwitcher onClose={() => { setShowSwitcher(false); setRefreshKey((k) => k + 1); }} />}
      {showStudio && <Studio onClose={() => setShowStudio(false)} />}
    </div>
  );
}

export { Library };
