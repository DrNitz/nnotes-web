import { useEffect, useState } from 'react';
import { useEditor } from '../store/editor';
import { itemBounds } from './renderer';
import type { CanvasItem, MindMapNode } from '../types/model';

/** HTML overlay for inline editing of text, sticky notes, tables and mind-map nodes. */
export function ObjectEditor() {
  const editingUid = useEditor((s) => s.editingUid);
  const pageIndex = useEditor((s) => s.pageIndex);
  const item = useEditor((s) => s.doc.pages[s.pageIndex]?.items.find((i) => i.uid === s.editingUid));
  const zoom = useEditor((s) => s.zoom);
  const origin = useEditor((s) => s.origin);
  const theme = useEditor((s) => s.theme);
  const commit = useEditor((s) => s.commit);
  const setEditingUid = useEditor((s) => s.setEditingUid);
  const [draft, setDraft] = useState('');

  useEffect(() => { setDraft(''); }, [editingUid]);

  if (!item || !editingUid) return null;
  const bounds = itemBounds(item);
  if (!bounds) return null;
  const left = origin.x + bounds[0] * zoom;
  const top = origin.y + bounds[1] * zoom;
  const width = Math.max(120, bounds[2] * zoom);
  const height = Math.max(40, bounds[3] * zoom);

  const save = (patch: (copy: CanvasItem) => void) => {
    commit('Edit object', (pages) => {
      const target = pages[pageIndex]?.items.find((i) => i.uid === editingUid);
      if (target) patch(target);
    });
  };

  const close = () => { if (draft) save(applyDraft); setEditingUid(null); };

  function applyDraft(copy: CanvasItem) {
    if (copy.kind === 'text') copy.text = draft;
    else if (copy.kind === 'sticky_note') copy.text = draft;
  }

  const style = {
    position: 'absolute' as const,
    left, top, width, height,
    zIndex: 5,
    background: theme === 'light' ? 'rgba(255,255,255,0.97)' : 'rgba(24,26,32,0.97)',
    color: theme === 'light' ? '#1f2937' : '#e9eaee',
    border: '1px solid #38bdf8', borderRadius: 4,
    fontFamily: 'Inter, sans-serif', fontSize: Math.max(11, 13 * zoom),
    padding: 6, resize: 'none' as const, outline: 'none',
  };

  if (item.kind === 'text' || item.kind === 'sticky_note') {
    return (
      <textarea
        autoFocus
        style={style}
        value={draft || item.text}
        placeholder={item.kind === 'sticky_note' ? 'Write a note…' : 'Type here…'}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            if (draft) save(applyDraft);
            setDraft('');
            setEditingUid(null);
          }
        }}
      />
    );
  }

  if (item.kind === 'table') {
    const cols = Math.max(1, item.cols);
    return (
      <div style={{ ...style, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 1, overflow: 'auto' }}>
        {Array.from({ length: item.rows * cols }, (_, i) => (
          <input
            key={i}
            defaultValue={item.cells?.[i] ?? ''}
            style={{ minWidth: 0, background: 'transparent', border: '1px solid rgba(120,130,150,.35)', borderRadius: 3, color: 'inherit', padding: 4, fontSize: 'inherit' }}
            onBlur={(e) => {
              const value = e.target.value;
              save((copy) => {
                if (copy.kind !== 'table') return;
                const cells = [...(copy.cells ?? Array(copy.rows * copy.cols).fill(''))];
                cells[i] = value;
                copy.cells = cells;
              });
            }}
          />
        ))}
        <button style={{ gridColumn: '1 / -1' }} onClick={() => setEditingUid(null)}>Done</button>
      </div>
    );
  }

  if (item.kind === 'mind_map') {
    const updateNode = (node: MindMapNode, id: string, text: string): MindMapNode => ({
      ...node,
      text: node.id === id ? text : node.text,
      children: node.children?.map((c) => updateNode(c, id, text)),
    });
    const nodes: MindMapNode[] = [];
    const collect = (n: MindMapNode) => { nodes.push(n); n.children?.forEach(collect); };
    collect(item.root);
    return (
      <div style={{ ...style, height: 'auto', maxHeight: 300, overflow: 'auto', padding: 10 }}>
        {nodes.map((n) => (
          <input key={n.id} defaultValue={n.text} style={{ display: 'block', width: '100%', marginBottom: 4, background: 'transparent', border: '1px solid rgba(120,130,150,.35)', borderRadius: 3, color: 'inherit', padding: 4 }}
            onBlur={(e) => {
              const text = e.target.value;
              save((copy) => { if (copy.kind === 'mind_map') copy.root = updateNode(copy.root, n.id, text); });
            }} />
        ))}
        <button onClick={() => setEditingUid(null)}>Done</button>
      </div>
    );
  }

  return null;
}
