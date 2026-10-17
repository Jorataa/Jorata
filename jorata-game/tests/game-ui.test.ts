import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateWorld,
  tileAt,
  overlaps,
  stepPlayer,
  SPAWN,
  REACH,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  MATERIALS,
  type Player,
  type World,
} from '../shared/game.ts';
import { GameModel } from '../src/game/model.ts';
import { sounds } from '../src/game/audio.ts';

test('World generator produces consistent terrain and surface', () => {
  const world = generateWorld();
  assert.equal(world.width, 96);
  assert.equal(world.height, 40);
  assert.equal(world.tiles.length, 96 * 40);

  // Bottom row should be bedrock (tile 8)
  for (let x = 0; x < 96; x++) {
    assert.equal(tileAt(world, x, 39), 8);
  }

  // Air above surface
  assert.equal(tileAt(world, 12, 10), 0);
});

test('Protected spawn area rules', () => {
  // Spawn area is [10..15, 24..29]
  const isProtected = (x: number, y: number) => x >= 10 && x <= 15 && y >= 24 && y <= 29;

  assert.equal(isProtected(SPAWN.x, SPAWN.y), true);
  assert.equal(isProtected(12, 25), true);
  assert.equal(isProtected(5, 25), false);
  assert.equal(isProtected(30, 20), false);
});

test('Reach distance calculation', () => {
  const player: Player = {
    id: 'p1',
    username: 'Explorer',
    color: '#89c9a8',
    x: 10,
    y: 20,
    vx: 0,
    vy: 0,
    grounded: true,
    facing: 1,
  };

  const isReachable = (tx: number, ty: number) => {
    return Math.hypot(
      tx + 0.5 - (player.x + PLAYER_WIDTH / 2),
      ty + 0.5 - (player.y + PLAYER_HEIGHT / 2)
    ) <= REACH;
  };

  // Immediate neighboring blocks are reachable
  assert.equal(isReachable(10, 21), true);
  assert.equal(isReachable(12, 20), true);

  // Blocks far away (> 5 blocks) are not reachable
  assert.equal(isReachable(20, 20), false);
  assert.equal(isReachable(10, 35), false);
});

test('Player collision and overlap checks', () => {
  const player: Player = {
    id: 'p1',
    username: 'Explorer',
    color: '#89c9a8',
    x: 12,
    y: 25,
    vx: 0,
    vy: 0,
    grounded: true,
    facing: 1,
  };

  // Block exactly overlapping player
  assert.equal(overlaps(12, 25, player), true);
  // Block distant from player
  assert.equal(overlaps(15, 25, player), false);
});

test('GameModel speech bubble tracking and expiration', async () => {
  const model = new GameModel();

  model.addBubble('Explorer1', 'Hello meadow!');
  const bubble = model.getBubble('Explorer1');
  assert.ok(bubble);
  assert.equal(bubble?.text, 'Hello meadow!');

  // Non-existent bubble
  assert.equal(model.getBubble('GhostUser'), undefined);
});

test('Materials catalog matches defined block types', () => {
  assert.equal(MATERIALS.length, 3);
  const ids = MATERIALS.map(m => m.id);
  assert.ok(ids.includes(4)); // Timber
  assert.ok(ids.includes(6)); // Clay
  assert.ok(ids.includes(7)); // Glass
});

test('Audio mute state toggle', () => {
  const initial = sounds.isMuted();
  sounds.setMuted(true);
  assert.equal(sounds.isMuted(), true);
  sounds.setMuted(false);
  assert.equal(sounds.isMuted(), false);
  sounds.setMuted(initial);
});
