import { validWorld, type World } from './model';
const KEY = 'jorata.play.world.v1';
let connection: Promise<IDBDatabase> | undefined;
function db() {
  return connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('jorata-play', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function loadWorld(): Promise<World | null> {
  let primary: unknown, recovery: unknown;
  let invalid = false;
  try {
    const database = await db();
    primary = await new Promise<unknown>((resolve, reject) => { const r = database.transaction('saves').objectStore('saves').get(KEY); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    if (primary !== undefined && !validWorld(primary)) invalid = true;
  } catch { /* The recovery copy supports browsers where IndexedDB is unavailable. */ }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { recovery = JSON.parse(raw); if (!validWorld(recovery)) invalid = true; } catch { invalid = true; }
    }
  } catch { /* IndexedDB can still save when synchronous storage is blocked. */ }
  // An interrupted page close can leave a newer synchronous recovery copy.
  const candidates = [primary, recovery].filter(validWorld).sort((a, b) => b.savedAt - a.savedAt);
  if (candidates.length) return candidates[0];
  if (invalid) throw new Error('Your saved world could not be read. Its recovery copy has been preserved.');
  return null;
}
export async function saveWorld(world: World) {
  const snapshot = structuredClone(world); snapshot.savedAt = Date.now();
  let recoverySaved = false;
  try { localStorage.setItem(KEY, JSON.stringify(snapshot)); recoverySaved = true; } catch { /* IndexedDB remains the primary store. */ }
  try {
    const database = await db();
    await new Promise<void>((resolve, reject) => { const tx = database.transaction('saves', 'readwrite'); tx.objectStore('saves').put(snapshot, KEY); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  } catch (error) { if (!recoverySaved) throw error; }
}
