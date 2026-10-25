import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BINDING_PRESETS,
  DEFAULT_BINDINGS,
  assignKeyBinding,
  boxesOverlap,
  createMatch,
  findBindingConflicts,
  getActiveAttackHitbox,
  getFighterHurtbox,
  nextRound,
  readControlsFromKeys,
  stepMatch,
  type PlayerControls,
} from './engine';
import { getAllBoxingAssetUrls, BOXING_ASSET_PATHS } from './assets';
import { selectFighterSpriteFile } from './render';

const idle = (): PlayerControls => ({
  left: false,
  right: false,
  block: false,
  punch: false,
});

test('default shared keyboard bindings use exact 4 keys per player with zero conflicts', () => {
  assert.deepEqual(DEFAULT_BINDINGS.p1, {
    left: 'KeyA',
    right: 'KeyD',
    block: 'KeyW',
    punch: 'KeyF',
  });
  assert.deepEqual(DEFAULT_BINDINGS.p2, {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    block: 'ArrowUp',
    punch: 'KeyL',
  });
  assert.deepEqual(findBindingConflicts(DEFAULT_BINDINGS), []);

  for (const preset of Object.values(BINDING_PRESETS)) {
    assert.deepEqual(findBindingConflicts(preset.bindings), []);
  }
});

test('single punch key automatically chains jab -> hook -> uppercut and resets', () => {
  const m = createMatch('local1v1');
  // Place fighters in close range so punches connect
  m.fighters.p1.x = 410;
  m.fighters.p2.x = 490;

  // Tap 1: Jab
  stepMatch(m, { p1: { ...idle(), punch: true }, p2: idle() }, 0.016, true);
  assert.equal(m.fighters.p1.attack?.type, 'jab');
  assert.equal(m.fighters.p1.comboStage, 1);

  // Release punch key and advance through jab to chain window
  for (let i = 0; i < 16; i++) {
    stepMatch(m, { p1: idle(), p2: idle() }, 0.02, true);
  }

  // Keep P2 in range and Tap 2: Hook
  m.fighters.p2.x = m.fighters.p1.x + 80;
  stepMatch(m, { p1: { ...idle(), punch: true }, p2: idle() }, 0.016, true);
  assert.equal(m.fighters.p1.attack?.type, 'hook');
  assert.equal(m.fighters.p1.comboStage, 2);

  // Release punch key and advance through hook to chain window
  for (let i = 0; i < 18; i++) {
    stepMatch(m, { p1: idle(), p2: idle() }, 0.02, true);
  }

  // Keep P2 in range and Tap 3: Uppercut
  m.fighters.p2.x = m.fighters.p1.x + 80;
  stepMatch(m, { p1: { ...idle(), punch: true }, p2: idle() }, 0.016, true);
  assert.equal(m.fighters.p1.attack?.type, 'uppercut');
  assert.equal(m.fighters.p1.comboStage, 0);
  assert.equal(m.fighters.p1.stats.combosCompleted, 1);
  assert.ok(m.fighters.p2.hp < 100, 'combo chain dealt damage');
});

test('both players move, block, and attack simultaneously with zero turn-order bias', () => {
  const m = createMatch('local1v1');
  const startP1X = m.fighters.p1.x;
  const startP2X = m.fighters.p2.x;

  // Simultaneous movement toward center using shared keyboard keys
  const heldKeys = new Set(['KeyD', 'ArrowLeft', 'KeyW', 'ArrowUp']);
  const p1Ctrl = readControlsFromKeys(heldKeys, DEFAULT_BINDINGS.p1);
  const p2Ctrl = readControlsFromKeys(heldKeys, DEFAULT_BINDINGS.p2);

  for (let i = 0; i < 15; i++) {
    stepMatch(m, { p1: p1Ctrl, p2: p2Ctrl }, 0.02, true);
  }
  assert.ok(m.fighters.p1.x > startP1X, 'Player 1 moved right');
  assert.ok(m.fighters.p2.x < startP2X, 'Player 2 moved left simultaneously');
  assert.equal(m.fighters.p1.blocking, true, 'Player 1 blocking while moving');
  assert.equal(m.fighters.p2.blocking, true, 'Player 2 blocking while moving');

  // Simultaneous punch trade at identical range must resolve symmetrically
  const trade = createMatch('local1v1');
  trade.fighters.p1.x = 415;
  trade.fighters.p2.x = 485;

  stepMatch(
    trade,
    {
      p1: { ...idle(), punch: true },
      p2: { ...idle(), punch: true },
    },
    0.016,
    true
  );

  for (let i = 0; i < 6; i++) {
    stepMatch(trade, { p1: idle(), p2: idle() }, 0.016, true);
  }

  assert.equal(trade.fighters.p1.hp, trade.fighters.p2.hp, 'simultaneous punches deal equal damage to both fighters');
  assert.equal(trade.fighters.p1.stats.landed, 1);
  assert.equal(trade.fighters.p2.stats.landed, 1);
});

test('blocking reduces damage and knockback, and custom bindings prevent conflicts', () => {
  const unblocked = createMatch('local1v1');
  unblocked.fighters.p1.x = 415;
  unblocked.fighters.p2.x = 485;
  stepMatch(unblocked, { p1: { ...idle(), punch: true }, p2: idle() }, 0.016, true);
  for (let i = 0; i < 6; i++) stepMatch(unblocked, { p1: idle(), p2: idle() }, 0.016, true);

  const blocked = createMatch('local1v1');
  blocked.fighters.p1.x = 415;
  blocked.fighters.p2.x = 485;
  // Hold block beyond perfect-block window so regular block is tested
  for (let i = 0; i < 12; i++) {
    stepMatch(blocked, { p1: idle(), p2: { ...idle(), block: true } }, 0.02, true);
  }
  stepMatch(
    blocked,
    { p1: { ...idle(), punch: true }, p2: { ...idle(), block: true } },
    0.016,
    true
  );
  for (let i = 0; i < 6; i++) {
    stepMatch(blocked, { p1: idle(), p2: { ...idle(), block: true } }, 0.016, true);
  }

  assert.ok(blocked.fighters.p2.hp > unblocked.fighters.p2.hp, 'blocking mitigates punch damage');
  assert.equal(blocked.fighters.p2.stats.blocked, 1);

  // Rebinding P2 punch to KeyF (currently P1 punch) swaps cleanly without conflict
  const rebound = assignKeyBinding(DEFAULT_BINDINGS, 'p2', 'punch', 'KeyF');
  assert.equal(rebound.bindings.p2.punch, 'KeyF');
  assert.equal(rebound.bindings.p1.punch, 'KeyL');
  assert.ok(rebound.swappedWith?.includes('Player 1'));
  assert.deepEqual(findBindingConflicts(rebound.bindings), []);
});

test('single player vs AI mode drives P2 autonomously across Easy, Normal, and Hard difficulties', () => {
  for (const diff of ['easy', 'normal', 'hard'] as const) {
    const aiMatch = createMatch('ai', diff);
    assert.equal(aiMatch.aiDifficulty, diff);
    const initialAiX = aiMatch.fighters.p2.x;
    for (let i = 0; i < 90; i++) {
      stepMatch(aiMatch, { p1: idle() }, 0.02, true);
    }
    assert.ok(
      aiMatch.fighters.p2.x < initialAiX || aiMatch.fighters.p2.stats.thrown > 0,
      `AI (${diff}) approaches and engages Player 1`
    );
  }
});

test('2D spatial hitboxes and hurtboxes detect punch contact and emit visual effects', () => {
  const m = createMatch('local1v1');
  m.fighters.p1.x = 415;
  m.fighters.p2.x = 485;

  const p2Hurt = getFighterHurtbox(m.fighters.p2);
  assert.ok(p2Hurt.width > 0 && p2Hurt.height > 0);
  assert.equal(getActiveAttackHitbox(m.fighters.p1), null);

  stepMatch(m, { p1: { ...idle(), punch: true }, p2: idle() }, 0.016, false);
  let sawActiveHitbox = false;
  for (let i = 0; i < 8; i++) {
    const hb = getActiveAttackHitbox(m.fighters.p1);
    if (hb) {
      sawActiveHitbox = true;
      assert.ok(boxesOverlap(hb, getFighterHurtbox(m.fighters.p2)));
    }
    stepMatch(m, { p1: idle(), p2: idle() }, 0.016, false);
  }
  assert.equal(sawActiveHitbox, true);
  assert.ok(m.effects.length > 0, 'hit sparks and punch trails emitted');
});

test('KO knockdown, round end, and match victory progression work cleanly', () => {
  const m = createMatch('local1v1');
  m.fighters.p1.x = 420;
  m.fighters.p2.x = 480;
  m.fighters.p2.hp = 5;

  stepMatch(m, { p1: { ...idle(), punch: true }, p2: idle() }, 0.016, true);
  for (let i = 0; i < 8; i++) {
    stepMatch(m, { p1: idle(), p2: idle() }, 0.016, true);
  }

  assert.equal(m.fighters.p2.hp, 0);
  assert.equal(m.fighters.p1.stats.knockdowns, 1);
  assert.equal(m.status, 'round_over');
  assert.equal(m.winner, 'p1');
  assert.equal(m.scores.p1, 1);

  // Advance into Round 2
  const r2 = nextRound(m);
  assert.equal(r2.round, 2);
  assert.equal(r2.fighters.p2.hp, 100);

  // Win Round 2 for match_over
  r2.fighters.p1.x = 420;
  r2.fighters.p2.x = 480;
  r2.fighters.p2.hp = 5;
  stepMatch(r2, { p1: { ...idle(), punch: true }, p2: idle() }, 0.016, true);
  for (let i = 0; i < 8; i++) {
    stepMatch(r2, { p1: idle(), p2: idle() }, 0.016, true);
  }
  assert.equal(r2.status, 'match_over');
  assert.equal(r2.winner, 'p1');
  assert.equal(r2.scores.p1, 2);
});

test('every supplied and generated boxing asset file exists on disk with valid PNG dimensions', () => {
  const publicDir = path.resolve(process.cwd(), 'public');
  const urls = getAllBoxingAssetUrls();
  assert.ok(urls.length >= 60, 'comprehensive asset catalog registered');

  for (const url of urls) {
    const rel = url.replace(/^\//, '');
    const fullPath = path.join(publicDir, rel);
    assert.ok(fs.existsSync(fullPath), `Asset exists: ${url}`);
    const buf = fs.readFileSync(fullPath);
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    assert.equal(buf[0], 0x89);
    assert.equal(buf[1], 0x50);
    assert.equal(buf[2], 0x4e);
    assert.equal(buf[3], 0x47);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.ok(width > 0 && height > 0, `Valid dimensions for ${url}`);

    if (url.includes('/characters/player_')) {
      assert.equal(width, 160, `${url} width is 160`);
      assert.equal(height, 160, `${url} height is 160`);
    }
  }

  // Also verify sprite state selector covers all poses cleanly
  const m = createMatch('local1v1');
  assert.ok(selectFighterSpriteFile(m.fighters.p1, m, 0).startsWith('idle_'));
  m.fighters.p1.blocking = true;
  assert.equal(selectFighterSpriteFile(m.fighters.p1, m, 0), 'block.png');
  m.fighters.p1.blocking = false;
  m.fighters.p1.stunTimer = 0.1;
  m.fighters.p1.lastHitSeverity = 'light';
  assert.equal(selectFighterSpriteFile(m.fighters.p1, m, 0), 'hit_01.png');
  m.fighters.p1.lastHitSeverity = 'heavy';
  assert.equal(selectFighterSpriteFile(m.fighters.p1, m, 0), 'hit_02.png');
  m.fighters.p1.stunTimer = 0;
  m.fighters.p1.hp = 0;
  m.fighters.p1.koFallTimer = 0.08;
  assert.equal(selectFighterSpriteFile(m.fighters.p1, m, 0), 'ko_01.png');
  m.fighters.p1.koFallTimer = 0.6;
  assert.equal(selectFighterSpriteFile(m.fighters.p1, m, 0), 'ko.png');
  assert.ok(BOXING_ASSET_PATHS.backgrounds.full);
});
