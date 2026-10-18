import {
  MATERIALS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  REACH,
  SPAWN,
  TILE_SIZE,
  stepPlayer,
  tileAt,
  type Input,
  type Player,
} from '../../shared/game';
import { GameModel } from './model';
import { sounds } from './audio';
import { particles } from './particles';

const isTyping = () => {
  const el = document.activeElement;
  return (
    !!document.querySelector('[aria-modal="true"]') ||
    (el instanceof HTMLElement &&
    (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName) || el.isContentEditable))
  );
};

export function startRenderer(
  canvas: HTMLCanvasElement,
  model: GameModel,
  sendInput: (input: Input) => void,
  edit: (x: number, y: number, remove: boolean) => void,
  select: (id: number) => void,
  onInspectPlayer?: (player: Player) => void,
  onToggleEmotes?: () => void,
  onSnapshot?: () => void,
  onToggleMode?: () => void
) {
  const ctx = canvas.getContext('2d')!;
  let width = 0;
  let height = 0;
  let frame = 0;
  let last = performance.now();
  let accumulator = 0;
  let inputClock = 0;
  let cameraX = SPAWN.x * TILE_SIZE - 350;
  let cameraY = SPAWN.y * TILE_SIZE - 250;
  let pointer: { x: number; y: number } | null = null;
  const keys = new Set<string>();
  const remote = new Map<string, Player & { prevGrounded?: boolean; walkCycle?: number }>();
  let prevLocalGrounded = true;

  const resize = new ResizeObserver(() => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  });
  resize.observe(canvas);

  function release() {
    keys.clear();
    model.input = { left: false, right: false, jump: false };
    sendInput(model.input);
  }

  function keydown(event: KeyboardEvent) {
    if (isTyping()) return;
    const key = event.key.toLowerCase();

    if (
      ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'w', 'a', 's', 'd'].includes(key)
    ) {
      event.preventDefault();
    }

    keys.add(key);

    // Number keys for material selection
    const material = MATERIALS.find(m => m.key === event.key);
    if (material) {
      select(material.id);
      sounds.playUiClick();
    }

    // Toggle demolish mode with Q or X
    if (key === 'q' || key === 'x') {
      event.preventDefault();
      if (event.repeat) return;
      if (onToggleMode) onToggleMode();
      else model.mode = model.mode === 'remove' ? 'place' : 'remove';
      sounds.playUiClick();
    }

    // Camera snapshot shortcut (C)
    if (key === 'c' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      onSnapshot?.();
    }

    // Emote wheel shortcut (E)
    if (key === 'e') {
      event.preventDefault();
      onToggleEmotes?.();
    }

    // Mute shortcut (M)
    if (key === 'm') {
      event.preventDefault();
      sounds.toggleMute();
    }

    // Enter to chat
    if (event.key === 'Enter') {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent('jorata-open-chat'));
      const input = (document.getElementById('chat-input') || document.getElementById('social-composer')) as HTMLElement | null;
      input?.focus();
      release();
    }
  }

  function keyup(event: KeyboardEvent) {
    keys.delete(event.key.toLowerCase());
  }

  function focusin() {
    if (isTyping()) release();
  }

  function visibility() {
    if (document.hidden) release();
  }

  function move(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function down(event: PointerEvent) {
    if (!model.connected) return;
    event.preventDefault();
    canvas.focus();
    move(event);

    if (pointer) {
      const worldClickX = pointer.x + cameraX;
      const worldClickY = pointer.y + cameraY;

      // Check if clicking on another player to inspect their passport
      for (const p of model.players) {
        if (p.id === model.id) continue;
        const px = p.x * TILE_SIZE;
        const py = p.y * TILE_SIZE;
        if (
          worldClickX >= px - 8 &&
          worldClickX <= px + 32 &&
          worldClickY >= py - 20 &&
          worldClickY <= py + 52
        ) {
          onInspectPlayer?.(p);
          sounds.playUiClick();
          return;
        }
      }

      // Otherwise, tile build or demolish
      const tileX = Math.floor(worldClickX / TILE_SIZE);
      const tileY = Math.floor(worldClickY / TILE_SIZE);
      edit(tileX, tileY, event.button === 2 || event.shiftKey);
    }
  }

  function context(event: MouseEvent) {
    event.preventDefault();
  }

  function leave() {
    pointer = null;
  }

  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', release);
  document.addEventListener('focusin', focusin);
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('contextmenu', context);
  canvas.addEventListener('pointerleave', leave);

  // Draw expressive speech bubble above a player
  function drawSpeechBubble(text: string, x: number, y: number, now: number, bubbleAt: number) {
    ctx.save();
    ctx.font = '500 12px "DM Sans", system-ui, sans-serif';

    // Word wrap text into max 180px
    const maxBubbleWidth = 190;
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxBubbleWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = 16;
    const bubbleContentWidth = Math.min(
      maxBubbleWidth,
      Math.max(...lines.map(l => ctx.measureText(l).width))
    );
    const bubbleWidth = bubbleContentWidth + 24;
    const bubbleHeight = lines.length * lineHeight + 16;

    // Pop-in scale animation
    const age = now - bubbleAt;
    const scale = age < 160 ? Math.sin((age / 160) * (Math.PI / 2)) * 1.05 : 1;

    const bx = x + 12 - (bubbleWidth * scale) / 2;
    const by = y - 36 - bubbleHeight * scale;

    ctx.translate(x + 12, y - 36);
    ctx.scale(scale, scale);
    ctx.translate(-(x + 12), -(y - 36));

    // Shadow
    ctx.shadowColor = 'rgba(18, 36, 30, 0.18)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    // Bubble container
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x + 12 - bubbleWidth / 2, y - 36 - bubbleHeight, bubbleWidth, bubbleHeight, 8);
    ctx.fill();

    // Reset shadow for tail and text
    ctx.shadowColor = 'transparent';

    // Tail pointer pointing down to player head
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + 8, y - 36);
    ctx.lineTo(x + 12, y - 29);
    ctx.lineTo(x + 16, y - 36);
    ctx.closePath();
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = '#d7ded1';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bubble text
    ctx.fillStyle = '#17362a';
    ctx.textAlign = 'center';
    lines.forEach((line, index) => {
      ctx.fillText(
        line,
        x + 12,
        y - 36 - bubbleHeight + 14 + index * lineHeight + lineHeight / 2
      );
    });

    ctx.restore();
  }

  // Draw enhanced player avatar with squash & stretch, expressive eyes, and name badge
  function drawPlayer(p: Player, me: boolean, now: number) {
    const x = p.x * TILE_SIZE - cameraX;
    const y = p.y * TILE_SIZE - cameraY;

    // Animation states
    const isMoving = Math.abs(p.vx) > 0.1 && p.grounded;
    const walk = isMoving ? Math.sin(now / 85) * 3.5 : 0;
    const isJumping = !p.grounded && p.vy < -0.5;
    const isFalling = !p.grounded && p.vy > 1.5;

    // Squash & stretch factors
    let scaleX = 1;
    let scaleY = 1;
    if (isJumping) {
      scaleX = 0.92;
      scaleY = 1.08;
    } else if (isFalling) {
      scaleX = 0.95;
      scaleY = 1.05;
    }

    // Blinking cycle: blink every ~3.5s for 120ms
    const blinkCycle = (now + parseInt(p.id.slice(-4), 16) || 0) % 3600;
    const isBlinking = blinkCycle > 3480;

    ctx.save();
    ctx.translate(x + 12, y + 48);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-(x + 12), -(y + 48));

    // Ambient drop shadow
    ctx.fillStyle = 'rgba(24, 45, 36, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x + 12, y + 50, 13 * scaleX, 4 * scaleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs / Trousers with walking swing
    ctx.fillStyle = '#293e3b';
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 33, 6, 15 + walk, 2);
    ctx.roundRect(x + 14, y + 33, 6, 15 - walk, 2);
    ctx.fill();

    // Boots
    ctx.fillStyle = '#172725';
    ctx.fillRect(x + (p.facing > 0 ? 3 : 2), y + 45 + walk, 7, 3);
    ctx.fillRect(x + (p.facing > 0 ? 14 : 13), y + 45 - walk, 7, 3);

    // Torso / Tunic (Player colored)
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 17, 22, 20, 3);
    ctx.fill();

    // Tunic collar & button detail
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fillRect(x + 10, y + 17, 4, 11);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(x + 11, y + 21, 2, 2);
    ctx.fillRect(x + 11, y + 25, 2, 2);

    // Belt
    ctx.fillStyle = '#223832';
    ctx.fillRect(x + 1, y + 31, 22, 3);
    ctx.fillStyle = '#d5b364';
    ctx.fillRect(x + 10, y + 31, 4, 3);

    // Arms
    ctx.fillStyle = p.color;
    const armSwing = isMoving ? Math.sin(now / 85) * 4 : 0;
    ctx.beginPath();
    ctx.roundRect(x - 3, y + 20 - armSwing, 4.5, 12, 2);
    ctx.roundRect(x + 22, y + 20 + armSwing, 4.5, 12, 2);
    ctx.fill();

    // Hands
    ctx.fillStyle = '#fff0d2';
    ctx.fillRect(x - 3, y + 30 - armSwing, 4.5, 3);
    ctx.fillRect(x + 22, y + 30 + armSwing, 4.5, 3);

    // Head / Face
    ctx.fillStyle = '#ffefd5';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 1, 20, 18, 4);
    ctx.fill();

    // Hair / Cap (Tactile dark slate with highlight)
    ctx.fillStyle = '#2c3e3a';
    ctx.beginPath();
    ctx.roundRect(x + 1, y - 1, 22, 8, [4, 4, 1, 1]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(x + 3, y, 18, 2);

    // Eyes with pupil and expression
    const eyeX = p.facing > 0 ? x + 14 : x + 5;
    if (isBlinking) {
      ctx.fillStyle = '#223832';
      ctx.fillRect(eyeX, y + 9, 4, 1.5);
    } else {
      // Eye white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(eyeX, y + 7, 4, 4);
      // Iris / pupil
      ctx.fillStyle = '#1c312b';
      ctx.fillRect(p.facing > 0 ? eyeX + 1.5 : eyeX, y + 8, 2.5, 3);
      // Specular highlight
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.facing > 0 ? eyeX + 3 : eyeX + 1, y + 7, 1, 1);
    }

    // Rosy cheek
    ctx.fillStyle = 'rgba(235, 120, 120, 0.45)';
    ctx.fillRect(p.facing > 0 ? x + 15 : x + 4, y + 12, 3, 2);

    ctx.restore();

    // Floating Nameplate
    ctx.save();
    ctx.font = '600 11px "Space Grotesk", system-ui, sans-serif';
    ctx.textAlign = 'center';
    const name = p.username;
    const textWidth = ctx.measureText(name).width;
    const tagWidth = textWidth + (me ? 38 : 22);
    const tagX = x + 12 - tagWidth / 2;
    const tagY = y - 24;

    // Nameplate background
    ctx.fillStyle = me ? 'rgba(24, 52, 40, 0.88)' : 'rgba(252, 253, 245, 0.92)';
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagWidth, 19, 5);
    ctx.fill();

    // Subtle border
    ctx.strokeStyle = me ? '#4d7559' : '#d5decb';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Nameplate text & icons
    if (me) {
      ctx.fillStyle = '#d5f07d';
      ctx.fillText(name, x + 12 - 7, tagY + 13.5);
      ctx.font = '700 8px "DM Sans", sans-serif';
      ctx.fillStyle = '#a6cf95';
      ctx.fillText('YOU', x + 12 + textWidth / 2 + 5, tagY + 13);
    } else {
      ctx.fillStyle = '#1c3d31';
      ctx.fillText(name, x + 12, tagY + 13.5);
    }
    ctx.restore();

    // Speech bubble if active
    const bubble = model.getBubble(p.username);
    if (bubble) {
      drawSpeechBubble(bubble.text, x, y, now, bubble.at);
    }
  }

  // Draw tile textures with high-craft pixel detailing
  function drawTile(tile: number, px: number, py: number, x: number, y: number) {
    if (tile === 2) {
      // Grass surface block
      ctx.fillStyle = '#8f6848'; // Rich loam base
      ctx.fillRect(px, py, 32, 32);

      // Grass cap with two-tone bevel
      ctx.fillStyle = '#5ca256';
      ctx.fillRect(px, py, 32, 9);
      ctx.fillStyle = '#78bc70';
      ctx.fillRect(px, py, 32, 3);

      // Root drops into soil
      ctx.fillStyle = '#4c8a47';
      ctx.fillRect(px + 4, py + 9, 3, 4);
      ctx.fillRect(px + 14, py + 9, 4, 6);
      ctx.fillRect(px + 24, py + 9, 3, 3);

      // Soil pebble flecks
      ctx.fillStyle = '#7a5539';
      ctx.fillRect(px + 7, py + 18, 4, 3);
      ctx.fillRect(px + 19, py + 23, 3, 3);
      ctx.fillRect(px + 12, py + 26, 4, 2);

      // Blade tufts waving on top if air above
      if (!tileAt(model.world, x, y - 1)) {
        ctx.fillStyle = '#6ab263';
        if (x % 2 === 0) {
          ctx.fillRect(px + 4, py - 4, 2, 5);
          ctx.fillRect(px + 7, py - 6, 2, 7);
          ctx.fillRect(px + 9, py - 3, 2, 4);
        }
        if (x % 3 === 1) {
          ctx.fillRect(px + 19, py - 5, 2, 6);
          ctx.fillRect(px + 22, py - 3, 2, 4);
        }
      }
    } else if (tile === 4) {
      // Timber block
      ctx.fillStyle = '#9e673c';
      ctx.fillRect(px, py, 32, 32);

      // Top and bottom bevel highlights
      ctx.fillStyle = '#b77d4f';
      ctx.fillRect(px, py, 32, 2);
      ctx.fillStyle = '#754724';
      ctx.fillRect(px, py + 30, 32, 2);

      // Horizontal wood planks
      ctx.fillStyle = '#653a1a';
      ctx.fillRect(px, py + 10, 32, 2);
      ctx.fillRect(px, py + 21, 32, 2);

      // Wood grain lines and nail heads
      ctx.fillStyle = '#83512b';
      ctx.fillRect(px + 6, py + 4, 18, 1);
      ctx.fillRect(px + 4, py + 15, 22, 1);
      ctx.fillRect(px + 8, py + 26, 16, 1);

      // Nails
      ctx.fillStyle = '#3a2110';
      ctx.fillRect(px + 3, py + 5, 2, 2);
      ctx.fillRect(px + 27, py + 5, 2, 2);
      ctx.fillRect(px + 4, py + 16, 2, 2);
      ctx.fillRect(px + 26, py + 26, 2, 2);
    } else if (tile === 6) {
      // Clay / Terracotta brick block
      ctx.fillStyle = '#cf6c50';
      ctx.fillRect(px, py, 32, 32);

      // Mortar seams
      ctx.fillStyle = '#a64d36';
      ctx.fillRect(px, py + 15, 32, 2);
      ctx.fillRect(px + 16, py, 2, 16);
      ctx.fillRect(px + 7, py + 17, 2, 15);
      ctx.fillRect(px + 24, py + 17, 2, 15);

      // Brick surface texture
      ctx.fillStyle = '#e8896f';
      ctx.fillRect(px + 2, py + 2, 12, 2);
      ctx.fillRect(px + 19, py + 2, 11, 2);
      ctx.fillRect(px + 9, py + 18, 13, 2);
    } else if (tile === 7) {
      // Glass / Crystal block
      ctx.fillStyle = 'rgba(125, 206, 196, 0.42)';
      ctx.fillRect(px, py, 32, 32);

      // Beveled frame
      ctx.strokeStyle = 'rgba(215, 250, 245, 0.85)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, 30, 30);

      // Translucent inner frame
      ctx.fillStyle = 'rgba(240, 255, 252, 0.25)';
      ctx.fillRect(px + 3, py + 3, 26, 26);

      // Diagonal specular gleam lines
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(px + 8, py + 4);
      ctx.lineTo(px + 20, py + 4);
      ctx.lineTo(px + 6, py + 18);
      ctx.lineTo(px + 4, py + 18);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(px + 22, py + 14);
      ctx.lineTo(px + 26, py + 14);
      ctx.lineTo(px + 14, py + 26);
      ctx.lineTo(px + 11, py + 26);
      ctx.closePath();
      ctx.fill();
    } else if (tile === 3) {
      // Stone block
      ctx.fillStyle = '#7a817f';
      ctx.fillRect(px, py, 32, 32);
      ctx.fillStyle = '#9aa19e';
      ctx.fillRect(px, py, 32, 2);
      ctx.fillStyle = '#595f5d';
      ctx.fillRect(px, py + 30, 32, 2);
      ctx.fillRect(px + 30, py, 2, 32);
      // Stone clefts
      ctx.fillStyle = '#525856';
      ctx.fillRect(px + 5, py + 8, 11, 2);
      ctx.fillRect(px + 14, py + 10, 2, 8);
      ctx.fillRect(px + 18, py + 20, 9, 2);
    } else if (tile === 1) {
      // Deep soil
      ctx.fillStyle = '#8f6848';
      ctx.fillRect(px, py, 32, 32);
      ctx.fillStyle = '#734e32';
      ctx.fillRect(px + 5, py + 7, 5, 4);
      ctx.fillRect(px + 18, py + 16, 6, 4);
      ctx.fillRect(px + 9, py + 24, 4, 3);
      ctx.fillStyle = '#ad815d';
      ctx.fillRect(px + 22, py + 6, 3, 2);
    } else if (tile === 8) {
      // Bedrock / Deep foundation
      ctx.fillStyle = '#394647';
      ctx.fillRect(px, py, 32, 32);
      ctx.fillStyle = '#273233';
      ctx.fillRect(px, py + 30, 32, 2);
      ctx.fillRect(px + 3, py + 12, 14, 2);
      ctx.fillRect(px + 15, py + 22, 12, 2);
    } else {
      ctx.fillStyle = '#678275';
      ctx.fillRect(px, py, 32, 32);
    }
  }

  function render(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    const typing = isTyping();
    model.input =
      model.connected && !typing
        ? {
            left: keys.has('a') || keys.has('arrowleft') || keys.has('touch-left'),
            right: keys.has('d') || keys.has('arrowright') || keys.has('touch-right'),
            jump: keys.has('w') || keys.has('arrowup') || keys.has(' ') || keys.has('touch-jump'),
          }
        : { left: false, right: false, jump: false };

    // Movement audio triggers
    if (model.local && model.connected) {
      // Jump audio
      if (model.input.jump && model.local.grounded) {
        sounds.playJump();
      }

      // Footstep audio and dust
      if (Math.abs(model.local.vx) > 0.8 && model.local.grounded) {
        sounds.playFootstep();
        if (Math.random() < 0.28) {
          particles.addFootstep(model.local.x * TILE_SIZE + 12, model.local.y * TILE_SIZE + 48);
        }
      }

      // Landing detection
      if (!prevLocalGrounded && model.local.grounded) {
        sounds.playLand();
        particles.addLanding(model.local.x * TILE_SIZE + 12, model.local.y * TILE_SIZE + 48);
      }
      prevLocalGrounded = model.local.grounded;
    }

    accumulator += dt;
    inputClock += dt;

    while (accumulator >= 1 / 60) {
      if (model.local && model.connected) {
        stepPlayer(model.local, model.input, model.world, 1 / 60);
      }
      accumulator -= 1 / 60;
    }

    if (inputClock >= 1 / 30) {
      sendInput(model.input);
      inputClock = 0;
    }

    const self = model.players.find(p => p.id === model.id);
    if (self && model.local && model.connected) {
      const target = { ...self };
      const predictionTime = Math.min(0.12, (now - model.receivedAt) / 1000 + 0.035);
      for (let t = 0; t < predictionTime; t += 1 / 60) {
        stepPlayer(target, model.input, model.world, 1 / 60);
      }
      const dx = target.x - model.local.x;
      const dy = target.y - model.local.y;
      if (Math.abs(dx) > 0.18) model.local.x += dx * Math.min(1, dt * 8);
      if (Math.abs(dy) > 0.25) model.local.y += dy * Math.min(1, dt * 8);
      canvas.dataset.playerX = self.x.toFixed(3);
      canvas.dataset.playerY = self.y.toFixed(3);
    }

    // Camera smoothing
    const focus = model.local || SPAWN;
    const targetX = Math.max(
      0,
      Math.min(model.world.width * TILE_SIZE - width, (focus.x + 0.4) * TILE_SIZE - width / 2)
    );
    const targetY = Math.max(
      0,
      Math.min(model.world.height * TILE_SIZE - height, (focus.y + 0.7) * TILE_SIZE - height * 0.53)
    );
    cameraX += (targetX - cameraX) * Math.min(1, dt * 8);
    cameraY += (targetY - cameraY) * Math.min(1, dt * 8);
    model.cameraX = cameraX;
    model.cameraY = cameraY;
    canvas.dataset.cameraX = String(cameraX);
    canvas.dataset.cameraY = String(cameraY);

    // Update particle physics
    particles.update(dt);

    // 1. Sky & Atmospheric Parallax
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#9fd2cc');
    sky.addColorStop(0.55, '#cce3d8');
    sky.addColorStop(1, '#f1f4df');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    // Sun with radiant corona
    const sunX = width * 0.82 - cameraX * 0.015;
    const sunY = 90 - cameraY * 0.015;
    const corona = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 70);
    corona.addColorStop(0, 'rgba(255, 252, 225, 0.9)');
    corona.addColorStop(0.4, 'rgba(255, 246, 195, 0.45)');
    corona.addColorStop(1, 'rgba(255, 246, 195, 0)');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff9db';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();

    // Parallax Hills & Forest Ridges
    for (let layer = 0; layer < 3; layer++) {
      const speeds = [0.04, 0.09, 0.16];
      const hues = [
        'rgba(145, 183, 163, 0.42)',
        'rgba(110, 163, 138, 0.48)',
        'rgba(82, 138, 114, 0.55)',
      ];
      ctx.fillStyle = hues[layer];
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = -20; x <= width + 20; x += 15) {
        const wave =
          Math.sin((x + cameraX * speeds[layer]) / (160 - layer * 35)) * (40 + layer * 22) +
          layer * 45;
        ctx.lineTo(x, height * 0.48 + wave);
      }
      ctx.lineTo(width, height);
      ctx.fill();
    }

    // 2. World Tiles
    const startX = Math.max(0, Math.floor(cameraX / TILE_SIZE));
    const endX = Math.min(model.world.width - 1, Math.ceil((cameraX + width) / TILE_SIZE));
    const startY = Math.max(0, Math.floor(cameraY / TILE_SIZE));
    const endY = Math.min(model.world.height - 1, Math.ceil((cameraY + height) / TILE_SIZE));

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const tile = tileAt(model.world, x, y);
        if (!tile) continue;
        const px = Math.floor(x * TILE_SIZE - cameraX);
        const py = Math.floor(y * TILE_SIZE - cameraY);
        drawTile(tile, px, py, x, y);
      }
    }

    // Meadow Welcome Signpost
    const signX = 10 * TILE_SIZE - cameraX;
    const signY = 28 * TILE_SIZE - cameraY;
    ctx.fillStyle = '#6e4c30';
    ctx.fillRect(signX + 13, signY - 36, 5, 36);
    ctx.fillStyle = '#f6f0db';
    ctx.beginPath();
    ctx.roundRect(signX - 10, signY - 52, 52, 24, 3);
    ctx.fill();
    ctx.strokeStyle = '#99744c';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 9px "Space Grotesk", system-ui, sans-serif';
    ctx.fillStyle = '#31513e';
    ctx.textAlign = 'center';
    ctx.fillText('MEADOW', signX + 16, signY - 37);

    // 3. Remote Players
    for (const p of model.players) {
      if (p.id === model.id) continue;
      let visual = remote.get(p.id);
      if (!visual) {
        visual = { ...p, prevGrounded: p.grounded };
        remote.set(p.id, visual);
      }
      visual.x += (p.x - visual.x) * Math.min(1, dt * 15);
      visual.y += (p.y - visual.y) * Math.min(1, dt * 15);
      Object.assign(visual, { vx: p.vx, facing: p.facing, grounded: p.grounded });
      drawPlayer(visual, false, now);
    }
    for (const id of remote.keys()) {
      if (!model.players.some(p => p.id === id)) remote.delete(id);
    }

    // 4. Local Player
    if (model.local) {
      drawPlayer(model.local, true, now);
    }

    // 5. Particles (Dust, Sparkles, Debris, Ambient Spores)
    particles.draw(ctx, cameraX, cameraY, width, height, now);

    // 6. Building & Demolish Cursor (Holographic Preview)
    if (pointer && model.local && model.connected) {
      const tx = Math.floor((pointer.x + cameraX) / TILE_SIZE);
      const ty = Math.floor((pointer.y + cameraY) / TILE_SIZE);
      const reachable =
        Math.hypot(
          tx + 0.5 - model.local.x - PLAYER_WIDTH / 2,
          ty + 0.5 - model.local.y - PLAYER_HEIGHT / 2
        ) <= REACH;
      const isProtected = tx >= 10 && tx <= 15 && ty >= 24 && ty <= 29;
      const isRemove = model.mode === 'remove';
      const screenTileX = tx * TILE_SIZE - cameraX;
      const screenTileY = ty * TILE_SIZE - cameraY;

      if (!reachable || (isProtected && !isRemove)) {
        // Out of reach or protected zone
        ctx.fillStyle = 'rgba(215, 92, 70, 0.28)';
        ctx.strokeStyle = '#d75c46';
        ctx.lineWidth = 1.5;
        ctx.fillRect(screenTileX, screenTileY, 32, 32);
        ctx.strokeRect(screenTileX + 1, screenTileY + 1, 30, 30);

        if (isProtected) {
          ctx.font = '800 10px "DM Sans", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText('PROTECTED', screenTileX + 16, screenTileY + 20);
        }
      } else if (isRemove) {
        // Demolish / Pickaxe mode
        const pulse = Math.sin(now / 120) * 0.15 + 0.45;
        ctx.fillStyle = `rgba(230, 85, 60, ${pulse})`;
        ctx.strokeStyle = '#ff5b3b';
        ctx.lineWidth = 2;
        ctx.fillRect(screenTileX, screenTileY, 32, 32);
        ctx.strokeRect(screenTileX + 1, screenTileY + 1, 30, 30);

        // Pickaxe reticle symbol
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenTileX + 8, screenTileY + 8);
        ctx.lineTo(screenTileX + 24, screenTileY + 24);
        ctx.moveTo(screenTileX + 24, screenTileY + 8);
        ctx.lineTo(screenTileX + 8, screenTileY + 24);
        ctx.stroke();
      } else {
        // Holographic build preview
        ctx.save();
        ctx.globalAlpha = 0.75;
        drawTile(model.selected, screenTileX, screenTileY, tx, ty);
        ctx.restore();

        // Pulsing selection border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenTileX + 1, screenTileY + 1, 30, 30);
      }
    }

    frame = requestAnimationFrame(render);
  }

  frame = requestAnimationFrame(render);

  const touch = (event: Event) => {
    const detail = (event as CustomEvent<{ key: string; down: boolean }>).detail;
    if (detail.down) keys.add(`touch-${detail.key}`);
    else keys.delete(`touch-${detail.key}`);
  };
  window.addEventListener('jorata-control', touch);

  return () => {
    release();
    cancelAnimationFrame(frame);
    resize.disconnect();
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('blur', release);
    window.removeEventListener('jorata-control', touch);
    document.removeEventListener('focusin', focusin);
    document.removeEventListener('visibilitychange', visibility);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('contextmenu', context);
    canvas.removeEventListener('pointerleave', leave);
  };
}
