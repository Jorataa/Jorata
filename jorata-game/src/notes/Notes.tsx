import { useEffect, useRef, useState } from 'react';
import { exportNote, noteActions, useNotesStore } from './store';
import './notes.css';
import {Icon} from '../ui';
export { useNotesStore, noteActions } from './store';
export type { Note } from './store';

function Markdown({ text }: { text: string }) {
  return <div className="jn-markdown">{text.split('\n').map((line, index) => {
    if (line.startsWith('### ')) return <h3 key={index}>{line.slice(4)}</h3>;
    if (line.startsWith('## ')) return <h2 key={index}>{line.slice(3)}</h2>;
    if (line.startsWith('# ')) return <h1 key={index}>{line.slice(2)}</h1>;
    if (line.startsWith('- ')) return <p className="jn-bullet" key={index}>{line.slice(2)}</p>;
    if (line.startsWith('> ')) return <blockquote key={index}>{line.slice(2)}</blockquote>;
    return <p key={index}>{line || '\u00a0'}</p>;
  })}</div>;
}
const date = (time: number) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(time);
export default function Notes({ initialNoteId = '' }: { initialNoteId?: string } = {}) {
  const { notes, folders, loaded, status, error } = useNotesStore();
  const [selected, setSelected] = useState(initialNoteId);
  const [folder, setFolder] = useState('*');
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('recent');
  const [preview, setPreview] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const active = notes.find(note => note.id === selected);
  const tags = [...new Set(notes.flatMap(note => note.tags))].sort();
  const visible = notes.filter(note => (folder === '*' || (folder === '@pinned' ? note.pinned : note.folder === folder)) && (!tag || note.tags.includes(tag)) && `${note.title} ${note.body} ${note.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'manual' ? a.order - b.order : b.updatedAt - a.updatedAt);
  const create = () => { setSelected(noteActions.create(folder === '*' || folder === '@pinned' ? '' : folder)); setPreview(false); setDeleting(false); setTimeout(() => titleRef.current?.focus(), 0); };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void noteActions.flush(); } };
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, []);
  return <section className={`jn-workspace ${active ? 'jn-has-selection' : ''}`} aria-label="JORATA Notes">
    <aside className="jn-sidebar">
      <div className="jn-eyebrow">A place for your thoughts</div><h1>Notes<span>.</span></h1>
      <button className="jn-primary" onClick={create} disabled={!loaded}>＋ New note</button>
      <nav aria-label="Note folders">
        {[['*', 'All notes'], ['@pinned', 'Pinned notes'], ['', 'Unfiled'], ...folders.map(item => [item, item])].map(([value, label]) => <button key={value} className={folder === value ? 'is-active' : ''} onClick={() => setFolder(value)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('application/jorata-note'); if (value !== '*' && value !== '@pinned' && id) void noteActions.update(id, { folder: value }); }}><span>{label}</span><small>{notes.filter(note => value === '*' || (value === '@pinned' ? note.pinned : note.folder === value)).length}</small></button>)}
      </nav>
      <form className="jn-folder-form" onSubmit={event => { event.preventDefault(); noteActions.addFolder(folderName); setFolderName(''); }}><input aria-label="New folder name" name="folder-name" autoComplete="off" placeholder="New folder…" value={folderName} onChange={event => setFolderName(event.target.value)} maxLength={60} /><button aria-label="Create folder" disabled={!folderName.trim()}>＋</button></form>
      {folders.includes(folder) && <button className="jn-text-button" onClick={() => { void noteActions.removeFolder(folder); setFolder('*'); }}>Remove folder · keep notes</button>}
      <div className="jn-local"><span className="jn-status-dot" />{status === 'error' ? 'Storage unavailable' : 'Stored on this device'}<small>{status === 'error' ? 'Export a copy before leaving' : 'Guest library · no account needed'}</small></div>
    </aside>
    <div className="jn-list">
      <label className="jn-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input aria-label="Search notes" name="note-search" autoComplete="off" placeholder="Search your notes…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="jn-list-filters"><select aria-label="Sort notes" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Recently edited</option><option value="manual">Custom order</option></select><select aria-label="Filter by tag" value={tag} onChange={event => setTag(event.target.value)}><option value="">All tags</option>{tags.map(item => <option key={item}>{item}</option>)}</select></div>
      <div className="jn-note-list" aria-label="Your notes">{!loaded ? <p className="jn-empty-copy">Opening your library…</p> : visible.length === 0 ? <div className="jn-empty-copy">{notes.length ? 'No notes match this view.' : 'A little space for a new idea.'}<button onClick={create}>Write a note ↗</button></div> : visible.map((note, index) => <div className={`jn-note-row ${active?.id === note.id ? 'is-selected' : ''}`} key={note.id} draggable onDragStart={event => event.dataTransfer.setData('application/jorata-note', note.id)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); noteActions.reorder(event.dataTransfer.getData('application/jorata-note'), note.id); setSort('manual'); }}>
        <button className="jn-note-select" onClick={() => { setSelected(note.id); setDeleting(false); }}><span className="jn-note-date">{date(note.updatedAt)}{note.pinned ? ' · Pinned' : ''}</span><strong>{note.title || 'Untitled note'}</strong><p>{note.body.slice(0, 94) || 'Your next idea starts here.'}</p><small>{note.folder || 'Unfiled'}{note.tags.length ? ` / ${note.tags.join(', ')}` : ''}</small></button>
        {sort === 'manual' && <button className="jn-reorder" aria-label={`Move ${note.title || 'untitled note'} up`} disabled={index === 0} onClick={() => noteActions.reorder(note.id, visible[index - 1].id)}>↑</button>}
      </div>)}</div>
      <p className="jn-list-footer">{visible.length} {visible.length === 1 ? 'note' : 'notes'} · Drag to reorder or file</p>
    </div>
    <article className="jn-editor">
      {error && <div role="alert" className="jn-error">{error}</div>}
      {active ? <>
        <div className="jn-editor-toolbar"><button className="jn-mobile-back" onClick={() => setSelected('')}>← Library</button><span role="status">{status === 'saved' ? 'Saved to this device' : status === 'saving' ? 'Saving…' : status === 'error' ? 'Not saved · export a copy' : 'Loading…'}</span><div><button onClick={() => void noteActions.update(active.id, { pinned: !active.pinned })} aria-pressed={active.pinned}>{active.pinned ? 'Unpin' : 'Pin'}</button><button onClick={() => setPreview(!preview)} aria-pressed={preview}>{preview ? 'Edit' : 'Preview'}</button><button onClick={() => exportNote(active)}>Export</button><button className="jn-delete" onClick={() => setDeleting(!deleting)}>Delete</button></div></div>
        {deleting && <div className="jn-delete-confirm" role="alert">Delete this note permanently?<button onClick={() => { void noteActions.remove(active.id); setSelected(''); setDeleting(false); }}>Delete note</button><button onClick={() => setDeleting(false)}>Keep note</button></div>}
        <div className="jn-paper"><input ref={titleRef} className="jn-title" aria-label="Note title" name="note-title" autoComplete="off" placeholder="Untitled note" value={active.title} onChange={event => void noteActions.update(active.id, { title: event.target.value })} />
        <div className="jn-metadata"><select aria-label="Move note to folder" value={active.folder} onChange={event => void noteActions.update(active.id, { folder: event.target.value })}><option value="">Unfiled</option>{folders.map(item => <option key={item}>{item}</option>)}</select><input aria-label="Note tags" name="note-tags" autoComplete="off" placeholder="Tags, separated by commas" value={active.tags.join(', ')} onChange={event => void noteActions.update(active.id, { tags: event.target.value.split(',').map(item => item.trimStart()) })} onBlur={() => void noteActions.update(active.id, { tags: [...new Set(active.tags.map(item => item.trim()).filter(Boolean))] })} /></div>
        {preview ? <Markdown text={active.body} /> : <textarea className="jn-body" aria-label="Note content" placeholder="Let the thought unfold…" value={active.body} onChange={event => void noteActions.update(active.id, { body: event.target.value })} spellCheck />}
        </div><footer className="jn-editor-footer"><span>{active.body.trim() ? active.body.trim().split(/\s+/).length : 0} words</span><span>Markdown · # Heading · - List · &gt; Quote</span></footer>
      </> : <div className="jn-editor-empty"><span className="jn-empty-mark" aria-hidden="true"><Icon name="notes" size={34}/></span><h2>Room to think.</h2><p>Worlds worth building.<br/>Thoughts worth keeping.</p><button className="jn-primary" onClick={create} disabled={!loaded}>Write something</button></div>}
    </article>
  </section>;
}

export function QuickNote({ onClose }: { onClose: () => void }) {
  const { loaded, status, error, notes } = useNotesStore();
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    return () => previous?.focus();
  }, []);
  const save = (nextTitle: string, nextBody: string) => {
    if (id) void noteActions.update(id, { title: nextTitle, body: nextBody });
    else if (nextTitle || nextBody) setId(noteActions.create('', nextTitle, nextBody));
  };
  return <div className="jn-quick-backdrop"><div ref={dialog} className="jn-quick" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} role="dialog" aria-modal="true" aria-label="Quick note" onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape') onClose();
    if (event.key === 'Tab') { const controls = dialog.current?.querySelectorAll<HTMLElement>('button,input,textarea'); if (!controls?.length) return; const first = controls[0], last = controls[controls.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
  }} onKeyUp={event => event.stopPropagation()}>
    <header className="jn-drag-handle" onPointerDown={event => { if ((event.target as HTMLElement).closest('button')) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, left: offset.x, top: offset.y }; }} onPointerMove={event => { if (!drag.current || !dialog.current) return; const limitX = Math.max(0, (window.innerWidth - dialog.current.offsetWidth) / 2 - 12); const limitY = Math.max(0, (window.innerHeight - dialog.current.offsetHeight) / 2 - 12); setOffset({ x: Math.max(-limitX, Math.min(limitX, drag.current.left + event.clientX - drag.current.x)), y: Math.max(-limitY, Math.min(limitY, drag.current.top + event.clientY - drag.current.y)) }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><span className="jn-eyebrow">A thought, before it goes.</span><button onClick={onClose} aria-label="Close quick note">✕</button></header><h2>Quick note</h2>
    {error && <p className="jn-error" role="alert">{error}</p>}
    <input aria-label="Quick note title" name="quick-title" autoComplete="off" placeholder="Give it a title" value={title} disabled={!loaded} onChange={event => { setTitle(event.target.value); save(event.target.value, body); }} />
    <textarea aria-label="Quick note content" placeholder="Capture an idea. Your world can wait." value={body} disabled={!loaded} onChange={event => { setBody(event.target.value); save(title, event.target.value); }} />
    <footer><span role="status">{!id ? 'Saves as you write' : status === 'saved' ? 'Saved to Notes on this device' : status === 'error' ? 'Save failed' : 'Saving…'}</span>{status === 'error' && id && <button onClick={() => { const note = notes.find(item => item.id === id); if (note) exportNote(note); }}>Export</button>}<button className="jn-primary" onClick={onClose}>Return to world ↗</button></footer>
  </div></div>;
}
