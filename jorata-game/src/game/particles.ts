// Micro-particle and visual effects engine for JORATA.
// Adds tactile visual juice for block placements, breaks, footsteps, and meadow ambiance.

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  maxLife: number;
  life: number;
  gravity?: number;
  shape?: 'rect' | 'circle' | 'sparkle' | 'text';
  text?: string;
  rotation?: number;
  vRot?: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private ambientSpores: { x: number; y: number; size: number; speed: number; phase: number; opacity: number }[] = [];

  constructor() {
    // Generate gentle ambient meadow spores
    for (let i = 0; i < 28; i++) {
      this.ambientSpores.push({
        x: Math.random() * 3200,
        y: Math.random() * 1400,
        size: 1.5 + Math.random() * 2.2,
        speed: 12 + Math.random() * 18,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.35 + Math.random() * 0.45,
      });
    }
  }

  public addBreak(worldX: number, worldY: number, color: string) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const speed = 40 + Math.random() * 85;
      this.particles.push({
        x: worldX + 16 + (Math.random() - 0.5) * 12,
        y: worldY + 16 + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        size: 3 + Math.random() * 4,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.25,
        gravity: 240,
        shape: 'rect',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 12,
      });
    }
  }

  public addPlace(worldX: number, worldY: number, color: string) {
    const count = 7;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 15 + Math.random() * 35;
      this.particles.push({
        x: worldX + 16 + Math.cos(angle) * 8,
        y: worldY + 16 + Math.sin(angle) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        size: 3.5 + Math.random() * 2.5,
        color: '#ffffff',
        alpha: 1,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.2,
        gravity: -15, // Rise gently
        shape: 'sparkle',
      });
    }
  }

  public addFootstep(worldX: number, worldY: number) {
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x: worldX + (Math.random() - 0.5) * 8,
        y: worldY + (Math.random() - 0.5) * 3,
        vx: (Math.random() - 0.5) * 20,
        vy: -10 - Math.random() * 15,
        size: 2.5 + Math.random() * 2,
        color: '#738a6a',
        alpha: 0.65,
        life: 0,
        maxLife: 0.3,
        gravity: 15,
        shape: 'circle',
      });
    }
  }

  public addLanding(worldX: number, worldY: number) {
    // Twin burst of landing dust
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        this.particles.push({
          x: worldX + dir * 6,
          y: worldY,
          vx: dir * (25 + Math.random() * 45),
          vy: -15 - Math.random() * 20,
          size: 3 + Math.random() * 2.5,
          color: '#657e5e',
          alpha: 0.7,
          life: 0,
          maxLife: 0.35,
          gravity: 25,
          shape: 'circle',
        });
      }
    }
  }

  public addFloatingEmote(worldX: number, worldY: number, emote: string) {
    this.particles.push({
      x: worldX,
      y: worldY - 15,
      vx: 0,
      vy: -32,
      size: 22,
      color: '#ffffff',
      alpha: 1,
      life: 0,
      maxLife: 1.6,
      gravity: -4,
      shape: 'text',
      text: emote,
    });
  }

  public update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) {
        p.vy += p.gravity * dt;
      }
      p.vx *= 0.94;
      p.vy *= 0.96;
      if (p.rotation !== undefined && p.vRot !== undefined) {
        p.rotation += p.vRot * dt;
      }
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    }
  }

  public draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, width: number, height: number, now: number) {
    // 1. Draw ambient breeze spores
    ctx.save();
    for (const spore of this.ambientSpores) {
      const screenX = ((spore.x - cameraX * 0.25 + (now / 1000) * spore.speed) % (width + 120)) - 60;
      const screenY = ((spore.y - cameraY * 0.25 + Math.sin(now / 1000 + spore.phase) * 16) % (height + 80)) - 40;

      ctx.fillStyle = `rgba(247, 244, 222, ${spore.opacity * 0.8})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, spore.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Draw game world particles
    if (this.particles.length === 0) return;

    ctx.save();
    for (const p of this.particles) {
      const px = p.x - cameraX;
      const py = p.y - cameraY;

      // Skip offscreen
      if (px < -40 || px > width + 40 || py < -40 || py > height + 40) continue;

      ctx.globalAlpha = p.alpha;

      if (p.shape === 'text' && p.text) {
        ctx.font = '22px system-ui, "Apple Color Emoji", "Segoe UI Emoji"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, px, py);
      } else if (p.shape === 'sparkle') {
        ctx.fillStyle = p.color;
        const s = p.size * (1 - p.life / p.maxLife);
        ctx.fillRect(px - s, py - s / 3, s * 2, (s * 2) / 3);
        ctx.fillRect(px - s / 3, py - s, (s * 2) / 3, s * 2);
      } else if (p.shape === 'rect') {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(px, py);
        if (p.rotation) ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

export const particles = new ParticleSystem();
