export type FighterId = 'p1' | 'p2';
export type GameMode = 'local1v1' | 'ai';
export type AiDifficulty = 'easy' | 'normal' | 'hard' | 'sparring' | 'contender' | 'champion';
export type CanonicalDifficulty = 'easy' | 'normal' | 'hard';
export type PunchType = 'jab' | 'hook' | 'uppercut';
export type ControlAction = 'left' | 'right' | 'block' | 'punch';

export interface PlayerControls {
  left: boolean;
  right: boolean;
  block: boolean;
  punch: boolean;
}

export interface KeyBindingSet {
  left: string;
  right: string;
  block: string;
  punch: string;
}

export interface DualKeyBindings {
  p1: KeyBindingSet;
  p2: KeyBindingSet;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PunchSpec {
  type: PunchType;
  label: string;
  startup: number;
  active: number;
  recovery: number;
  chainFromRecovery: number;
  damage: number;
  blockedDamage: number;
  staminaCost: number;
  guardStaminaDrain: number;
  knockback: number;
  blockedKnockback: number;
  stepIn: number;
  reach: number;
  hitStun: number;
  blockStun: number;
  comboWindow: number;
}

export const PUNCH_CHAIN: readonly PunchType[] = ['jab', 'hook', 'uppercut'] as const;

export const PUNCH_SPECS: Record<PunchType, PunchSpec> = {
  jab: {
    type: 'jab',
    label: 'Jab',
    startup: 0.05,
    active: 0.09,
    recovery: 0.14,
    chainFromRecovery: 0.06,
    damage: 8,
    blockedDamage: 1.5,
    staminaCost: 9,
    guardStaminaDrain: 6,
    knockback: 16,
    blockedKnockback: 6,
    stepIn: 14,
    reach: 96,
    hitStun: 0.24,
    blockStun: 0.11,
    comboWindow: 0.68,
  },
  hook: {
    type: 'hook',
    label: 'Hook',
    startup: 0.07,
    active: 0.10,
    recovery: 0.17,
    chainFromRecovery: 0.08,
    damage: 13,
    blockedDamage: 2.5,
    staminaCost: 13,
    guardStaminaDrain: 10,
    knockback: 22,
    blockedKnockback: 9,
    stepIn: 18,
    reach: 100,
    hitStun: 0.28,
    blockStun: 0.14,
    comboWindow: 0.72,
  },
  uppercut: {
    type: 'uppercut',
    label: 'Uppercut',
    startup: 0.09,
    active: 0.12,
    recovery: 0.26,
    chainFromRecovery: 0.26,
    damage: 20,
    blockedDamage: 4,
    staminaCost: 18,
    guardStaminaDrain: 16,
    knockback: 68,
    blockedKnockback: 18,
    stepIn: 22,
    reach: 104,
    hitStun: 0.40,
    blockStun: 0.20,
    comboWindow: 0,
  },
};

export const DEFAULT_BINDINGS: DualKeyBindings = {
  p1: {
    left: 'KeyA',
    right: 'KeyD',
    block: 'KeyW',
    punch: 'KeyF',
  },
  p2: {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    block: 'ArrowUp',
    punch: 'KeyL',
  },
};

export const BINDING_PRESETS: Record<string, { name: string; note: string; bindings: DualKeyBindings }> = {
  default: {
    name: 'Standard Laptop (Default)',
    note: 'P1: A/D/W/F · P2: Arrows + L',
    bindings: DEFAULT_BINDINGS,
  },
  homerow: {
    name: 'Wide Home-Row Anti-Ghosting',
    note: 'P1: A/D/W/F · P2: J/L/I/K (avoids arrow matrix)',
    bindings: {
      p1: { left: 'KeyA', right: 'KeyD', block: 'KeyW', punch: 'KeyF' },
      p2: { left: 'KeyJ', right: 'KeyL', block: 'KeyI', punch: 'KeyK' },
    },
  },
  numpad: {
    name: 'Numpad Split',
    note: 'P1: A/D/W/F · P2: Numpad 4/6/8/0',
    bindings: {
      p1: { left: 'KeyA', right: 'KeyD', block: 'KeyW', punch: 'KeyF' },
      p2: { left: 'Numpad4', right: 'Numpad6', block: 'Numpad8', punch: 'Numpad0' },
    },
  },
};

export const RING_LEFT = 104;
export const RING_RIGHT = 796;
export const RING_WIDTH = 900;
export const RING_HEIGHT = 440;
export const FIGHTER_BODY_WIDTH = 52;
export const MIN_FIGHTER_SEPARATION = 54;
export const MAX_HEALTH = 100;
export const MAX_STAMINA = 100;
export const ROUND_DURATION = 90;
export const ROUNDS_TO_WIN = 2;
export const PUNCH_BUFFER_WINDOW = 0.16;
export const PERFECT_BLOCK_WINDOW = 0.15;

export function normalizeDifficulty(diff: AiDifficulty): CanonicalDifficulty {
  if (diff === 'easy' || diff === 'sparring') return 'easy';
  if (diff === 'hard' || diff === 'champion') return 'hard';
  return 'normal';
}

export function formatDifficultyLabel(diff: AiDifficulty): string {
  const c = normalizeDifficulty(diff);
  return c === 'easy' ? 'Easy' : c === 'hard' ? 'Hard' : 'Normal';
}

export interface ActiveAttack {
  type: PunchType;
  elapsed: number;
  hitRegistered: boolean;
  steppedIn: boolean;
}

export interface FighterState {
  id: FighterId;
  name: string;
  x: number;
  vx: number;
  facing: 1 | -1;
  hp: number;
  stamina: number;
  blocking: boolean;
  blockTimer: number;
  comboStage: 0 | 1 | 2;
  comboWindow: number;
  comboHits: number;
  attack: ActiveAttack | null;
  punchBuffer: number;
  punchHeld: boolean;
  stunTimer: number;
  flashTimer: number;
  launchY: number;
  vy: number;
  exhaustedTimer: number;
  lastPunchType: PunchType | null;
  lastHitSeverity: 'light' | 'heavy';
  koFallTimer: number;
  stats: {
    landed: number;
    thrown: number;
    blocked: number;
    perfectBlocks: number;
    combosCompleted: number;
    knockdowns: number;
  };
}

export interface HitSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export type SpriteEffectKind =
  | 'hit_sparks'
  | 'hit_flash'
  | 'punch_trail_red'
  | 'punch_trail_blue'
  | 'punch_trail_alt'
  | 'impact_dust'
  | 'impact_smoke'
  | 'knockdown_dust'
  | 'ring_shake';

export interface SpriteEffect {
  kind: SpriteEffectKind;
  x: number;
  y: number;
  facing: 1 | -1;
  elapsed: number;
  duration: number;
  scale: number;
}

export interface MatchState {
  mode: GameMode;
  aiDifficulty: AiDifficulty;
  round: number;
  roundTimer: number;
  status: 'active' | 'round_over' | 'match_over';
  winner: FighterId | 'draw' | null;
  winReason: string;
  callout: string;
  calloutTimer: number;
  hitStop: number;
  screenShake: number;
  scores: { p1: number; p2: number };
  fighters: {
    p1: FighterState;
    p2: FighterState;
  };
  sparks: HitSpark[];
  effects: SpriteEffect[];
  aiState: {
    decisionTimer: number;
    desiredAction: 'approach' | 'retreat' | 'guard' | 'flurry';
    comboTarget: number;
    punchCooldown: number;
  };
  events: string[];
}

export function createFighter(id: FighterId, name: string): FighterState {
  return {
    id,
    name,
    x: id === 'p1' ? 365 : 535,
    vx: 0,
    facing: id === 'p1' ? 1 : -1,
    hp: MAX_HEALTH,
    stamina: MAX_STAMINA,
    blocking: false,
    blockTimer: 0,
    comboStage: 0,
    comboWindow: 0,
    comboHits: 0,
    attack: null,
    punchBuffer: 0,
    punchHeld: false,
    stunTimer: 0,
    flashTimer: 0,
    launchY: 0,
    vy: 0,
    exhaustedTimer: 0,
    lastPunchType: null,
    lastHitSeverity: 'light',
    koFallTimer: 0,
    stats: {
      landed: 0,
      thrown: 0,
      blocked: 0,
      perfectBlocks: 0,
      combosCompleted: 0,
      knockdowns: 0,
    },
  };
}

export function createMatch(
  mode: GameMode = 'local1v1',
  aiDifficulty: AiDifficulty = 'normal',
  scores = { p1: 0, p2: 0 },
  round = 1
): MatchState {
  const diffLabel = formatDifficultyLabel(aiDifficulty);
  return {
    mode,
    aiDifficulty,
    round,
    roundTimer: ROUND_DURATION,
    status: 'active',
    winner: null,
    winReason: '',
    callout: `Round ${round} — Fight!`,
    calloutTimer: 1.5,
    hitStop: 0,
    screenShake: 0,
    scores: { ...scores },
    fighters: {
      p1: createFighter('p1', 'Player 1'),
      p2: createFighter('p2', mode === 'ai' ? `AI (${diffLabel})` : 'Player 2'),
    },
    sparks: [],
    effects: [],
    aiState: {
      decisionTimer: 0,
      desiredAction: 'approach',
      comboTarget: 0,
      punchCooldown: 0,
    },
    events: [`Round ${round} started. Both fighters ready.`],
  };
}

export function nextRound(state: MatchState): MatchState {
  if (state.status === 'match_over') {
    return createMatch(state.mode, state.aiDifficulty);
  }
  const next = createMatch(state.mode, state.aiDifficulty, state.scores, state.round + 1);
  next.fighters.p1.stats = { ...state.fighters.p1.stats };
  next.fighters.p2.stats = { ...state.fighters.p2.stats };
  return next;
}

export function getFighterHurtbox(fighter: FighterState): BoundingBox {
  const halfW = FIGHTER_BODY_WIDTH / 2;
  const height = fighter.hp <= 0 ? 48 : 112;
  return {
    x: fighter.x - halfW,
    y: fighter.launchY,
    width: FIGHTER_BODY_WIDTH,
    height,
  };
}

export function getActiveAttackHitbox(fighter: FighterState): BoundingBox | null {
  if (!fighter.attack) return null;
  const spec = PUNCH_SPECS[fighter.attack.type];
  const inActiveWindow =
    fighter.attack.elapsed >= spec.startup &&
    fighter.attack.elapsed <= spec.startup + spec.active;
  if (!inActiveWindow) return null;

  const halfBody = FIGHTER_BODY_WIDTH / 2;
  const extWidth = spec.reach - halfBody + 18;
  const startX = fighter.facing === 1 ? fighter.x - 18 : fighter.x + 18 - extWidth;
  return {
    x: startX,
    y: fighter.launchY + (spec.type === 'uppercut' ? 36 : 52),
    width: extWidth,
    height: spec.type === 'uppercut' ? 68 : 44,
  };
}

export function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

export function formatKeyCode(code: string): string {
  const map: Record<string, string> = {
    KeyA: 'A',
    KeyB: 'B',
    KeyC: 'C',
    KeyD: 'D',
    KeyE: 'E',
    KeyF: 'F',
    KeyG: 'G',
    KeyH: 'H',
    KeyI: 'I',
    KeyJ: 'J',
    KeyK: 'K',
    KeyL: 'L',
    KeyM: 'M',
    KeyN: 'N',
    KeyO: 'O',
    KeyP: 'P',
    KeyQ: 'Q',
    KeyR: 'R',
    KeyS: 'S',
    KeyT: 'T',
    KeyU: 'U',
    KeyV: 'V',
    KeyW: 'W',
    KeyX: 'X',
    KeyY: 'Y',
    KeyZ: 'Z',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Space: 'Space',
    Enter: 'Enter',
    ShiftLeft: 'L-Shift',
    ShiftRight: 'R-Shift',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Numpad0: 'Num 0',
    Numpad4: 'Num 4',
    Numpad5: 'Num 5',
    Numpad6: 'Num 6',
    Numpad8: 'Num 8',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

export function normalizeEventCode(event: { code?: string; key?: string }): string {
  if (event.code) return event.code;
  const k = event.key ?? '';
  if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') return k;
  if (k === ' ') return 'Space';
  if (k.length === 1 && /[a-zA-Z]/.test(k)) return `Key${k.toUpperCase()}`;
  return k;
}

export function findBindingConflicts(bindings: DualKeyBindings): string[] {
  const seen = new Map<string, string>();
  const conflicts: string[] = [];
  for (const fighter of ['p1', 'p2'] as const) {
    for (const action of ['left', 'right', 'block', 'punch'] as const) {
      const code = bindings[fighter][action];
      const label = `${fighter === 'p1' ? 'P1' : 'P2'} ${action}`;
      const existing = seen.get(code);
      if (existing) {
        conflicts.push(`${formatKeyCode(code)} is shared by ${existing} and ${label}`);
      } else {
        seen.set(code, label);
      }
    }
  }
  return conflicts;
}

export function assignKeyBinding(
  bindings: DualKeyBindings,
  fighter: FighterId,
  action: ControlAction,
  newCode: string
): { bindings: DualKeyBindings; swappedWith: string | null } {
  const next: DualKeyBindings = {
    p1: { ...bindings.p1 },
    p2: { ...bindings.p2 },
  };
  const previousCode = next[fighter][action];
  let swappedWith: string | null = null;

  for (const f of ['p1', 'p2'] as const) {
    for (const a of ['left', 'right', 'block', 'punch'] as const) {
      if (f === fighter && a === action) continue;
      if (next[f][a] === newCode) {
        next[f][a] = previousCode;
        swappedWith = `${f === 'p1' ? 'Player 1' : 'Player 2'} ${a}`;
      }
    }
  }

  next[fighter][action] = newCode;
  return { bindings: next, swappedWith };
}

export function readControlsFromKeys(
  activeKeys: ReadonlySet<string>,
  binding: KeyBindingSet
): PlayerControls {
  return {
    left: activeKeys.has(binding.left),
    right: activeKeys.has(binding.right),
    block: activeKeys.has(binding.block),
    punch: activeKeys.has(binding.punch),
  };
}

export function canStartPunch(fighter: FighterState): boolean {
  if (fighter.stunTimer > 0 || fighter.exhaustedTimer > 0) return false;
  const nextType = PUNCH_CHAIN[fighter.comboStage];
  const spec = PUNCH_SPECS[nextType];
  if (fighter.stamina < spec.staminaCost) return false;
  if (!fighter.attack) return true;

  // Allow smooth combo chaining during the tail of the current punch recovery
  const currentSpec = PUNCH_SPECS[fighter.attack.type];
  const totalTime = currentSpec.startup + currentSpec.active + currentSpec.recovery;
  const recoveryStart = currentSpec.startup + currentSpec.active;
  const canChain =
    fighter.attack.type !== 'uppercut' &&
    fighter.attack.elapsed >= recoveryStart + currentSpec.chainFromRecovery &&
    fighter.attack.elapsed <= totalTime;
  return canChain;
}

function startPunch(state: MatchState, fighter: FighterState, reducedMotion: boolean): PunchSpec {
  const punchType = PUNCH_CHAIN[fighter.comboStage];
  const spec = PUNCH_SPECS[punchType];
  fighter.stamina = Math.max(0, fighter.stamina - spec.staminaCost);
  fighter.blocking = false;
  fighter.blockTimer = 0;
  fighter.attack = {
    type: punchType,
    elapsed: 0,
    hitRegistered: false,
    steppedIn: false,
  };
  fighter.lastPunchType = punchType;
  fighter.punchBuffer = 0;
  fighter.stats.thrown += 1;

  if (!reducedMotion) {
    const trailKind: SpriteEffectKind =
      punchType === 'uppercut'
        ? 'punch_trail_alt'
        : fighter.id === 'p1'
          ? 'punch_trail_red'
          : 'punch_trail_blue';
    state.effects.push({
      kind: trailKind,
      x: fighter.x + fighter.facing * 36,
      y: punchType === 'uppercut' ? 236 : 248,
      facing: fighter.facing,
      elapsed: 0,
      duration: spec.startup + spec.active + 0.08,
      scale: punchType === 'uppercut' ? 1.15 : 1.0,
    });
  }

  if (fighter.comboStage === 0) {
    fighter.comboStage = 1;
    fighter.comboWindow = spec.comboWindow;
  } else if (fighter.comboStage === 1) {
    fighter.comboStage = 2;
    fighter.comboWindow = spec.comboWindow;
  } else {
    fighter.comboStage = 0;
    fighter.comboWindow = 0;
    fighter.stats.combosCompleted += 1;
  }

  if (fighter.stamina < 4) {
    fighter.exhaustedTimer = 0.32;
  }

  return spec;
}

export function computeAiControls(state: MatchState, dt: number): PlayerControls {
  const ai = state.fighters.p2;
  const opp = state.fighters.p1;
  const aiMeta = state.aiState;
  const distance = Math.abs(ai.x - opp.x);
  const diff = normalizeDifficulty(state.aiDifficulty);

  const reactionInterval = diff === 'easy' ? 0.26 : diff === 'normal' ? 0.14 : 0.08;
  const blockChance = diff === 'easy' ? 0.35 : diff === 'normal' ? 0.65 : 0.85;
  const maxComboLen = diff === 'easy' ? 2 : 3;

  aiMeta.decisionTimer -= dt;
  aiMeta.punchCooldown = Math.max(0, aiMeta.punchCooldown - dt);

  if (aiMeta.decisionTimer <= 0) {
    aiMeta.decisionTimer = reactionInterval;
    const oppAttackingNear = opp.attack !== null && distance < 118;

    if (oppAttackingNear && ai.stamina > 12) {
      // Deterministic pseudo-choice based on roundTimer + fighter positions
      const roll = Math.abs(Math.sin(state.roundTimer * 17.3 + ai.x * 0.13 + opp.x * 0.07));
      if (roll < blockChance) {
        aiMeta.desiredAction = 'guard';
      } else {
        aiMeta.desiredAction = 'flurry';
      }
    } else if (ai.stamina < 24) {
      aiMeta.desiredAction = distance < 140 ? 'retreat' : 'guard';
    } else if (distance > 94) {
      aiMeta.desiredAction = 'approach';
    } else {
      aiMeta.desiredAction = 'flurry';
      if (aiMeta.comboTarget <= 0) {
        aiMeta.comboTarget = maxComboLen;
      }
    }
  }

  const controls: PlayerControls = {
    left: false,
    right: false,
    block: false,
    punch: false,
  };

  if (ai.stunTimer > 0) return controls;

  const dirToOpponent = opp.x < ai.x ? -1 : 1;

  if (aiMeta.desiredAction === 'guard') {
    controls.block = true;
    if (distance < 74) {
      if (dirToOpponent < 0) controls.right = true;
      else controls.left = true;
    }
    return controls;
  }

  if (aiMeta.desiredAction === 'retreat') {
    if (dirToOpponent < 0) controls.right = true;
    else controls.left = true;
    controls.block = distance < 105;
    return controls;
  }

  if (aiMeta.desiredAction === 'approach') {
    if (distance > 84) {
      if (dirToOpponent < 0) controls.left = true;
      else controls.right = true;
    }
  }

  if (distance <= 98 && aiMeta.punchCooldown <= 0 && canStartPunch(ai)) {
    controls.punch = true;
    aiMeta.comboTarget = Math.max(0, aiMeta.comboTarget - 1);
    const nextStage = ai.comboStage;
    aiMeta.punchCooldown =
      nextStage === 2
        ? diff === 'easy'
          ? 0.55
          : 0.36
        : diff === 'easy'
          ? 0.24
          : 0.16;
  } else if (!ai.attack && ai.punchHeld) {
    // Release punch key between taps so edge trigger works identically to human input
    controls.punch = false;
  }

  return controls;
}

export function stepVisuals(state: MatchState, rawDt: number): void {
  const dt = Math.max(0, Math.min(rawDt, 0.05));
  if (dt === 0) return;

  state.calloutTimer = Math.max(0, state.calloutTimer - dt);
  state.screenShake = Math.max(0, state.screenShake - dt * 3.5);

  state.sparks = state.sparks.filter(s => s.life > 0);
  for (const s of state.sparks) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 420 * dt;
    s.life -= dt;
  }

  state.effects = state.effects.filter(e => e.elapsed < e.duration);
  for (const e of state.effects) {
    e.elapsed += dt;
  }

  for (const f of [state.fighters.p1, state.fighters.p2]) {
    if (f.hp <= 0) {
      f.koFallTimer = Math.min(1, f.koFallTimer + dt * 3.6);
      if (f.launchY > 0 || f.vy !== 0) {
        f.launchY = Math.max(0, f.launchY + f.vy * dt);
        if (f.launchY > 0) f.vy -= 520 * dt;
        else f.vy = 0;
      }
    }
  }
}

interface PendingHit {
  attackerId: FighterId;
  defenderId: FighterId;
  spec: PunchSpec;
  counterHit: boolean;
}

export function stepMatch(
  state: MatchState,
  inputs: { p1: PlayerControls; p2?: PlayerControls },
  rawDt: number,
  reducedMotion = false
): MatchState {
  const dt = Math.max(0, Math.min(rawDt, 0.05));
  if (dt === 0) return state;

  stepVisuals(state, dt);

  if (state.status !== 'active') return state;

  if (state.hitStop > 0) {
    state.hitStop = Math.max(0, state.hitStop - dt);
    return state;
  }

  const p1Input = inputs.p1;
  const p2Input =
    state.mode === 'ai'
      ? computeAiControls(state, dt)
      : (inputs.p2 ?? { left: false, right: false, block: false, punch: false });

  const { p1, p2 } = state.fighters;

  // Always face each other
  if (Math.abs(p2.x - p1.x) > 4) {
    p1.facing = p2.x >= p1.x ? 1 : -1;
    p2.facing = p1.x >= p2.x ? 1 : -1;
  }

  // Step 1: Process inputs, buffers, combos, movement, and stamina for BOTH fighters simultaneously
  for (const [fighter, ctrl] of [
    [p1, p1Input],
    [p2, p2Input],
  ] as const) {
    fighter.stunTimer = Math.max(0, fighter.stunTimer - dt);
    fighter.flashTimer = Math.max(0, fighter.flashTimer - dt);
    fighter.exhaustedTimer = Math.max(0, fighter.exhaustedTimer - dt);
    fighter.punchBuffer = Math.max(0, fighter.punchBuffer - dt);

    // Airborne pop physics (from uppercut / KO)
    if (fighter.launchY > 0 || fighter.vy !== 0) {
      fighter.launchY = Math.max(0, fighter.launchY + fighter.vy * dt);
      if (fighter.launchY > 0) {
        fighter.vy -= 520 * dt;
      } else {
        fighter.launchY = 0;
        fighter.vy = 0;
      }
    }

    // Edge-trigger punch press + input buffer so fast taps never drop
    const freshPunchPress = ctrl.punch && !fighter.punchHeld;
    fighter.punchHeld = ctrl.punch;
    if (freshPunchPress) {
      fighter.punchBuffer = PUNCH_BUFFER_WINDOW;
    }

    // Advance active attack timers
    if (fighter.attack) {
      fighter.attack.elapsed += dt;
      const spec = PUNCH_SPECS[fighter.attack.type];
      if (!fighter.attack.steppedIn && fighter.attack.elapsed >= spec.startup * 0.6) {
        fighter.attack.steppedIn = true;
        fighter.vx += fighter.facing * (spec.stepIn * 8.5);
        if (!reducedMotion) {
          state.effects.push({
            kind: 'impact_dust',
            x: fighter.x - fighter.facing * 18,
            y: 332,
            facing: fighter.facing,
            elapsed: 0,
            duration: 0.24,
            scale: 0.85,
          });
        }
      }
      const totalDuration = spec.startup + spec.active + spec.recovery;
      if (fighter.attack.elapsed >= totalDuration) {
        fighter.attack = null;
      }
    } else if (fighter.comboWindow > 0) {
      fighter.comboWindow = Math.max(0, fighter.comboWindow - dt);
      if (fighter.comboWindow === 0) {
        fighter.comboStage = 0;
      }
    }

    // Trigger buffered punch if ready
    if (fighter.punchBuffer > 0 && canStartPunch(fighter)) {
      startPunch(state, fighter, reducedMotion);
    }

    // Blocking state
    if (!fighter.attack && fighter.stunTimer <= 0 && ctrl.block) {
      fighter.blocking = true;
      fighter.blockTimer += dt;
    } else {
      fighter.blocking = false;
      fighter.blockTimer = 0;
    }

    // Horizontal movement (simultaneous for both players)
    const moveDir = Number(ctrl.right) - Number(ctrl.left);
    if (fighter.stunTimer > 0) {
      fighter.vx *= Math.pow(0.001, dt);
    } else if (fighter.attack) {
      // Allow subtle micro-drift in movement direction while punching
      const driftSpeed = moveDir * 75;
      fighter.vx += (driftSpeed - fighter.vx) * Math.min(1, dt * 10);
    } else {
      const baseSpeed = fighter.blocking ? 135 : fighter.exhaustedTimer > 0 ? 150 : 245;
      const targetVx = moveDir * baseSpeed;
      fighter.vx += (targetVx - fighter.vx) * Math.min(1, dt * 18);
    }

    fighter.x += fighter.vx * dt;

    // Stamina regeneration when not actively throwing a punch
    if (!fighter.attack) {
      const regenRate = fighter.blocking ? 11 : moveDir !== 0 ? 22 : 28;
      fighter.stamina = Math.min(MAX_STAMINA, fighter.stamina + regenRate * dt);
    }
  }

  // Step 2: Keep fighters inside ring ropes and prevent overlapping
  p1.x = Math.max(RING_LEFT, Math.min(RING_RIGHT, p1.x));
  p2.x = Math.max(RING_LEFT, Math.min(RING_RIGHT, p2.x));

  const dist = Math.abs(p2.x - p1.x);
  if (dist < MIN_FIGHTER_SEPARATION) {
    const mid = (p1.x + p2.x) / 2;
    if (p1.x <= p2.x) {
      p1.x = Math.max(RING_LEFT, mid - MIN_FIGHTER_SEPARATION / 2);
      p2.x = Math.min(RING_RIGHT, p1.x + MIN_FIGHTER_SEPARATION);
      if (p2.x - p1.x < MIN_FIGHTER_SEPARATION) {
        p1.x = Math.max(RING_LEFT, p2.x - MIN_FIGHTER_SEPARATION);
      }
    } else {
      p2.x = Math.max(RING_LEFT, mid - MIN_FIGHTER_SEPARATION / 2);
      p1.x = Math.min(RING_RIGHT, p2.x + MIN_FIGHTER_SEPARATION);
    }
  }

  // Step 3: Evaluate spatial hitboxes simultaneously so neither player has frame-order bias!
  const pendingHits: PendingHit[] = [];
  for (const [attacker, defender] of [
    [p1, p2],
    [p2, p1],
  ] as const) {
    if (!attacker.attack || attacker.attack.hitRegistered) continue;
    const attackBox = getActiveAttackHitbox(attacker);
    if (!attackBox) continue;

    const defenderBox = getFighterHurtbox(defender);
    const dx = defender.x - attacker.x;
    const facingCorrect = Math.sign(dx) === attacker.facing || Math.abs(dx) < 20;

    if (facingCorrect && boxesOverlap(attackBox, defenderBox)) {
      const spec = PUNCH_SPECS[attacker.attack.type];
      attacker.attack.hitRegistered = true;
      const defenderInStartup =
        defender.attack !== null &&
        defender.attack.elapsed < PUNCH_SPECS[defender.attack.type].startup;
      pendingHits.push({
        attackerId: attacker.id,
        defenderId: defender.id,
        spec,
        counterHit: defenderInStartup,
      });
    }
  }

  // Step 4: Apply all pending hits simultaneously
  for (const hit of pendingHits) {
    const attacker = state.fighters[hit.attackerId];
    const defender = state.fighters[hit.defenderId];
    const { spec, counterHit } = hit;
    const impactX = (attacker.x + defender.x) / 2 + attacker.facing * 8;
    const impactY = spec.type === 'uppercut' ? 228 : 244;

    const isBlocked =
      defender.blocking &&
      defender.stunTimer <= 0 &&
      defender.attack === null;

    if (isBlocked) {
      const isPerfectBlock = defender.blockTimer > 0 && defender.blockTimer <= PERFECT_BLOCK_WINDOW;
      defender.stats.blocked += 1;

      if (isPerfectBlock) {
        defender.stats.perfectBlocks += 1;
        defender.stamina = Math.min(MAX_STAMINA, defender.stamina + 10);
        attacker.vx = -attacker.facing * 160;
        state.callout = `${defender.name} Perfect Guard!`;
        state.calloutTimer = 1.0;
        spawnSparks(state, impactX, impactY, '#8ce0b3', 8, reducedMotion);
        if (!reducedMotion) {
          state.effects.push({
            kind: 'hit_sparks',
            x: impactX,
            y: impactY,
            facing: attacker.facing,
            elapsed: 0,
            duration: 0.22,
            scale: 0.85,
          });
        }
      } else {
        defender.hp = Math.max(0, Number((defender.hp - spec.blockedDamage).toFixed(1)));
        defender.stamina = Math.max(0, defender.stamina - spec.guardStaminaDrain);
        defender.vx = attacker.facing * (spec.blockedKnockback * 9);
        defender.x = Math.max(RING_LEFT, Math.min(RING_RIGHT, defender.x + attacker.facing * spec.blockedKnockback));

        if (defender.stamina <= 0) {
          // Guard break!
          defender.blocking = false;
          defender.stunTimer = 0.42;
          defender.flashTimer = 0.25;
          defender.lastHitSeverity = 'heavy';
          state.callout = `${defender.name} Guard Broken!`;
          state.calloutTimer = 1.1;
          if (!reducedMotion) {
            state.screenShake = Math.max(state.screenShake, 0.35);
            state.effects.push(
              {
                kind: 'hit_flash',
                x: impactX,
                y: impactY,
                facing: attacker.facing,
                elapsed: 0,
                duration: 0.24,
                scale: 1.15,
              },
              {
                kind: 'impact_smoke',
                x: defender.x,
                y: 265,
                facing: defender.facing,
                elapsed: 0,
                duration: 0.34,
                scale: 1.0,
              }
            );
          }
          spawnSparks(state, defender.x, impactY, '#f2b33d', 12, reducedMotion);
        } else {
          defender.stunTimer = spec.blockStun;
          defender.lastHitSeverity = 'light';
          state.callout = `${defender.name} Blocked ${spec.label}`;
          state.calloutTimer = 0.7;
          if (!reducedMotion) {
            state.effects.push({
              kind: 'impact_dust',
              x: defender.x,
              y: 332,
              facing: defender.facing,
              elapsed: 0,
              duration: 0.22,
              scale: 0.75,
            });
          }
          spawnSparks(state, impactX, impactY, '#c2d0b1', 5, reducedMotion);
        }
      }
    } else {
      // Clean hit landed!
      const damageMultiplier = counterHit ? 1.2 : 1;
      const finalDamage = Number((spec.damage * damageMultiplier).toFixed(1));
      defender.hp = Math.max(0, Number((defender.hp - finalDamage).toFixed(1)));
      defender.blocking = false;
      defender.attack = null;
      defender.stunTimer = spec.hitStun;
      defender.flashTimer = 0.20;
      defender.comboStage = 0;
      defender.comboWindow = 0;
      defender.comboHits = 0;
      defender.lastHitSeverity = spec.type === 'jab' && !counterHit ? 'light' : 'heavy';

      // Apply knockback directly + velocity impulse
      const immediatePush = spec.knockback * 0.55;
      defender.x = Math.max(RING_LEFT, Math.min(RING_RIGHT, defender.x + attacker.facing * immediatePush));
      defender.vx = attacker.facing * (spec.knockback * 7.5);

      if (spec.type === 'uppercut') {
        defender.launchY = 6;
        defender.vy = 165;
        state.hitStop = reducedMotion ? 0 : 0.045;
        if (!reducedMotion) state.screenShake = Math.max(state.screenShake, 0.45);
      } else if (spec.type === 'hook') {
        state.hitStop = reducedMotion ? 0 : 0.025;
        if (!reducedMotion) state.screenShake = Math.max(state.screenShake, 0.25);
      }

      attacker.stats.landed += 1;
      attacker.comboHits += 1;

      const comboPrefix = attacker.comboHits >= 2 ? `${attacker.comboHits}-Hit ` : '';
      const counterPrefix = counterHit ? 'Counter ' : '';
      state.callout = `${attacker.name}: ${counterPrefix}${comboPrefix}${spec.label}!`;
      state.calloutTimer = 1.1;

      if (!reducedMotion) {
        state.effects.push({
          kind: 'hit_sparks',
          x: impactX,
          y: impactY,
          facing: attacker.facing,
          elapsed: 0,
          duration: 0.28,
          scale: spec.type === 'uppercut' ? 1.25 : spec.type === 'hook' ? 1.1 : 0.95,
        });
        if (spec.type !== 'jab' || counterHit) {
          state.effects.push({
            kind: 'hit_flash',
            x: impactX,
            y: impactY,
            facing: attacker.facing,
            elapsed: 0,
            duration: 0.18,
            scale: spec.type === 'uppercut' ? 1.2 : 1.0,
          });
        }
        if (spec.type === 'uppercut') {
          state.effects.push({
            kind: 'knockdown_dust',
            x: defender.x,
            y: 334,
            facing: defender.facing,
            elapsed: 0,
            duration: 0.36,
            scale: 1.05,
          });
        }
      }

      const sparkColor =
        spec.type === 'uppercut' ? '#f59e0b' : spec.type === 'hook' ? '#f97316' : '#f1f2ee';
      spawnSparks(
        state,
        defender.x - attacker.facing * 12,
        impactY,
        sparkColor,
        spec.type === 'uppercut' ? 14 : 8,
        reducedMotion
      );
    }
  }

  if (pendingHits.length === 2 && !p1.blocking && !p2.blocking) {
    state.callout = 'Simultaneous Cross Counter!';
    state.calloutTimer = 1.2;
  }

  // Step 5: Check KO or Timer Expiration
  if (p1.hp <= 0 || p2.hp <= 0) {
    finishRoundByKnockout(state, reducedMotion);
    return state;
  }

  state.roundTimer = Math.max(0, state.roundTimer - dt);
  if (state.roundTimer <= 0) {
    finishRoundByDecision(state);
  }

  return state;
}

function spawnSparks(
  state: MatchState,
  x: number,
  y: number,
  color: string,
  count: number,
  reducedMotion: boolean
) {
  if (reducedMotion) return;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (i % 2) * 0.3;
    const speed = 70 + (i * 29) % 140;
    state.sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      life: 0.35,
      maxLife: 0.35,
      color,
      size: i % 3 === 0 ? 5 : 3,
    });
  }
}

function finishRoundByKnockout(state: MatchState, reducedMotion: boolean) {
  const { p1, p2 } = state.fighters;
  p1.attack = null;
  p2.attack = null;

  for (const f of [p1, p2]) {
    if (f.hp <= 0 && !reducedMotion) {
      state.screenShake = Math.max(state.screenShake, 0.65);
      state.effects.push(
        {
          kind: 'knockdown_dust',
          x: f.x,
          y: 334,
          facing: f.facing,
          elapsed: 0,
          duration: 0.52,
          scale: 1.25,
        },
        {
          kind: 'ring_shake',
          x: f.x,
          y: 338,
          facing: f.facing,
          elapsed: 0,
          duration: 0.45,
          scale: 1.15,
        }
      );
    }
  }

  if (p1.hp <= 0 && p2.hp <= 0) {
    state.status = 'round_over';
    state.winner = 'draw';
    state.winReason = 'Double Knockout!';
    state.callout = 'Double Knockout!';
    state.events.unshift(`Round ${state.round}: Double Knockout!`);
    return;
  }

  const winnerId: FighterId = p1.hp > 0 ? 'p1' : 'p2';
  const loserId: FighterId = winnerId === 'p1' ? 'p2' : 'p1';
  const winner = state.fighters[winnerId];
  const loser = state.fighters[loserId];

  winner.stats.knockdowns += 1;
  loser.launchY = 4;
  loser.vy = 110;
  state.scores[winnerId] += 1;

  if (state.scores[winnerId] >= ROUNDS_TO_WIN) {
    state.status = 'match_over';
    state.winner = winnerId;
    state.winReason = `KO by ${winner.name} in Round ${state.round}`;
    state.callout = `${winner.name} Wins by KO!`;
  } else {
    state.status = 'round_over';
    state.winner = winnerId;
    state.winReason = `Round ${state.round} KO by ${winner.name}`;
    state.callout = `KO! ${winner.name} takes Round ${state.round}!`;
  }
  state.events.unshift(`${state.winReason}.`);
}

function finishRoundByDecision(state: MatchState) {
  const { p1, p2 } = state.fighters;
  p1.attack = null;
  p2.attack = null;

  if (Math.abs(p1.hp - p2.hp) < 0.5) {
    state.status = state.round >= 3 ? 'match_over' : 'round_over';
    state.winner =
      state.scores.p1 > state.scores.p2
        ? 'p1'
        : state.scores.p2 > state.scores.p1
          ? 'p2'
          : 'draw';
    state.winReason = `Round ${state.round} Draw on Judges' Cards`;
    state.callout = `Time! Round ${state.round} is a Draw!`;
    state.events.unshift(state.winReason);
    return;
  }

  const winnerId: FighterId = p1.hp > p2.hp ? 'p1' : 'p2';
  const winner = state.fighters[winnerId];
  state.scores[winnerId] += 1;

  if (state.scores[winnerId] >= ROUNDS_TO_WIN || state.round >= 3) {
    state.status = 'match_over';
    state.winner =
      state.scores.p1 > state.scores.p2
        ? 'p1'
        : state.scores.p2 > state.scores.p1
          ? 'p2'
          : winnerId;
    state.winReason = `${state.fighters[state.winner as FighterId].name} wins on points`;
    state.callout = `${state.fighters[state.winner as FighterId].name} Wins on Points!`;
  } else {
    state.status = 'round_over';
    state.winner = winnerId;
    state.winReason = `${winner.name} wins Round ${state.round} on points`;
    state.callout = `Time! ${winner.name} takes Round ${state.round}!`;
  }
  state.events.unshift(state.winReason);
}
