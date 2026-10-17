import { io } from "socket.io-client";
import {
  createGuest,
  emptyState,
  guestAction,
  snapshot,
  type GuestState,
  type GuestSnapshot,
  type ActionResult,
} from "../../shared/guest-state";
export type Signal = {
  type: string;
  uid: string;
  room_id?: string;
  player?: Record<string, unknown>;
  bubble?: string;
};
export type LiveSnapshot = GuestSnapshot & { online: string[] };
export interface GuestTransport {
  id: string;
  mode: "development" | "demo";
  subscribe: (fn: (data: LiveSnapshot) => void) => () => void;
  onSignal: (fn: (event: Signal) => void) => () => void;
  onStatus: (fn: (status: string) => void) => () => void;
  signal: (event: Omit<Signal, "uid">) => void;
  mutate: (
    name: string,
    payload?: Record<string, unknown>,
  ) => Promise<ActionResult>;
  refresh: () => Promise<void>;
  close: () => void;
}
type Saved = { id: string; token?: string };
const sessionKey = (mode: string) => `jorata-${mode}-identity-v1`;
export function forgetIdentity(mode: string) {
  sessionStorage.removeItem(sessionKey(mode));
}
export function savedIdentities(mode: string): Saved[] {
  try {
    return JSON.parse(
      localStorage.getItem(`${sessionKey(mode)}-owned`) || "[]",
    );
  } catch {
    return [];
  }
}
export function switchIdentity(mode: string, id: string) {
  const saved = savedIdentities(mode).find((s) => s.id === id);
  if (!saved)
    throw new Error("Only your own saved test identities can be selected.");
  sessionStorage.setItem(sessionKey(mode), JSON.stringify(saved));
}
function remember(mode: string, value: Saved) {
  sessionStorage.setItem(sessionKey(mode), JSON.stringify(value));
  const saved = savedIdentities(mode);
  localStorage.setItem(
    `${sessionKey(mode)}-owned`,
    JSON.stringify(
      [...saved.filter((s) => s.id !== value.id), value].slice(-12),
    ),
  );
}
function current(mode: string): Saved | null {
  try {
    return JSON.parse(sessionStorage.getItem(sessionKey(mode)) || "null");
  } catch {
    return null;
  }
}
export async function connectGuests(): Promise<GuestTransport> {
  // Deployed builds cannot enable the privileged local development service, even with a query string.
  if (import.meta.env.DEV) {
    const response = await fetch("/api/dev/config");
    if (!response.ok)
      throw new Error(
        "Start JORATA with npm run dev to use the local guest service.",
      );
    return connectServer();
  }
  return connectBrowser();
}
async function connectServer(): Promise<GuestTransport> {
  let identity = current("development");
  if (!identity?.token) {
    const response = await fetch("/api/dev/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error("Unable to create a temporary session.");
    identity = (await response.json()) as Saved;
    remember("development", identity);
  }
  const socket = io("/dev-social", {
    auth: { token: identity.token },
    transports: ["websocket", "polling"],
    autoConnect: false,
  });
  const listeners = new Set<(s: LiveSnapshot) => void>(),
    signals = new Set<(s: Signal) => void>(),
    statuses = new Set<(s: string) => void>();
  let latest: LiveSnapshot | null = null,
    status = "Connecting";
  const setStatus = (v: string) => {
    status = v;
    statuses.forEach((fn) => fn(v));
  };
  socket.on("snapshot", (s: LiveSnapshot) => {
    latest = s;
    listeners.forEach((fn) => fn(s));
  });
  socket.on("signal", (e: Signal) => signals.forEach((fn) => fn(e)));
  socket.on("connect", () => {
    setStatus("Live");
    socket.emit("refresh");
  });
  socket.on("disconnect", () => setStatus("Reconnecting"));
  socket.on("connect_error", (e) => setStatus(e.message));
  socket.connect();
  return {
    id: identity.id,
    mode: "development",
    subscribe(fn) {
      listeners.add(fn);
      if (latest) fn(latest);
      return () => {
        listeners.delete(fn);
      };
    },
    onSignal(fn) {
      signals.add(fn);
      return () => {
        signals.delete(fn);
      };
    },
    onStatus(fn) {
      statuses.add(fn);
      fn(status);
      return () => {
        statuses.delete(fn);
      };
    },
    signal(event) {
      if (socket.connected) socket.emit("signal", event);
    },
    mutate(name, payload = {}) {
      if (!socket.connected)
        return Promise.reject(
          new Error("Disconnected. Wait for reconnection before sending."),
        );
      return new Promise((resolve, reject) =>
        socket
          .timeout(15000)
          .emit(
            "action",
            { name, payload },
            (
              err: Error | null,
              response: { error?: string; result: ActionResult },
            ) => {
              if (err)
                reject(
                  new Error(
                    "No confirmation received. Reconnect and check history before retrying.",
                  ),
                );
              else if (response.error) reject(new Error(response.error));
              else resolve(response.result);
            },
          ),
      );
    },
    async refresh() {
      socket.emit("refresh");
    },
    close() {
      socket.disconnect();
      listeners.clear();
      signals.clear();
      statuses.clear();
    },
  };
}
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("jorata-sample-v1", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("sample");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(
        new Error(
          "Browser demo needs local storage. Allow site storage and reload.",
        ),
      );
  });
}
async function connectBrowser(): Promise<GuestTransport> {
  const db = await database(),
    channel = new BroadcastChannel("jorata-sample-events-v1");
  const listeners = new Set<(s: LiveSnapshot) => void>(),
    signals = new Set<(s: Signal) => void>();
  let cached: GuestState | null = null,
    closed = false;
  let identity = current("demo");
  function transact<R>(
    fn: (state: GuestState) => R,
    write: boolean,
  ): Promise<{ state: GuestState; result: R }> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("sample", write ? "readwrite" : "readonly"),
        store = tx.objectStore("sample"),
        req = store.get("state");
      let result: R, state: GuestState;
      req.onsuccess = () => {
        try {
          state = req.result || emptyState();
          result = fn(state);
          if (write) store.put(state, "state");
        } catch (e) {
          reject(e);
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve({ state, result });
      tx.onerror = () =>
        reject(
          new Error(
            "Could not save sample data. Your browser storage may be full.",
          ),
        );
      tx.onabort = () => reject(new Error("Sample update cancelled."));
    });
  }
  const initial = await transact((s) => {
    if (identity && s.profiles.some((p) => p.id === identity!.id))
      return identity;
    const profile = createGuest(s);
    return { id: profile.id };
  }, true);
  identity = initial.result;
  remember("demo", identity);
  const uid = identity.id,
    peers = new Map<string, number>([[uid, Date.now()]]);
  function emit() {
    if (closed || !cached) return;
    const online = [...peers]
      .filter(([, time]) => Date.now() - time < 6500)
      .map(([id]) => id);
    const value = { ...snapshot(cached, uid), online };
    listeners.forEach((fn) => fn(value));
  }
  async function refresh() {
    const loaded = await transact(() => null, false);
    cached = loaded.state;
    emit();
  }
  channel.onmessage = (e) => {
    const event = e.data;
    if (event.type === "changed") void refresh();
    else if (event.type === "presence") {
      peers.set(event.uid, Date.now());
      emit();
    } else if (event.type === "leave") {
      peers.delete(event.uid);
      emit();
      signals.forEach((fn) => fn({ type: "world-leave", uid: event.uid }));
    } else if (event.type === "signal") {
      const signal = event.value as Signal;
      if (
        signal.type !== "typing" ||
        snapshot(cached!, uid).rooms.some((r) => r.id === signal.room_id)
      )
        signals.forEach((fn) => fn(signal));
    }
  };
  function beat() {
    channel.postMessage({ type: "presence", uid });
    peers.set(uid, Date.now());
    emit();
  }
  const timer = setInterval(beat, 2000);
  cached = initial.state;
  channel.postMessage({ type: "changed" });
  beat();
  return {
    id: uid,
    mode: "demo",
    subscribe(fn) {
      listeners.add(fn);
      emit();
      return () => {
        listeners.delete(fn);
      };
    },
    onSignal(fn) {
      signals.add(fn);
      return () => {
        signals.delete(fn);
      };
    },
    onStatus(fn) {
      fn("Browser demo");
      return () => {};
    },
    signal(event) {
      channel.postMessage({ type: "signal", value: { ...event, uid } });
    },
    async mutate(name, payload = {}) {
      const updated = await transact(
        (s) => guestAction(s, uid, name, payload),
        true,
      );
      cached = updated.state;
      emit();
      channel.postMessage({ type: "changed" });
      return updated.result;
    },
    refresh,
    close() {
      closed = true;
      clearInterval(timer);
      channel.postMessage({ type: "leave", uid });
      channel.close();
      db.close();
      listeners.clear();
      signals.clear();
    },
  };
}
