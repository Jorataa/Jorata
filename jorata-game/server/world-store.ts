import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { generateWorld, WORLD_HEIGHT, WORLD_WIDTH, type World } from '../shared/game.ts';
export function loadWorld(path: string): World {
  if (!existsSync(path)) return generateWorld();
  const data = JSON.parse(readFileSync(path, 'utf8')) as World;
  if (data.width !== WORLD_WIDTH || data.height !== WORLD_HEIGHT || !Array.isArray(data.tiles) || data.tiles.length !== WORLD_WIDTH * WORLD_HEIGHT || !data.tiles.every(t => Number.isInteger(t) && t >= 0 && t <= 8) || !Number.isSafeInteger(data.revision) || data.revision < 0) {
    throw new Error('Invalid world save. Back up the data file before repairing it.');
  }
  return data;
}
export function saveWorld(path: string, world: World) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.tmp`, JSON.stringify(world), 'utf8');
  renameSync(`${path}.tmp`, path);
}
