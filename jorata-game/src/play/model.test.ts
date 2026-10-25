import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, TILE, createWorld, interact, surfaceAt, validWorld } from './model';
import { WorldEngine } from './engine';

test('a world is deterministic, serializable, and rejects corrupt inventory', () => {
  const world = createWorld();
  assert.deepEqual(world.tiles, createWorld().tiles);
  assert.ok(validWorld(JSON.parse(JSON.stringify(world))));
  world.inventory.earth = -1;
  assert.equal(validWorld(world), false);
});
test('collect and build conserve resources, enforce reach, and avoid player trapping', () => {
  const world = createWorld();
  const ground = surfaceAt(5);
  world.player = { x: 5 * TILE, y: ground * TILE - 30 };
  assert.equal(interact(world, 5, ground, 'break', 'earth'), 'Collected earth.');
  assert.equal(world.inventory.earth, 13);
  assert.equal(world.collected, 1);
  assert.equal(interact(world, 5, ground, 'place', 'earth'), 'Placed earth.');
  assert.equal(world.inventory.earth, 12);
  assert.equal(world.built, 1);
  assert.match(interact(world, 50, surfaceAt(50), 'break', 'earth'), /closer/);
  assert.match(interact(world, 5, ground - 1, 'place', 'stone'), /room/);
});
test('physics lands, jumps, returns to ground, and respects world bounds', () => {
  const world = createWorld();
  const engine = new WorldEngine(world);
  const idle = { left: false, right: false, jump: false };
  for (let n = 0; n < 120; n++) engine.step(1 / 60, idle);
  assert.equal(engine.grounded, true);
  const groundY = world.player.y;
  engine.step(1 / 60, { ...idle, jump: true });
  assert.ok(world.player.y < groundY);
  for (let n = 0; n < 180; n++) engine.step(1 / 60, idle);
  assert.equal(engine.grounded, true);
  assert.ok(Math.abs(groundY - world.player.y) < 5);
  for (let n = 0; n < 300; n++) engine.step(1 / 60, { ...idle, left: true });
  assert.ok(world.player.x >= 0 && world.player.x < COLS * TILE);
});
