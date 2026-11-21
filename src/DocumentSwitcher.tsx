import { useEffect, useState } from 'react';
import { Search, Trash2, X } from 'lucide-react';
import { deleteDocument, listDocuments, loadDocument } from './lib/storage';
import { parseNNote } from './lib/nnote';
import { useEditor } from './store/editor';

interface Row { id: string; name: string; updatedAt: number }

export function DocumentSwitcher({ onClose }: { onClose: () => void }) {
  const [docs, setDocs] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const load = useEditor((s) => s.loadDocument);

  const refresh = () => listDocuments().then((all) => setDocs(all.map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))));
  useEffect(() => { void refresh(); }, []);

  const open = async (id: string, name: string) => {
    const rec = await loadDocument(id);
    if (!rec) return;
    const parsed = await parseNNote(rec.blob);
    load(parsed.doc, parsed.assets, id, name);
    onClose();
  };

  const filtered = docs.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Document switcher</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <label className="search-field">
          <Search size={16} />
          <input autoFocus placeholder="Search notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="modal-list">
          {filtered.map((d) => (
            <div key={d.id} className="modal-row">
              <button className="modal-open" onClick={() => void open(d.id, d.name)}>
                <b>{d.name}</b>
                <small>{new Date(d.updatedAt).toLocaleString()}</small>
              </button>
              <button className="icon-btn" title="Delete" onClick={async () => { await deleteDocument(d.id); refresh(); }}><Trash2 size={15} /></button>
            </div>
          ))}
          {!filtered.length && <div className="panel-note">No saved notes match “{query}”.</div>}
        </div>
      </div>
    </div>
  );
}
