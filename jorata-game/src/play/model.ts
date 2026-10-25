export const TILE = 32;
export const COLS = 100;
export const ROWS = 32;
export type Material = 'earth' | 'stone' | 'wood';
export type Tile = Material | null;
export type World = { version: 1; tiles: Tile[]; player: { x: number; y: number }; inventory: Record<Material, number>; collected: number; built: number; savedAt: number };
export const materials: Material[] = ['earth', 'stone', 'wood'];
export function surfaceAt(x: number) { return 18 + Math.floor(Math.sin(x * .17) * 1.5 + Math.sin(x * .43) * .7); }
export function createWorld(): World {
  const tiles: Tile[] = Array(COLS * ROWS).fill(null);
  for (let x = 0; x < COLS; x++) {
    const top = surfaceAt(x);
    for (let y = top; y < ROWS; y++) tiles[y * COLS + x] = y > top + 3 ? 'stone' : 'earth';
    if (x > 10 && x % 13 === 0) for (let n = 1; n <= 4; n++) tiles[(top - n) * COLS + x] = 'wood';
  }
  return { version: 1, tiles, player: { x: 5 * TILE, y: (surfaceAt(5) - 2) * TILE }, inventory: { earth: 12, stone: 4, wood: 6 }, collected: 0, built: 0, savedAt: Date.now() };
}
export function validWorld(value: unknown): value is World {
  if (!value || typeof value !== 'object') return false;
  const w = value as World;
  return w.version === 1 && Array.isArray(w.tiles) && w.tiles.length === COLS * ROWS && w.tiles.every(t => t === null || materials.includes(t)) && !!w.player && Number.isFinite(w.player.x) && w.player.x >= 0 && w.player.x < COLS * TILE && Number.isFinite(w.player.y) && w.player.y >= 0 && w.player.y < ROWS * TILE && !!w.inventory && materials.every(m => Number.isInteger(w.inventory[m]) && w.inventory[m] >= 0 && w.inventory[m] <= COLS * ROWS + 100) && Number.isInteger(w.collected) && w.collected >= 0 && Number.isInteger(w.built) && w.built >= 0 && Number.isFinite(w.savedAt);
}
export function tileAt(w: World, x: number, y: number): Tile { return x < 0 || x >= COLS || y >= ROWS ? 'stone' : y < 0 ? null : w.tiles[y * COLS + x]; }
export function interact(w: World, x: number, y: number, mode: 'break' | 'place', selected: Material): string {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS - 1) return 'The bedrock holds this world together.';
  if (Math.hypot(x * TILE + 16 - (w.player.x + 11), y * TILE + 16 - (w.player.y + 15)) > TILE * 4.2) return 'Move a little closer to reach that block.';
  const index = y * COLS + x;
  if (mode === 'break') {
    const material = w.tiles[index];
    if (!material) return 'Choose a solid block to collect.';
    w.tiles[index] = null; w.inventory[material]++; w.collected++;
    return `Collected ${material}.`;
  }
  if (w.tiles[index]) return 'Find an empty space to build.';
  if (w.inventory[selected] <= 0) return `Collect more ${selected} first.`;
  if (x * TILE < w.player.x + 22 && (x + 1) * TILE > w.player.x && y * TILE < w.player.y + 30 && (y + 1) * TILE > w.player.y) return 'Leave room for yourself.';
  w.tiles[index] = selected; w.inventory[selected]--; w.built++;
  return `Placed ${selected}.`;
}
