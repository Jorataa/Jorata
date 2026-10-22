import { COLS, ROWS, TILE, surfaceAt, tileAt, type World } from './model';
export type Controls = { left: boolean; right: boolean; jump: boolean };
export class WorldEngine {
  vx = 0; vy = 0; grounded = false; cameraX = 0; cameraY = 0; time = 0; jumpHeld = false;
  width = 1000; height = 600;
  particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[] = [];
  constructor(public world: World, public reducedMotion = false) {}
  centerCamera() {
    this.cameraX = Math.max(0, Math.min(COLS * TILE - this.width, this.world.player.x - this.width * .45));
    this.cameraY = Math.max(0, Math.min(ROWS * TILE - this.height, this.world.player.y - this.height * .52));
  }
  collides(x: number, y: number) {
    for (let ty = Math.floor(y / TILE); ty <= Math.floor((y + 29) / TILE); ty++) for (let tx = Math.floor(x / TILE); tx <= Math.floor((x + 21) / TILE); tx++) if (tileAt(this.world, tx, ty)) return true;
    return false;
  }
  step(dt: number, controls: Controls) {
    this.time += dt;
    const p = this.world.player;
    this.vx += ((Number(controls.right) - Number(controls.left)) * 190 - this.vx) * Math.min(1, dt * 18);
    if (controls.jump && !this.jumpHeld && this.grounded) { this.vy = -440; this.grounded = false; }
    this.jumpHeld = controls.jump;
    this.vy = Math.min(650, this.vy + 1150 * dt);
    const dx = this.vx * dt, dy = this.vy * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    this.grounded = false;
    for (let n = 0; n < steps; n++) {
      if (!this.collides(p.x + dx / steps, p.y)) p.x += dx / steps;
      if (!this.collides(p.x, p.y + dy / steps)) p.y += dy / steps;
      else { if (dy > 0) this.grounded = true; this.vy = 0; }
    }
    p.x = Math.max(0, Math.min(COLS * TILE - 22, p.x));
    if (p.y > ROWS * TILE) { p.x = 160; p.y = 400; this.vy = 0; }
    const targetX = Math.max(0, Math.min(COLS * TILE - this.width, p.x - this.width * .45));
    const targetY = Math.max(0, Math.min(ROWS * TILE - this.height, p.y - this.height * .52));
    this.cameraX += (targetX - this.cameraX) * Math.min(1, dt * 7);
    this.cameraY += (targetY - this.cameraY) * Math.min(1, dt * 7);
    this.particles = this.particles.filter(a => a.life > 0);
    for (const a of this.particles) { a.x += a.vx * dt; a.y += a.vy * dt; a.vy += 300 * dt; a.life -= dt; }
  }
  burst(x: number, y: number, color: string) { if (!this.reducedMotion) for (let n = 0; n < 9; n++) this.particles.push({ x: x * TILE + 16, y: y * TILE + 16, vx: (Math.random() - .5) * 150, vy: -Math.random() * 140, life: .6, color }); }
  render(ctx: CanvasRenderingContext2D, hover: { x: number; y: number } | null) {
    const W = this.width, H = this.height, cx = this.cameraX, cy = this.cameraY;
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#172d32'); sky.addColorStop(.7, '#607976'); sky.addColorStop(1, '#a3ac92'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(W * .77 - cx * .015, H * .2 - cy * .08, 32, 0, Math.PI * 2); ctx.fill();
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = ['#324e50', '#3b5c57', '#47675a'][layer]; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 20; x += 20) { const sample = x + cx * (.08 + layer * .09); const y = H * (.48 + layer * .1) + Math.sin(sample * .005 + layer * 2) * (55 - layer * 8) + Math.sin(sample * .013) * 13 - cy * .12; ctx.lineTo(x, y); }
      ctx.lineTo(W, H); ctx.fill();
    }
    ctx.save(); ctx.translate(-cx, -cy);
    // Deliberately original silhouettes: rounded, layered grove canopies.
    for (let tx = 13; tx < COLS; tx += 13) {
      const y = (surfaceAt(tx) - 4) * TILE;
      ctx.fillStyle = '#6f8b65'; ctx.beginPath(); ctx.ellipse(tx * TILE + 16, y - 5, 49, 35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8ca078'; ctx.beginPath(); ctx.ellipse(tx * TILE + 5, y - 20, 34, 27, -.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a8b38a'; ctx.beginPath(); ctx.ellipse(tx * TILE - 6, y - 26, 17, 12, -.3, 0, Math.PI * 2); ctx.fill();
    }
    for (let y = Math.max(0, Math.floor(cy / TILE)); y < Math.min(ROWS, Math.ceil((cy + H) / TILE)); y++) for (let x = Math.max(0, Math.floor(cx / TILE)); x < Math.min(COLS, Math.ceil((cx + W) / TILE)); x++) {
      const t = tileAt(this.world, x, y); if (!t) continue;
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = t === 'earth' ? '#796e53' : t === 'stone' ? '#596260' : '#a18a61'; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(px, py + 29, TILE, 3); ctx.fillRect(px + 30, py, 2, TILE);
      ctx.fillStyle = t === 'earth' && !tileAt(this.world, x, y - 1) ? '#9bad7a' : 'rgba(255,255,255,.07)'; ctx.fillRect(px, py, TILE, t === 'earth' ? 5 : 2);
      if (t === 'stone') { ctx.strokeStyle = '#73807a'; ctx.beginPath(); ctx.moveTo(px + 5, py + 21); ctx.lineTo(px + 15, py + 13); ctx.lineTo(px + 25, py + 16); ctx.stroke(); }
      if (t === 'wood') { ctx.fillStyle = '#735e45'; ctx.fillRect(px + 9, py + 6, 2, 21); ctx.fillRect(px + 22, py, 2, 17); }
      if (t === 'earth') { ctx.fillStyle = '#8c8060'; ctx.fillRect(px + 7, py + 12, 4, 3); ctx.fillRect(px + 22, py + 23, 3, 3); }
    }
    const p = this.world.player;
    ctx.fillStyle = 'rgba(12,25,23,.2)'; ctx.beginPath(); ctx.ellipse(p.x + 11, p.y + 31, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    const walk = this.grounded && Math.abs(this.vx) > 20 ? Math.sin(this.time * 17) * 3 : 0;
    ctx.fillStyle = '#2c3733'; ctx.fillRect(p.x + 3, p.y + 23, 6, 8 + walk); ctx.fillRect(p.x + 14, p.y + 23, 6, 8 - walk);
    ctx.fillStyle = '#e4d5b5'; ctx.fillRect(p.x + 2, p.y + 9, 19, 17); ctx.fillStyle = '#899879'; ctx.fillRect(p.x + 2, p.y + 14, 19, 6);
    ctx.fillStyle = '#c4a57f'; ctx.fillRect(p.x + 5, p.y, 14, 12); ctx.fillStyle = '#353e34'; ctx.fillRect(p.x + 3, p.y - 1, 17, 5); ctx.fillRect(p.x, p.y + 3, 24, 3);
    ctx.fillStyle = '#26342e'; ctx.fillRect(p.x + (this.vx < 0 ? 7 : 16), p.y + 8, 2, 2);
    if (hover) { ctx.strokeStyle = '#f1e9ca'; ctx.lineWidth = 1.5; ctx.strokeRect(hover.x * TILE + 2, hover.y * TILE + 2, 28, 28); }
    for (const a of this.particles) { ctx.globalAlpha = Math.max(0, a.life / .6); ctx.fillStyle = a.color; ctx.fillRect(a.x, a.y, 4, 4); } ctx.globalAlpha = 1;
    if (!this.reducedMotion) for (let n = 0; n < 12; n++) { ctx.globalAlpha = .3; ctx.fillStyle = '#e8d9a3'; const x = ((n * 271 + this.time * 7) % (COLS * TILE)); const y = 350 + Math.sin(n * 2 + this.time * .5) * 110; ctx.fillRect(x, y, 2, 2); } ctx.globalAlpha = 1;
    ctx.restore();
  }
}
