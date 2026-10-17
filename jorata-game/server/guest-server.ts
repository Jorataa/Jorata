import type { Express } from "express";
import type { Server } from "socket.io";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import {
  createGuest,
  emptyState,
  guestAction,
  snapshot,
  type GuestState,
} from "../shared/guest-state.ts";
// Intentionally absent in production, including Vercel. Codespaces forwarded ports should remain private.
export function createGuestServer(app: Express, io: Server, file: string) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) return null;
  let state = emptyState(),
    tokens: Record<string, string> = {};
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    if (data.state?.version !== 1)
      throw new Error("Unsupported guest data format");
    state = data.state;
    tokens = data.tokens;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  let saveQueue = Promise.resolve();
  function save() {
    saveQueue = saveQueue.then(() => {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(`${file}.tmp`, JSON.stringify({ state, tokens }), {
        mode: 0o600,
      });
      renameSync(`${file}.tmp`, file);
    });
    return saveQueue;
  }
  const digest = (token: string) =>
    createHash("sha256").update(token).digest("hex");
  const ns = io.of("/dev-social"),
    online = () => [
      ...new Set([...ns.sockets.values()].map((s) => s.data.uid as string)),
    ];
  const rates = new Map<string, { at: number; count: number }>();
  function limit(key: string, max: number) {
    const now = Date.now();
    if (rates.size > 5000)
      for (const [k, v] of rates) if (now - v.at > 60_000) rates.delete(k);
    const r = rates.get(key);
    if (!r || now - r.at > 60_000) {
      rates.set(key, { at: now, count: 1 });
      return true;
    }
    return ++r.count <= max;
  }
  // Require browser same-origin context and JSON requests. No cross-origin guest bootstrap.
  app.get("/api/dev/config", (_req, res) =>
    res.json({
      mode: "development",
      warning: "Temporary local data. Keep this forwarded port private.",
    }),
  );
  app.post("/api/dev/session", (req, res) => {
    if (
      req.headers["content-type"] !== "application/json" ||
      (req.headers.origin &&
        ![req.headers.host, req.headers["x-forwarded-host"]].includes(
          new URL(req.headers.origin).host,
        )) ||
      !limit(`new:${req.ip}`, 30)
    ) {
      res
        .status(403)
        .json({
          error:
            "Development session unavailable. Use a private, same-origin preview.",
        });
      return;
    }
    const token = randomBytes(32).toString("hex"),
      profile = createGuest(state);
    tokens[digest(token)] = profile.id;
    void save()
      .then(() => {
        res.json({ token, id: profile.id });
        publish();
      })
      .catch(() =>
        res.status(500).json({ error: "Could not save development identity." }),
      );
  });
  ns.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const uid =
      typeof token === "string" && token.length === 64
        ? tokens[digest(token)]
        : null;
    if (!uid) {
      next(new Error("Invalid temporary session. Create a new guest."));
      return;
    }
    socket.data.uid = uid;
    next();
  });
  function publish() {
    for (const socket of ns.sockets.values())
      socket.emit("snapshot", {
        ...snapshot(state, socket.data.uid),
        online: online(),
      });
  }
  ns.on("connection", (socket) => {
    const uid = socket.data.uid as string;
    publish();
    socket.on("refresh", () =>
      socket.emit("snapshot", { ...snapshot(state, uid), online: online() }),
    );
    socket.on("action", async (request: unknown, ack: unknown) => {
      if (typeof ack !== "function") return;
      const reply = ack as (r: unknown) => void;
      try {
        if (!limit(`action:${uid}`, 100))
          throw new Error("Please slow down and try again shortly.");
        if (!request || typeof request !== "object")
          throw new Error("Invalid request.");
        const { name, payload } = request as {
          name: string;
          payload: Record<string, unknown>;
        };
        if (
          typeof name !== "string" ||
          !payload ||
          typeof payload !== "object" ||
          JSON.stringify(payload).length > 1_510_000
        )
          throw new Error("Invalid or oversized request.");
        const next = structuredClone(state);
        const result = guestAction(next, uid, name, payload);
        state = next;
        await save();
        publish();
        reply({ result });
      } catch (e) {
        reply({ error: (e as Error).message });
      }
    });
    socket.on("signal", (event: unknown) => {
      if (!limit(`signal:${uid}`, 1000) || !event || typeof event !== "object")
        return;
      const e = event as Record<string, unknown>;
      if (
        e.type === "typing" &&
        typeof e.room_id === "string" &&
        snapshot(state, uid).rooms.some((r) => r.id === e.room_id)
      ) {
        for (const peer of ns.sockets.values())
          if (
            peer.id !== socket.id &&
            snapshot(state, peer.data.uid).rooms.some((r) => r.id === e.room_id)
          )
            peer.emit("signal", { type: "typing", room_id: e.room_id, uid });
      } else if (
        e.type === "world" &&
        e.player &&
        typeof e.player === "object"
      ) {
        const p = e.player as Record<string, unknown>;
        if (
          ![p.x, p.y, p.vx, p.vy].every(
            (n) => typeof n === "number" && Number.isFinite(n),
          ) ||
          Number(p.x) < 0 ||
          Number(p.x) > 96 ||
          Number(p.y) < -10 ||
          Number(p.y) > 42 ||
          Math.abs(Number(p.vx)) > 7 ||
          Math.abs(Number(p.vy)) > 20
        )
          return;
        socket.broadcast.emit("signal", {
          type: "world",
          uid,
          player: {
            x: p.x,
            y: p.y,
            vx: p.vx,
            vy: p.vy,
            grounded: p.grounded === true,
            facing: p.facing === -1 ? -1 : 1,
          },
          bubble: typeof e.bubble === "string" ? e.bubble.slice(0, 120) : "",
        });
      } else if (e.type === "world-leave")
        socket.broadcast.emit("signal", { type: "world-leave", uid });
    });
    socket.on("disconnect", () => {
      ns.emit("signal", { type: "world-leave", uid });
      publish();
    });
  });
  return { close: () => saveQueue };
}
