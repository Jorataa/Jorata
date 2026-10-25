import {
  BOXING_ASSET_PATHS,
  getBoxingAssetStore,
  type CharacterSpriteFile,
} from './assets';
import {
  PUNCH_SPECS,
  RING_HEIGHT,
  RING_LEFT,
  RING_RIGHT,
  RING_WIDTH,
  type FighterState,
  type MatchState,
  type SpriteEffect,
} from './engine';

const SPRITE_CANVAS_SIZE = 160;
const SPRITE_FOOT_Y = 148;
const SPRITE_SCALE = 1.22;
const SPRITE_DRAW_SIZE = Math.round(SPRITE_CANVAS_SIZE * SPRITE_SCALE); // 195px
const SPRITE_ANCHOR_Y = Math.round(SPRITE_FOOT_Y * SPRITE_SCALE); // 181px
const GROUND_Y = 362;

// Precomputed deterministic ringside spectator rim-lit silhouettes in the seating tiers (y = 214..234)
const CROWD_SEEDS = Array.from({ length: 32 }, (_, i) => ({
  baseX: 60 + i * 26 + ((i * 7) % 9) - 4,
  baseY: 222 + ((i * 11) % 10),
  headW: 6 + (i % 2),
  headH: 6 + ((i + 1) % 2),
  shoulderW: 12 + (i % 3) * 2,
  shoulderH: 10 + (i % 2) * 2,
  phase: i * 0.9,
  speed: 2.0 + (i % 4) * 0.35,
  warmSide: i < 16,
}));

const DUST_MOTES = Array.from({ length: 14 }, (_, i) => ({
  seedX: 160 + ((i * 67) % 580),
  seedY: 44 + ((i * 43) % 250),
  speedX: (i % 2 === 0 ? 1 : -1) * (4 + (i % 4) * 1.8),
  speedY: -3.2 - (i % 3) * 1.4,
  phase: i * 1.3,
  warm: i % 2 === 0,
}));

const CAMERA_FLASH_SEEDS = [
  { x: 142, y: 158, period: 4.7, offset: 0.3 },
  { x: 268, y: 144, period: 6.1, offset: 1.9 },
  { x: 634, y: 150, period: 5.3, offset: 2.8 },
  { x: 752, y: 164, period: 6.9, offset: 4.1 },
  { x: 486, y: 138, period: 7.4, offset: 0.9 },
];

let sharedFlashCanvas: HTMLCanvasElement | null = null;
function getFlashedSpriteCanvas(spriteImg: HTMLImageElement): HTMLCanvasElement | HTMLImageElement {
  if (typeof document === 'undefined') return spriteImg;
  if (!sharedFlashCanvas) {
    sharedFlashCanvas = document.createElement('canvas');
    sharedFlashCanvas.width = SPRITE_CANVAS_SIZE;
    sharedFlashCanvas.height = SPRITE_CANVAS_SIZE;
  }
  const fctx = sharedFlashCanvas.getContext('2d');
  if (!fctx) return spriteImg;
  fctx.imageSmoothingEnabled = false;
  fctx.globalCompositeOperation = 'source-over';
  fctx.clearRect(0, 0, SPRITE_CANVAS_SIZE, SPRITE_CANVAS_SIZE);
  fctx.drawImage(spriteImg, 0, 0, SPRITE_CANVAS_SIZE, SPRITE_CANVAS_SIZE);
  fctx.globalCompositeOperation = 'source-atop';
  fctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
  fctx.fillRect(0, 0, SPRITE_CANVAS_SIZE, SPRITE_CANVAS_SIZE);
  fctx.globalCompositeOperation = 'source-over';
  return sharedFlashCanvas;
}

export function selectFighterSpriteFile(
  f: FighterState,
  state: MatchState,
  time: number
): CharacterSpriteFile {
  if (f.hp <= 0) {
    return f.koFallTimer < 0.42 ? 'ko_01.png' : 'ko.png';
  }

  if (state.status !== 'active' && state.winner === f.id) {
    return 'win.png';
  }

  if (f.stunTimer > 0) {
    if (f.lastHitSeverity === 'heavy' || f.stunTimer > 0.16) {
      return 'hit_02.png';
    }
    return 'hit_01.png';
  }

  if (f.attack) {
    const spec = PUNCH_SPECS[f.attack.type];
    const { elapsed } = f.attack;
    const activeEnd = spec.startup + spec.active;
    const total = activeEnd + spec.recovery;

    if (f.attack.type === 'jab') {
      if (elapsed < spec.startup) return 'jab_01.png';
      if (elapsed <= activeEnd + spec.recovery * 0.35) return 'jab_02.png';
      if (elapsed <= total * 0.82) return 'jab_03.png';
      return 'jab_01.png';
    }

    if (f.attack.type === 'hook') {
      if (elapsed < spec.startup) return 'hook_01.png';
      if (elapsed <= activeEnd + spec.recovery * 0.3) return 'hook_02.png';
      return 'hook_03.png';
    }

    if (elapsed < spec.startup * 0.45) return 'duck_01.png';
    if (elapsed < spec.startup) return 'uppercut_01.png';
    if (elapsed <= activeEnd + spec.recovery * 0.32) return 'uppercut_02.png';
    return 'uppercut_03.png';
  }

  if (f.blocking) {
    if (f.blockTimer > 0 && f.blockTimer <= 0.08) {
      return 'duck_02.png';
    }
    return 'block.png';
  }

  if (f.exhaustedTimer > 0.16) {
    return 'duck_01.png';
  }

  if (Math.abs(f.vx) > 20) {
    const walkOrder: CharacterSpriteFile[] = [
      'walk_01.png',
      'walk_03.png',
      'walk_02.png',
      'idle_01.png',
    ];
    const idx = Math.floor(time * 10 + (f.id === 'p1' ? 0 : 2)) % walkOrder.length;
    return walkOrder[idx];
  }

  const idleOrder: CharacterSpriteFile[] = [
    'idle_01.png',
    'idle_03.png',
    'idle_02.png',
    'idle_03.png',
  ];
  const idx = Math.floor(time * 5.2 + (f.id === 'p1' ? 0 : 1)) % idleOrder.length;
  return idleOrder[idx];
}

export function renderRing(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  width: number,
  height: number,
  time: number,
  reducedMotion = false,
  menuActive = false
) {
  const store = getBoxingAssetStore();

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Deep atmospheric arena backdrop across entire viewport
  const fullBgGrad = ctx.createLinearGradient(0, 0, 0, height);
  fullBgGrad.addColorStop(0, '#04060c');
  fullBgGrad.addColorStop(0.5, '#070c18');
  fullBgGrad.addColorStop(1, '#04060b');
  ctx.fillStyle = fullBgGrad;
  ctx.fillRect(0, 0, width, height);

  // Responsive stage scale: allow gentle horizontal crop of outer apron on portrait screens
  // so the ring and fighters remain commanding on both desktop and mobile
  const fitScale = Math.min(width / RING_WIDTH, height / RING_HEIGHT);
  const portraitBoost = width < height ? Math.min(height / (RING_HEIGHT * 1.35), width / 560) : fitScale;
  const scale = Math.max(fitScale, portraitBoost);

  const midX = menuActive ? RING_WIDTH / 2 : (state.fighters.p1.x + state.fighters.p2.x) / 2;
  const focusShiftX = width < RING_WIDTH * scale ? (RING_WIDTH / 2 - midX) * scale * 0.55 : 0;

  const offsetX = Math.floor((width - RING_WIDTH * scale) / 2 + focusShiftX);
  const offsetY = Math.floor((height - RING_HEIGHT * scale) * 0.54);

  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Screen shake on heavy hits / KO
  if (!reducedMotion && state.screenShake > 0) {
    const mag = state.screenShake * 7;
    const sx = Math.round(Math.sin(time * 58) * mag);
    const sy = Math.round(Math.cos(time * 47) * mag * 0.65);
    ctx.translate(sx, sy);
  }

  const menuDrift = !reducedMotion && menuActive ? Math.sin(time * 0.55) * 6 : 0;
  const cameraPanX = Math.round((midX - RING_WIDTH / 2) * 0.22 + menuDrift);

  // 1. Arena Background (ring_background_full.png, 1536x351) rendered without aspect distortion
  const bgImg = store.get(BOXING_ASSET_PATHS.backgrounds.full);

  if (bgImg) {
    const bgScale = 1.15;
    const drawW = Math.round(bgImg.width * bgScale);
    const drawH = Math.round(bgImg.height * bgScale);
    const drawX = Math.round((RING_WIDTH - drawW) / 2 - cameraPanX);
    const drawY = 18;

    // Seamless upper arena rafters extension
    const topGrad = ctx.createLinearGradient(0, -160, 0, 42);
    topGrad.addColorStop(0, '#03050a');
    topGrad.addColorStop(1, '#0b111e');
    ctx.fillStyle = topGrad;
    ctx.fillRect(-300, -160, RING_WIDTH + 600, 202);

    ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);

    // Seamless lower ringside floor extension below the blue apron
    const botGrad = ctx.createLinearGradient(0, drawY + drawH - 4, 0, RING_HEIGHT + 180);
    botGrad.addColorStop(0, '#09152a');
    botGrad.addColorStop(0.18, '#050914');
    botGrad.addColorStop(1, '#03050a');
    ctx.fillStyle = botGrad;
    ctx.fillRect(-300, drawY + drawH - 2, RING_WIDTH + 600, 220);
  } else {
    ctx.fillStyle = '#090e1a';
    ctx.fillRect(0, 0, RING_WIDTH, RING_HEIGHT);
  }

  // 2. Subtle animated crowd silhouettes in the bleachers + camera flash glints
  drawArenaCrowdAmbience(ctx, state, time, cameraPanX, reducedMotion);

  // 3. Cinematic Warm-vs-Cool Overhead Spotlights
  drawOverheadSpotlights(ctx, time, cameraPanX, reducedMotion);

  // 4. Corner Crew Props on the left (Red) and right (Blue) ring aprons
  drawCornerProps(ctx, store, cameraPanX);

  // 5. Draw fighters
  const { p1, p2 } = state.fighters;
  const order: [FighterState, FighterState] =
    p1.hp <= 0 && p2.hp > 0
      ? [p1, p2]
      : p2.hp <= 0 && p1.hp > 0
        ? [p2, p1]
        : p1.attack
          ? [p2, p1]
          : [p1, p2];

  for (const fighter of order) {
    drawFighterSprite(ctx, store, fighter, state, time, reducedMotion, menuActive);
  }

  // 6. Draw pixel-art sprite effects
  for (const effect of state.effects) {
    drawSpriteEffect(ctx, store, effect);
  }

  // 7. Draw subtle particle sparks
  for (const s of state.sparks) {
    ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
    ctx.fillStyle = s.color;
    ctx.fillRect(
      Math.round(s.x - s.size / 2),
      Math.round(s.y - s.size / 2),
      Math.round(s.size),
      Math.round(s.size)
    );
  }
  ctx.globalAlpha = 1;

  // 8. Atmospheric dust motes drifting through the overhead spotlights
  drawSpotlightDustMotes(ctx, time, reducedMotion);

  // 9. Restrained perimeter arena vignette
  drawArenaVignette(ctx);

  // 10. In-canvas pixel-art callout banner on KO / WIN / DRAW
  if (state.status !== 'active' && !menuActive) {
    const bannerUrl =
      state.winner === 'draw'
        ? BOXING_ASSET_PATHS.ui.draw
        : state.winReason.includes('KO')
          ? BOXING_ASSET_PATHS.ui.ko
          : BOXING_ASSET_PATHS.ui.win;
    const bannerImg = store.get(bannerUrl);
    if (bannerImg) {
      const bScale = 1.55;
      const bw = Math.round(bannerImg.width * bScale);
      const bh = Math.round(bannerImg.height * bScale);
      ctx.drawImage(bannerImg, Math.round((RING_WIDTH - bw) / 2), 64, bw, bh);
    }
  }

  ctx.restore();
}

function drawArenaCrowdAmbience(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  time: number,
  cameraPanX: number,
  reducedMotion: boolean
) {
  ctx.save();

  const excitement =
    state.status !== 'active' || state.screenShake > 0.1
      ? 2.2
      : state.fighters.p1.stunTimer > 0 || state.fighters.p2.stunTimer > 0
        ? 1.6
        : 1;

  if (!reducedMotion) {
    for (const flash of CAMERA_FLASH_SEEDS) {
      const cycle = (time + flash.offset) % flash.period;
      if (cycle < 0.09) {
        const alpha = (1 - cycle / 0.09) * 0.65;
        const fx = Math.round(flash.x - cameraPanX * 0.45);
        const fy = flash.y;
        ctx.fillStyle = `rgba(255, 249, 230, ${alpha.toFixed(3)})`;
        ctx.fillRect(fx - 1, fy - 1, 3, 3);
        ctx.fillStyle = `rgba(255, 224, 150, ${(alpha * 0.35).toFixed(3)})`;
        ctx.fillRect(fx - 3, fy - 3, 7, 7);
      }
    }
  }

  // Subtle animated spectator silhouettes in the lower bleacher tier behind the ropes
  const parallaxCrowdX = Math.round(cameraPanX * 0.65);
  for (const c of CROWD_SEEDS) {
    const bob = reducedMotion
      ? 0
      : Math.round(Math.sin(time * c.speed * excitement + c.phase) * (excitement > 1.3 ? 1.6 : 0.9));
    const cx = c.baseX - parallaxCrowdX;
    const cy = c.baseY + bob;

    ctx.fillStyle = c.warmSide ? 'rgba(26, 22, 34, 0.36)' : 'rgba(16, 24, 38, 0.36)';
    ctx.fillRect(Math.round(cx - c.shoulderW / 2), cy, c.shoulderW, c.shoulderH);
    ctx.fillRect(Math.round(cx - c.headW / 2), cy - c.headH + 1, c.headW, c.headH);
  }

  ctx.restore();
}

function drawOverheadSpotlights(
  ctx: CanvasRenderingContext2D,
  time: number,
  cameraPanX: number,
  reducedMotion: boolean
) {
  ctx.save();

  const sway = reducedMotion ? 0 : Math.sin(time * 0.42) * 18;
  const pan = cameraPanX * 0.3;

  const warmTopX = 250 - pan;
  const warmBotX = 310 + sway - pan * 0.6;
  const warmGrad = ctx.createLinearGradient(warmTopX, -20, warmBotX, GROUND_Y + 18);
  warmGrad.addColorStop(0, 'rgba(255, 204, 128, 0.09)');
  warmGrad.addColorStop(0.55, 'rgba(245, 184, 96, 0.04)');
  warmGrad.addColorStop(1, 'rgba(245, 184, 96, 0)');

  ctx.fillStyle = warmGrad;
  ctx.beginPath();
  ctx.moveTo(warmTopX - 44, -20);
  ctx.lineTo(warmTopX + 44, -20);
  ctx.lineTo(warmBotX + 180, GROUND_Y + 18);
  ctx.lineTo(warmBotX - 180, GROUND_Y + 18);
  ctx.closePath();
  ctx.fill();

  const coolTopX = 650 - pan;
  const coolBotX = 590 - sway - pan * 0.6;
  const coolGrad = ctx.createLinearGradient(coolTopX, -20, coolBotX, GROUND_Y + 18);
  coolGrad.addColorStop(0, 'rgba(120, 182, 255, 0.09)');
  coolGrad.addColorStop(0.55, 'rgba(88, 154, 245, 0.04)');
  coolGrad.addColorStop(1, 'rgba(88, 154, 245, 0)');

  ctx.fillStyle = coolGrad;
  ctx.beginPath();
  ctx.moveTo(coolTopX - 44, -20);
  ctx.lineTo(coolTopX + 44, -20);
  ctx.lineTo(coolBotX + 180, GROUND_Y + 18);
  ctx.lineTo(coolBotX - 180, GROUND_Y + 18);
  ctx.closePath();
  ctx.fill();

  const matPool = ctx.createRadialGradient(
    RING_WIDTH / 2 - pan * 0.4,
    GROUND_Y - 6,
    18,
    RING_WIDTH / 2 - pan * 0.4,
    GROUND_Y - 6,
    250
  );
  matPool.addColorStop(0, 'rgba(255, 248, 232, 0.055)');
  matPool.addColorStop(0.6, 'rgba(180, 210, 255, 0.022)');
  matPool.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = matPool;
  ctx.fillRect(140, GROUND_Y - 42, RING_WIDTH - 280, 64);

  ctx.restore();
}

function drawSpotlightDustMotes(
  ctx: CanvasRenderingContext2D,
  time: number,
  reducedMotion: boolean
) {
  if (reducedMotion) return;
  ctx.save();
  for (const m of DUST_MOTES) {
    const x = Math.round(((m.seedX + time * m.speedX) % 620 + 620) % 620 + 140);
    const y = Math.round(((m.seedY + time * m.speedY) % 260 + 260) % 260 + 48);
    const pulse = 0.07 + (Math.sin(time * 1.8 + m.phase) + 1) * 0.045;
    ctx.fillStyle = m.warm
      ? `rgba(255, 232, 186, ${pulse.toFixed(3)})`
      : `rgba(190, 224, 255, ${pulse.toFixed(3)})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
}

function drawArenaVignette(ctx: CanvasRenderingContext2D) {
  ctx.save();
  const vig = ctx.createRadialGradient(
    RING_WIDTH / 2,
    RING_HEIGHT * 0.54,
    RING_WIDTH * 0.34,
    RING_WIDTH / 2,
    RING_HEIGHT * 0.54,
    RING_WIDTH * 0.66
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(0.78, 'rgba(4, 7, 14, 0.2)');
  vig.addColorStop(1, 'rgba(3, 5, 10, 0.56)');
  ctx.fillStyle = vig;
  ctx.fillRect(-200, -120, RING_WIDTH + 400, RING_HEIGHT + 240);
  ctx.restore();
}

function drawCornerProps(
  ctx: CanvasRenderingContext2D,
  store: ReturnType<typeof getBoxingAssetStore>,
  cameraPanX: number
) {
  const stoolRed = store.get(BOXING_ASSET_PATHS.props.stoolRed);
  const bucket = store.get(BOXING_ASSET_PATHS.props.bucket);
  const towel = store.get(BOXING_ASSET_PATHS.props.towel);
  const stoolBlue = store.get(BOXING_ASSET_PATHS.props.stoolBlue);
  const bottle = store.get(BOXING_ASSET_PATHS.props.waterBottle);

  const leftBaseX = Math.round(RING_LEFT - 70 - cameraPanX * 0.4);
  if (stoolRed) {
    ctx.drawImage(
      stoolRed,
      leftBaseX,
      314,
      Math.round(stoolRed.width * 0.72),
      Math.round(stoolRed.height * 0.72)
    );
  }
  if (bucket) {
    ctx.drawImage(
      bucket,
      leftBaseX - 30,
      328,
      Math.round(bucket.width * 0.58),
      Math.round(bucket.height * 0.58)
    );
  }
  if (towel) {
    ctx.drawImage(
      towel,
      leftBaseX + 38,
      258,
      Math.round(towel.width * 0.55),
      Math.round(towel.height * 0.55)
    );
  }

  const rightBaseX = Math.round(RING_RIGHT + 26 - cameraPanX * 0.4);
  if (stoolBlue) {
    ctx.drawImage(
      stoolBlue,
      rightBaseX,
      316,
      Math.round(stoolBlue.width * 0.76),
      Math.round(stoolBlue.height * 0.76)
    );
  }
  if (bottle) {
    ctx.drawImage(
      bottle,
      rightBaseX + 46,
      332,
      Math.round(bottle.width * 0.62),
      Math.round(bottle.height * 0.62)
    );
  }
}

function drawFighterSprite(
  ctx: CanvasRenderingContext2D,
  store: ReturnType<typeof getBoxingAssetStore>,
  f: FighterState,
  state: MatchState,
  time: number,
  reducedMotion: boolean,
  menuActive: boolean
) {
  const isKO = f.hp <= 0;
  const spriteFile = selectFighterSpriteFile(f, state, time);
  const spriteMap =
    f.id === 'p1' ? BOXING_ASSET_PATHS.characters.red : BOXING_ASSET_PATHS.characters.blue;
  const spriteImg = store.get(spriteMap[spriteFile]);

  // On the Main Menu, stage the two fighters in their warm/cool spotlight pools on either side of the central menu
  const baseStageX = menuActive ? (f.id === 'p1' ? 215 : 685) : f.x;

  let offsetX = 0;
  let offsetY = 0;

  if (!reducedMotion) {
    if (isKO) {
      offsetY = 0;
    } else if (f.stunTimer > 0) {
      offsetX = -f.facing * Math.round(Math.sin(f.stunTimer * 45) * 3);
    } else if (f.attack) {
      const spec = PUNCH_SPECS[f.attack.type];
      const { elapsed } = f.attack;
      const activeEnd = spec.startup + spec.active;
      if (elapsed < spec.startup) {
        const t = elapsed / spec.startup;
        offsetX = -f.facing * Math.round((1 - t) * 4);
        offsetY = f.attack.type === 'uppercut' ? Math.round((1 - t) * 4) : 0;
      } else if (elapsed <= activeEnd) {
        offsetX = f.facing * (f.attack.type === 'hook' ? 7 : f.attack.type === 'jab' ? 5 : 4);
        offsetY = f.attack.type === 'uppercut' ? -4 : 0;
      } else {
        const recT = 1 - (elapsed - activeEnd) / spec.recovery;
        offsetX = f.facing * Math.round(Math.max(0, recT) * 4);
      }
    } else if (f.blocking) {
      offsetX = -f.facing * 2;
      offsetY = 1;
    } else if (Math.abs(f.vx) > 20) {
      offsetY = Math.round(Math.abs(Math.sin(time * 16)) * -2);
    } else {
      offsetY = Math.round(Math.sin(time * 5.2 + (f.id === 'p1' ? 0 : 1.6)) * 1.5);
      offsetX = Math.round(Math.cos(time * 2.6 + (f.id === 'p1' ? 0 : 1.6)) * 1);
    }
  }

  const drawFootX = Math.round(baseStageX + offsetX);
  const drawFootY = Math.round(GROUND_Y - f.launchY + offsetY);

  ctx.save();
  ctx.fillStyle = 'rgba(3, 7, 16, 0.28)';
  ctx.beginPath();
  ctx.ellipse(
    Math.round(baseStageX),
    GROUND_Y + 4,
    isKO ? 64 : f.attack ? 44 : 40,
    isKO ? 12 : 10,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = 'rgba(2, 5, 12, 0.56)';
  ctx.beginPath();
  ctx.ellipse(
    Math.round(baseStageX),
    GROUND_Y + 2,
    isKO ? 52 : f.attack ? 33 : 29,
    isKO ? 8 : 6,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(drawFootX, drawFootY);
  ctx.scale(f.facing, 1);

  if (spriteImg) {
    const destX = -Math.round(SPRITE_DRAW_SIZE / 2);
    const destY = -SPRITE_ANCHOR_Y;
    const sourceToDraw =
      f.flashTimer > 0.08 && !reducedMotion ? getFlashedSpriteCanvas(spriteImg) : spriteImg;
    ctx.drawImage(sourceToDraw, destX, destY, SPRITE_DRAW_SIZE, SPRITE_DRAW_SIZE);
  }

  if (f.blocking && !isKO) {
    ctx.strokeStyle =
      f.blockTimer <= 0.15
        ? 'rgba(232, 185, 84, 0.92)'
        : f.id === 'p1'
          ? 'rgba(229, 72, 77, 0.58)'
          : 'rgba(59, 130, 246, 0.58)';
    ctx.lineWidth = f.blockTimer <= 0.15 ? 3 : 2;
    ctx.beginPath();
    ctx.arc(24, -84, 29, -0.82, 0.82);
    ctx.stroke();
  }

  ctx.restore();

  if ((isKO || f.stunTimer > 0.25 || f.exhaustedTimer > 0.1) && !reducedMotion) {
    const starImg = store.get(BOXING_ASSET_PATHS.effects.starStun);
    if (starImg) {
      const sw = Math.round(starImg.width * 0.95);
      const sh = Math.round(starImg.height * 0.95);
      const bobX = Math.round(Math.sin(time * 10) * 4);
      const starY = isKO ? drawFootY - 68 : drawFootY - 148;
      ctx.drawImage(starImg, Math.round(drawFootX - sw / 2 + bobX), starY, sw, sh);
    }
  }

  if (!isKO && !menuActive && state.status === 'active' && (f.comboStage > 0 || f.attack !== null)) {
    const pipY = drawFootY - 146;
    const accent = f.id === 'p1' ? '#e5484d' : '#3b82f6';
    for (let i = 0; i < 3; i++) {
      const px = Math.round(baseStageX - 12 + i * 12);
      const isCurrent = f.comboStage === i;
      const isCompleted = i < f.comboStage;
      ctx.fillStyle = isCurrent ? '#f4f2ec' : isCompleted ? accent : 'rgba(10, 14, 24, 0.75)';
      ctx.fillRect(px - 4, pipY - 2, 8, 4);
    }
  }
}

function drawSpriteEffect(
  ctx: CanvasRenderingContext2D,
  store: ReturnType<typeof getBoxingAssetStore>,
  effect: SpriteEffect
) {
  const progress = Math.min(1, Math.max(0, effect.elapsed / effect.duration));
  let url: string = BOXING_ASSET_PATHS.effects.hitSparks01;

  if (effect.kind === 'hit_sparks') {
    const sparkFrames = [
      BOXING_ASSET_PATHS.effects.hitSparks01,
      BOXING_ASSET_PATHS.effects.hitSparks02,
      BOXING_ASSET_PATHS.effects.hitSparks03,
      BOXING_ASSET_PATHS.effects.hitSparks04,
      BOXING_ASSET_PATHS.effects.hitSparks05,
    ];
    const idx = Math.min(sparkFrames.length - 1, Math.floor(progress * sparkFrames.length));
    url = sparkFrames[idx];
  } else if (effect.kind === 'hit_flash') {
    url = BOXING_ASSET_PATHS.effects.hitFlash;
  } else if (effect.kind === 'punch_trail_red') {
    url = BOXING_ASSET_PATHS.effects.punchTrailRed;
  } else if (effect.kind === 'punch_trail_blue') {
    url = BOXING_ASSET_PATHS.effects.punchTrailBlue;
  } else if (effect.kind === 'punch_trail_alt') {
    url = BOXING_ASSET_PATHS.effects.punchTrailAlt;
  } else if (effect.kind === 'impact_dust') {
    const dustFrames = [
      BOXING_ASSET_PATHS.effects.impactDust01,
      BOXING_ASSET_PATHS.effects.impactDust02,
      BOXING_ASSET_PATHS.effects.impactDust03,
    ];
    const idx = Math.min(dustFrames.length - 1, Math.floor(progress * dustFrames.length));
    url = dustFrames[idx];
  } else if (effect.kind === 'impact_smoke') {
    url = BOXING_ASSET_PATHS.effects.impactSmoke;
  } else if (effect.kind === 'knockdown_dust') {
    url = BOXING_ASSET_PATHS.effects.knockdownDust;
  } else if (effect.kind === 'ring_shake') {
    url = BOXING_ASSET_PATHS.effects.ringShake;
  }

  const img = store.get(url);
  if (!img) return;

  ctx.save();
  ctx.globalAlpha = progress < 0.7 ? 0.95 : Math.max(0, (1 - progress) / 0.3);
  ctx.translate(Math.round(effect.x), Math.round(effect.y));
  ctx.scale(effect.facing, 1);

  const dw = Math.round(img.width * effect.scale);
  const dh = Math.round(img.height * effect.scale);
  ctx.drawImage(img, -Math.round(dw / 2), -Math.round(dh / 2), dw, dh);
  ctx.restore();
}
