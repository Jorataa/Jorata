import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { createGameServer } from '../server/game-server.ts';
import { type ClientEvents, type ServerEvents, type Welcome, tileAt } from '../shared/game.ts';

type Client = Socket<ServerEvents, ClientEvents>;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(check: () => boolean, description: string) {
  const end = Date.now() + 4000;
  while (!check()) {
    assert.ok(Date.now() < end, description);
    await sleep(25);
  }
}

test('real clients share movement, chat, edits and persisted world state', { timeout: 20000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'jorata-test-'));
  const path = join(directory, 'world.json');
  const http = createServer();
  let game = createGameServer(http, path);
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const clients: Client[] = [];
  async function connect(username: string): Promise<{ client: Client; welcome: Welcome }> {
    const client: Client = io(url, { autoConnect: false, reconnection: false, transports: ['websocket'] });
    clients.push(client);
    const welcome = new Promise<Welcome>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Join timed out')), 3000);
      client.once('welcome', value => { clearTimeout(timeout); resolve(value); });
      client.once('connect_error', reject);
    });
    client.on('connect', () => client.emit('join', username));
    client.connect();
    return { client, welcome: await welcome };
  }
  try {
    const alice = await connect('Alice');
    const bob = await connect('Bob');
    assert.equal(bob.welcome.players.length, 2);
    assert.notEqual(bob.welcome.players[0].color, bob.welcome.players[1].color);
    let observedPlayers = bob.welcome.players;
    bob.client.on('players', value => { observedPlayers = value; });
    await eventually(() => !!game.players.get(alice.welcome.id)?.grounded, 'Alice lands on ground');
    const startX = game.players.get(alice.welcome.id)!.x;
    alice.client.emit('input', { left: false, right: true, jump: false });
    await eventually(() => observedPlayers.some(p => p.id === alice.welcome.id && p.x > startX + 1), 'Bob sees Alice moving');
    alice.client.emit('input', { left: false, right: false, jump: false });
    await sleep(100);
    const groundedY = game.players.get(alice.welcome.id)!.y;
    alice.client.emit('input', { left: false, right: false, jump: true });
    await eventually(() => game.players.get(alice.welcome.id)!.y < groundedY - 0.5, 'Jump works');
    alice.client.emit('input', { left: false, right: false, jump: false });
    await eventually(() => !!game.players.get(alice.welcome.id)?.grounded, 'Ground collision stops falling');
    let received = '';
    bob.client.on('chat', message => { if (!message.system) received = `${message.username}: ${message.text}`; });
    alice.client.emit('chat', 'Hello from Alice');
    await eventually(() => received === 'Alice: Hello from Alice', 'World chat reaches Bob');

    const revision = game.world.revision;
    alice.client.emit('edit', { x: 95, y: 0, tile: 4 });
    alice.client.emit('edit', { x: 14, y: 27, tile: 4 });
    alice.client.emit('edit', { x: 16, y: 27, tile: 999 });
    await sleep(100);
    assert.equal(game.world.revision, revision, 'Invalid, distant and protected edits rejected');
    let editRevision = revision;
    bob.client.on('tile', edit => { editRevision = edit.revision; });
    alice.client.emit('edit', { x: 16, y: 27, tile: 4 });
    await eventually(() => editRevision === revision + 1, 'Placed block reaches Bob');
    assert.equal(tileAt(game.world, 16, 27), 4);
    assert.equal(JSON.parse(readFileSync(path, 'utf8')).tiles[27 * game.world.width + 16], 4);
    await sleep(600);
    alice.client.emit('edit', { x: 16, y: 27, tile: 0 });
    await eventually(() => editRevision === revision + 2, 'Removal reaches Bob');
    assert.equal(tileAt(game.world, 16, 27), 0);
    await sleep(300);
    alice.client.emit('edit', { x: 16, y: 27, tile: 7 });
    await eventually(() => editRevision === revision + 3, 'Replacement saved');
    alice.client.disconnect();
    await eventually(() => observedPlayers.length === 1, 'Departed player disappears');
    bob.client.disconnect();
    await game.close();
    const restartedHttp = createServer();
    game = createGameServer(restartedHttp, path);
    assert.equal(tileAt(game.world, 16, 27), 7, 'Block survives server restart');
    assert.equal(game.world.revision, revision + 3);
  } finally {
    clients.forEach(client => client.disconnect());
    await game.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
