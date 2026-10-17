import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGuestServer } from "../server/guest-server.ts";
import type { GuestSnapshot } from "../shared/guest-state.ts";
test("real guest sockets synchronize and recover, reject forged tokens, isolate messages and persist after restart", async () => {
  const folder = await mkdtemp(join(tmpdir(), "jorata-guests-")),
    file = join(folder, "state.json");
  const sockets: Socket[] = [];
  async function start() {
    const app = express(),
      http = createServer(app),
      io = new Server(http, { maxHttpBufferSize: 1_600_000 }),
      service = createGuestServer(app, io, file)!;
    await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
    const address = http.address() as { port: number };
    return {
      base: `http://127.0.0.1:${address.port}`,
      async stop() {
        await service.close();
        await new Promise<void>((r) => io.close(() => r()));
      },
    };
  }
  let server = await start();
  const newGuest = async () => {
    const response = await fetch(`${server.base}/api/dev/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    assert.equal(response.status, 200);
    return (await response.json()) as { id: string; token: string };
  };
  const client = async (token: string) => {
    const socket = connect(`${server.base}/dev-social`, {
      auth: { token },
      transports: ["websocket"],
      autoConnect: false,
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
      socket.connect();
    });
    return socket;
  };
  const mutate = (
    socket: Socket,
    name: string,
    payload: Record<string, unknown>,
  ) =>
    new Promise<Record<string, string>>((resolve, reject) =>
      socket
        .timeout(5000)
        .emit(
          "action",
          { name, payload },
          (
            e: Error | null,
            r: { error?: string; result: Record<string, string> },
          ) =>
            e
              ? reject(e)
              : r.error
                ? reject(new Error(r.error))
                : resolve(r.result),
        ),
    );
  const snap = (socket: Socket) =>
    new Promise<GuestSnapshot>((resolve) => {
      socket.once("snapshot", resolve);
      socket.emit("refresh");
    });
  try {
    const a = await newGuest(),
      b = await newGuest(),
      c = await newGuest();
    await assert.rejects(() => client(a.id), /Invalid temporary session/);
    const sa = await client(a.token),
      sb = await client(b.token),
      sc = await client(c.token);
    const room = (await mutate(sa, "open_dm", { user_id: b.id })).id;
    await mutate(sa, "send_message", {
      room_id: room,
      body: "Actual network message",
      sender_id: c.id,
    });
    assert.equal((await snap(sb)).messages[0].sender_id, a.id);
    assert.equal((await snap(sc)).messages.length, 0);
    await assert.rejects(
      () => mutate(sc, "send_message", { room_id: room, body: "Forged" }),
      /not a member/,
    );
    sa.disconnect();
    await mutate(sb, "send_message", {
      room_id: room,
      body: "Missed while disconnected",
    });
    const recovered = await client(a.token);
    assert.equal((await snap(recovered)).messages.length, 2);
    await server.stop();
    server = await start();
    const after = await client(a.token);
    assert.equal((await snap(after)).messages.length, 2);
    const originDenied = await fetch(`${server.base}/api/dev/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://unrelated.example",
      },
    });
    assert.equal(originDenied.status, 403);
  } finally {
    for (const s of sockets) s.disconnect();
    await server.stop();
    await rm(folder, { recursive: true, force: true });
  }
});
test("development guest service cannot be enabled in production", () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const http = createServer(),
      io = new Server(http);
    assert.equal(createGuestServer(express(), io, "/not-created"), null);
    void io.close();
  } finally {
    process.env.NODE_ENV = prev;
  }
});
