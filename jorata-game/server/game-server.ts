import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server as SocketServer } from 'socket.io';
import { IDLE, MATERIALS, PLAYER_HEIGHT, PLAYER_WIDTH, REACH, SPAWN, overlaps, stepPlayer, tileAt, type ClientEvents, type Input, type Message, type Player, type ServerEvents } from '../shared/game.ts';
import { loadWorld, saveWorld } from './world-store.ts';

class Bucket {
  tokens: number;
  last = Date.now();
  constructor(private capacity: number, private rate: number) { this.tokens = capacity; }
  take() {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + (now - this.last) / 1000 * this.rate);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens--; return true;
  }
}
export function createGameServer(http: Server, savePath: string) {
  const io = new SocketServer<ClientEvents, ServerEvents>(http, { maxHttpBufferSize: process.env.NODE_ENV !== 'production' && !process.env.VERCEL ? 1_600_000 : 4096 });
  const world = loadWorld(savePath);
  const players = new Map<string, Player>();
  const inputs = new Map<string, { value: Input; at: number }>();
  const messages: Message[] = [];
  const colors = ['#e9af69', '#a5b8ef', '#e8a1b2', '#89c9a8', '#d3a4e8', '#8dcad9'];
  let colorIndex = 0;
  function sendMessage(username: string, text: string, system = false) {
    const message = { id: randomUUID(), username, text, system, at: Date.now() };
    messages.push(message);
    if (messages.length > 80) messages.shift();
    io.emit('chat', message);
  }
  function respawn(player: Player) {
    // Keep an open, protected spawn so saved builds can never trap new arrivals.
    Object.assign(player, SPAWN, { vx: 0, vy: 0, grounded: false });
    inputs.set(player.id, { value: { ...IDLE }, at: Date.now() });
  }
  io.on('connection', socket => {
    const chatLimit = new Bucket(4, 0.8);
    const editLimit = new Bucket(6, 4);
    const inputLimit = new Bucket(120, 65);
    const actionLimit = new Bucket(3, 0.5);
    const joinTimeout = setTimeout(() => { if (!players.has(socket.id)) socket.disconnect(true); }, 60_000);
    socket.on('join', raw => {
      if (players.has(socket.id)) return;
      if (players.size >= 64) { socket.emit('notice', 'This world is full. Try again shortly.'); return; }
      if (typeof raw !== 'string' || raw.length > 40) return;
      const username = raw.normalize('NFKC').trim();
      if (!/^[\p{L}\p{N}_ .-]{2,20}$/u.test(username)) { socket.emit('notice', 'Use 2–20 letters, numbers, spaces, dots, hyphens or underscores.'); return; }
      clearTimeout(joinTimeout);
      const player: Player = { id: socket.id, username, color: colors[colorIndex++ % colors.length], ...SPAWN, vx: 0, vy: 0, grounded: false, facing: 1 };
      players.set(socket.id, player);
      inputs.set(socket.id, { value: { ...IDLE }, at: Date.now() });
      socket.emit('welcome', { id: socket.id, world, players: [...players.values()], messages });
      sendMessage('World', `${username} joined the meadow.`, true);
      io.emit('players', [...players.values()]);
    });
    socket.on('input', value => {
      if (!players.has(socket.id) || !inputLimit.take() || !value || typeof value.left !== 'boolean' || typeof value.right !== 'boolean' || typeof value.jump !== 'boolean') return;
      inputs.set(socket.id, { value: { left: value.left, right: value.right, jump: value.jump }, at: Date.now() });
    });
    socket.on('chat', raw => {
      const player = players.get(socket.id);
      if (!player || typeof raw !== 'string' || raw.length > 280) return;
      const text = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
      if (!text) return;
      if (!chatLimit.take()) { socket.emit('notice', 'Give the chat a moment before sending again.'); return; }
      sendMessage(player.username, text);
    });
    socket.on('edit', edit => {
      const p = players.get(socket.id);
      if (!p || !edit || !Number.isInteger(edit.x) || !Number.isInteger(edit.y) || !Number.isInteger(edit.tile)) return;
      if (!editLimit.take()) { socket.emit('notice', 'Build a little slower.'); return; }
      const { x, y, tile } = edit;
      if (x < 0 || x >= world.width || y < 0 || y >= world.height - 1 || ![0, ...MATERIALS.map(m => m.id)].includes(tile)) return;
      if (Math.hypot(x + 0.5 - (p.x + PLAYER_WIDTH / 2), y + 0.5 - (p.y + PLAYER_HEIGHT / 2)) > REACH) { socket.emit('notice', 'Move closer to that block.'); return; }
      if (x >= 10 && x <= 15 && y >= 24 && y <= 29) { socket.emit('notice', 'The arrival area stays clear. Build just beside it.'); return; }
      const previous = tileAt(world, x, y);
      if ((tile === 0 && previous === 0) || (tile !== 0 && previous !== 0)) return;
      if (tile !== 0 && [...players.values()].some(player => overlaps(x, y, player))) { socket.emit('notice', 'A player is standing there.'); return; }
      const index = y * world.width + x;
      world.tiles[index] = tile;
      world.revision++;
      try { saveWorld(savePath, world); }
      catch (error) { world.tiles[index] = previous; world.revision--; console.error('World save failed:', error); socket.emit('notice', 'Could not save this edit. Please try again.'); return; }
      io.emit('tile', { x, y, tile, revision: world.revision });
    });
    socket.on('respawn', () => {
      const player = players.get(socket.id);
      if (player && actionLimit.take()) { respawn(player); io.emit('players', [...players.values()]); }
    });
    socket.on('disconnect', () => {
      clearTimeout(joinTimeout);
      const player = players.get(socket.id);
      players.delete(socket.id); inputs.delete(socket.id);
      if (player) { sendMessage('World', `${player.username} left the meadow.`, true); io.emit('players', [...players.values()]); }
    });
  });
  let ticks = 0;
  const timer = setInterval(() => {
    for (const player of players.values()) {
      const input = inputs.get(player.id);
      stepPlayer(player, input && Date.now() - input.at < 500 ? input.value : IDLE, world, 1 / 60);
      if (!Number.isFinite(player.x) || !Number.isFinite(player.y) || player.y > world.height) respawn(player);
    }
    if (++ticks % 3 === 0 && players.size) io.emit('players', [...players.values()]);
  }, 1000 / 60);
  return { io, world, players, close: async () => { clearInterval(timer); await io.close(); } };
}
