import { useEffect, useSyncExternalStore } from 'react';

export interface Note { id: string; title: string; body: string; folder: string; tags: string[]; pinned: boolean; updatedAt: number; order: number }
interface Library { notes: Note[]; folders: string[]; savedAt?: number }
const RECOVERY_KEY = 'jorata.notes.recovery.v1';
interface Snapshot extends Library { loaded: boolean; status: 'loading' | 'saving' | 'saved' | 'error'; error: string }
let snapshot: Snapshot = { notes: [], folders: ['Personal', 'World journal'], loaded: false, status: 'loading', error: '' };
const listeners = new Set<() => void>();
let database: Promise<IDBDatabase> | undefined;
let initializing: Promise<void> | undefined;
let pending = Promise.resolve();
let revision = 0;
function emit(next: Partial<Snapshot>) { snapshot = { ...snapshot, ...next }; listeners.forEach(listener => listener()); }
function readRecovery(): Library | undefined {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY);
    const value = raw ? JSON.parse(raw) as Library : undefined;
    if (value && Array.isArray(value.notes) && Array.isArray(value.folders) && value.notes.every(n => n && typeof n.id === 'string' && typeof n.title === 'string' && typeof n.body === 'string' && typeof n.folder === 'string' && Array.isArray(n.tags))) return value;
  } catch { /* Preserve unreadable recovery data; never delete it automatically. */ }
}
function db() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('jorata-notes-v1', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('library'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other JORATA tabs and reload to open your notes.'));
  });
  return database;
}
export function initializeNotes() {
  initializing ??= (async () => {
    try {
      const connection = await db();
      const value = await new Promise<Library | undefined>((resolve, reject) => {
        const tx = connection.transaction('library', 'readonly');
        const request = tx.objectStore('library').get('current');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const recovery = readRecovery();
      const valid=(item: Library | undefined) => item && Array.isArray(item.notes) && Array.isArray(item.folders) && item.notes.every(n=>typeof n.id==='string' && typeof n.title==='string' && typeof n.body==='string' && Array.isArray(n.tags));
      const choices=[value,recovery].filter(valid) as Library[];
      if ((value || recovery) && !choices.length) throw new Error('The stored library could not be read.');
      const restored=choices.sort((a,b)=>(b.savedAt||0)-(a.savedAt||0))[0];
      emit({ ...(restored ?? {}), loaded: true, status: 'saved' });
    } catch (error) { emit({ ...(readRecovery() ?? {}), loaded: true, status: 'error', error: `The notes database is unavailable. A local recovery copy may be available; export your writing before leaving. ${error instanceof Error ? error.message : ''}` }); }
  })();
  return initializing;
}
function persist(library: Library) {
  const current = ++revision;
  library = {...library, savedAt: Math.max(Date.now(), (snapshot.savedAt || 0) + 1)};
  try { localStorage.setItem(RECOVERY_KEY, JSON.stringify(library)); } catch { /* IndexedDB remains the primary store; failed writes are surfaced below. */ }
  emit({ ...library, status: 'saving' });
  pending = pending.catch(() => {}).then(async () => {
    try {
      const connection = await db();
      await new Promise<void>((resolve, reject) => {
        const tx = connection.transaction('library', 'readwrite');
        tx.objectStore('library').put(library, 'current');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      if (current === revision) emit({ status: 'saved', error: '' });
    } catch { emit({ status: 'error', error: 'Could not save to this device. Export your writing before leaving. Check available storage and browser permissions.' }); }
  });
  return pending;
}
function change(notes: Note[], folders = snapshot.folders) { return persist({ notes, folders }); }
export const noteActions = {
  create(folder = '', title = '', body = '') {
    const note: Note = { id: crypto.randomUUID(), title, body, folder, tags: [], pinned: false, updatedAt: Date.now(), order: Date.now() };
    void change([note, ...snapshot.notes]);
    return note.id;
  },
  update(id: string, changes: Partial<Omit<Note, 'id'>>) { return change(snapshot.notes.map(note => note.id === id ? { ...note, ...changes, updatedAt: Date.now() } : note)); },
  remove(id: string) { return change(snapshot.notes.filter(note => note.id !== id)); },
  addFolder(name: string) { const clean = name.trim(); if (clean && !snapshot.folders.includes(clean)) void change(snapshot.notes, [...snapshot.folders, clean]); },
  removeFolder(name: string) { return change(snapshot.notes.map(note => note.folder === name ? { ...note, folder: '' } : note), snapshot.folders.filter(folder => folder !== name)); },
  reorder(id: string, beforeId: string) {
    const notes = [...snapshot.notes].sort((a, b) => a.order - b.order);
    const source = notes.findIndex(note => note.id === id);
    if (source < 0 || id === beforeId) return;
    const [note] = notes.splice(source, 1);
    const destination = notes.findIndex(item => item.id === beforeId);
    if (destination < 0) return;
    notes.splice(destination, 0, note);
    void change(notes.map((item, order) => ({ ...item, order })));
  },
  flush() { return pending; },
};
export function useNotesStore() {
  const state = useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => snapshot);
  useEffect(() => { void initializeNotes(); }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (snapshot.notes.length && (snapshot.status === 'saving' || snapshot.status === 'error')) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  return state;
}
export function exportNote(note: Note) {
  const markdown = `# ${note.title || 'Untitled'}\n\n${note.body}\n`;
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${(note.title || 'Untitled').replace(/[^a-z0-9 _-]/gi, '').slice(0, 80) || 'note'}.md`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
