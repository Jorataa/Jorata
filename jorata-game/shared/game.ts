export const WORLD_WIDTH = 96;
export const WORLD_HEIGHT = 40;
export const TILE_SIZE = 32;
export const PLAYER_WIDTH = 0.72;
export const PLAYER_HEIGHT = 1.55;
export const REACH = 5;
export const SPAWN = { x: 12, y: 25 };
export const MATERIALS = [
  { id: 4, name: 'Timber', color: '#b57c50', key: '1' },
  { id: 6, name: 'Clay', color: '#d58167', key: '2' },
  { id: 7, name: 'Glass', color: '#91d5cd', key: '3' },
] as const;
export type Input = { left: boolean; right: boolean; jump: boolean };
export const IDLE: Input = { left: false, right: false, jump: false };
export type Player = {
  id: string; username: string; color: string;
  x: number; y: number; vx: number; vy: number; grounded: boolean; facing: number;
};
export type World = { width: number; height: number; tiles: number[]; revision: number };
export type Message = { id: string; username: string; text: string; system?: boolean; at: number };
export type Welcome = { id: string; world: World; players: Player[]; messages: Message[] };
export type TileEdit = { x: number; y: number; tile: number; revision: number };
export interface ServerEvents {
  welcome: (data: Welcome) => void;
  players: (players: Player[]) => void;
  chat: (message: Message) => void;
  tile: (edit: TileEdit) => void;
  notice: (message: string) => void;
}
export interface ClientEvents {
  join: (username: string) => void;
  input: (input: Input) => void;
  chat: (text: string) => void;
  edit: (edit: { x: number; y: number; tile: number }) => void;
  respawn: () => void;
}
export function tileAt(world: World, x: number, y: number): number {
  if (x < 0 || x >= world.width || y >= world.height) return 8;
  if (y < 0) return 0;
  return world.tiles[Math.floor(y) * world.width + Math.floor(x)] ?? 8;
}
export function overlaps(x: number, y: number, player: Player) {
  return x < player.x + PLAYER_WIDTH && x + 1 > player.x && y < player.y + PLAYER_HEIGHT && y + 1 > player.y;
}
function collides(world: World, x: number, y: number) {
  for (let ty = Math.floor(y); ty <= Math.floor(y + PLAYER_HEIGHT - 0.001); ty++) {
    for (let tx = Math.floor(x); tx <= Math.floor(x + PLAYER_WIDTH - 0.001); tx++) {
      if (tileAt(world, tx, ty)) return true;
    }
  }
  return false;
}
export function stepPlayer(p: Player, input: Input, world: World, dt: number) {
  const direction = Number(input.right) - Number(input.left);
  p.vx = direction * 6.5;
  if (direction) p.facing = direction;
  if (input.jump && p.grounded) { p.vy = -11.2; p.grounded = false; }
  p.vy = Math.min(p.vy + 27 * dt, 19);
  const nx = p.x + p.vx * dt;
  if (!collides(world, nx, p.y)) p.x = nx;
  else {
    p.x = p.vx > 0 ? Math.floor(nx + PLAYER_WIDTH) - PLAYER_WIDTH - 0.001 : Math.floor(nx) + 1.001;
    p.vx = 0;
  }
  const ny = p.y + p.vy * dt;
  p.grounded = false;
  if (!collides(world, p.x, ny)) p.y = ny;
  else {
    if (p.vy > 0) { p.y = Math.floor(ny + PLAYER_HEIGHT) - PLAYER_HEIGHT - 0.001; p.grounded = true; }
    else p.y = Math.floor(ny) + 1.001;
    p.vy = 0;
  }
  p.x = Math.max(0, Math.min(world.width - PLAYER_WIDTH - 0.001, p.x));
}
export function generateWorld(): World {
  const tiles = new Array<number>(WORLD_WIDTH * WORLD_HEIGHT).fill(0);
  for (let x = 0; x < WORLD_WIDTH; x++) {
    const surface = x < 24 ? 28 : 28 + Math.round(Math.sin(x / 7) * 2);
    for (let y = surface; y < WORLD_HEIGHT; y++) {
      tiles[y * WORLD_WIDTH + x] = y === WORLD_HEIGHT - 1 ? 8 : y === surface ? 2 : y > surface + 4 ? 3 : 1;
    }
  }
  for (const [start, end, y] of [[20, 25, 24], [29, 34, 21], [40, 46, 23], [64, 71, 24]]) {
    for (let x = start; x <= end; x++) tiles[y * WORLD_WIDTH + x] = 2;
  }
  return { width: WORLD_WIDTH, height: WORLD_HEIGHT, tiles, revision: 0 };
}
