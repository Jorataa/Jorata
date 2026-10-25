import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BOXING_ASSET_PATHS,
  preloadBoxingAssets,
} from './assets';
import {
  BINDING_PRESETS,
  DEFAULT_BINDINGS,
  PUNCH_CHAIN,
  PUNCH_SPECS,
  RING_HEIGHT,
  RING_WIDTH,
  assignKeyBinding,
  createMatch,
  findBindingConflicts,
  formatDifficultyLabel,
  formatKeyCode,
  nextRound,
  normalizeDifficulty,
  normalizeEventCode,
  readControlsFromKeys,
  stepMatch,
  stepVisuals,
  type AiDifficulty,
  type CanonicalDifficulty,
  type ControlAction,
  type DualKeyBindings,
  type FighterId,
  type GameMode,
  type MatchState,
  type PlayerControls,
} from './engine';
import { renderRing } from './render';
import {
  loadBindings,
  loadRecord,
  recordMatchResult,
  saveBindings,
  type BoxingRecord,
} from './storage';
import './boxing.css';

type Props = {
  onExit: () => void;
  reducedMotion?: boolean;
  paused?: boolean;
};

type RebindTarget = {
  fighter: FighterId;
  action: ControlAction;
} | null;

const ACTION_LABELS: Record<ControlAction, string> = {
  left: 'Move Left',
  right: 'Move Right',
  block: 'Block',
  punch: 'Punch (Combo)',
};

const DIFFICULTY_OPTIONS: ReadonlyArray<{ id: CanonicalDifficulty; label: string; desc: string }> = [
  { id: 'easy', label: 'Easy', desc: 'Forgiving pace · 2-hit combos' },
  { id: 'normal', label: 'Normal', desc: 'Balanced contender · 3-hit combos' },
  { id: 'hard', label: 'Hard', desc: 'Championship reflexes & counters' },
];

export default function Boxing({ onExit, reducedMotion = false, paused = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<GameMode>('local1v1');
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('normal');
  const [bindings, setBindings] = useState<DualKeyBindings>(loadBindings);
  const [record, setRecord] = useState<BoxingRecord>(loadRecord);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rebindTarget, setRebindTarget] = useState<RebindTarget>(null);
  const [bindingNotice, setBindingNotice] = useState(
    'Shared keyboard ready: both players can move, block, and chain combos at the same time.'
  );
  const [activeKeysList, setActiveKeysList] = useState<string[]>([]);
  const [assetsReady, setAssetsReady] = useState(false);
  const [, forceHudTick] = useState(0);

  const matchRef = useRef<MatchState>(createMatch('local1v1', 'normal'));
  const bindingsRef = useRef<DualKeyBindings>(bindings);
  const activeKeysRef = useRef<Set<string>>(new Set());
  const queuedPunchRef = useRef<{ p1: boolean; p2: boolean }>({ p1: false, p2: false });
  const touchControlsRef = useRef<{ p1: PlayerControls; p2: PlayerControls }>({
    p1: { left: false, right: false, block: false, punch: false },
    p2: { left: false, right: false, block: false, punch: false },
  });
  const pausedRef = useRef(paused || isPaused);
  const reducedMotionRef = useRef(reducedMotion);
  const recordedMatchRef = useRef(false);

  bindingsRef.current = bindings;
  pausedRef.current = paused || isPaused;
  reducedMotionRef.current = reducedMotion;

  useEffect(() => {
    let mounted = true;
    canvasRef.current?.focus({ preventScroll: true });
    preloadBoxingAssets(store => {
      if (mounted && store.ready) {
        setAssetsReady(true);
        forceHudTick(n => n + 1);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const clearInputs = useCallback(() => {
    activeKeysRef.current.clear();
    queuedPunchRef.current = { p1: false, p2: false };
    touchControlsRef.current = {
      p1: { left: false, right: false, block: false, punch: false },
      p2: { left: false, right: false, block: false, punch: false },
    };
    setActiveKeysList([]);
  }, []);

  const startNewMatch = useCallback(
    (nextMode: GameMode = mode, nextDiff: AiDifficulty = aiDifficulty) => {
      clearInputs();
      setIsPaused(false);
      recordedMatchRef.current = false;
      matchRef.current = createMatch(nextMode, nextDiff);
      forceHudTick(n => n + 1);
      requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
    },
    [mode, aiDifficulty, clearInputs]
  );

  const handleContinueRound = useCallback(() => {
    clearInputs();
    setIsPaused(false);
    if (matchRef.current.status === 'match_over') {
      recordedMatchRef.current = false;
    }
    matchRef.current = nextRound(matchRef.current);
    forceHudTick(n => n + 1);
    requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
  }, [clearInputs]);

  const handleModeChange = (nextMode: GameMode) => {
    setMode(nextMode);
    startNewMatch(nextMode, aiDifficulty);
  };

  const handleDifficultyChange = (nextDiff: AiDifficulty) => {
    setAiDifficulty(nextDiff);
    startNewMatch(mode, nextDiff);
  };

  const applyNewBindings = (next: DualKeyBindings, notice: string) => {
    setBindings(next);
    bindingsRef.current = next;
    const saved = saveBindings(next);
    setBindingNotice(
      saved ? notice : `${notice} (Kept in memory for this session)`
    );
  };

  // Global keyboard handler supporting simultaneous P1 + P2 input & custom rebinding
  useEffect(() => {
    const isGameKey = (code: string, b: DualKeyBindings) =>
      code === b.p1.left ||
      code === b.p1.right ||
      code === b.p1.block ||
      code === b.p1.punch ||
      code === b.p2.left ||
      code === b.p2.right ||
      code === b.p2.block ||
      code === b.p2.punch;

    const onKeyDown = (event: KeyboardEvent) => {
      if (paused || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const code = normalizeEventCode(event);
      if (!code) return;

      // Handle interactive key rebinding capture first
      if (rebindTarget) {
        event.preventDefault();
        if (code === 'Escape') {
          setRebindTarget(null);
          setBindingNotice('Rebind cancelled.');
          return;
        }
        const { bindings: updated, swappedWith } = assignKeyBinding(
          bindingsRef.current,
          rebindTarget.fighter,
          rebindTarget.action,
          code
        );
        const playerLabel = rebindTarget.fighter === 'p1' ? 'Player 1' : 'Player 2';
        const actionLabel = ACTION_LABELS[rebindTarget.action];
        const swapNote = swappedWith ? ` (swapped with ${swappedWith} to prevent key conflict)` : '';
        setRebindTarget(null);
        applyNewBindings(
          updated,
          `${playerLabel} ${actionLabel} bound to ${formatKeyCode(code)}${swapNote}.`
        );
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) {
        return;
      }

      if (code === 'Escape' && !event.repeat && matchRef.current.status === 'active') {
        event.preventDefault();
        clearInputs();
        setIsPaused(p => !p);
        return;
      }

      if (pausedRef.current) return;

      if (isGameKey(code, bindingsRef.current)) {
        event.preventDefault();
      }

      if (event.repeat) return;

      if (code === bindingsRef.current.p1.punch) {
        queuedPunchRef.current.p1 = true;
      }
      if (code === bindingsRef.current.p2.punch) {
        queuedPunchRef.current.p2 = true;
      }

      activeKeysRef.current.add(code);
      setActiveKeysList(Array.from(activeKeysRef.current));
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const code = normalizeEventCode(event);
      if (!code) return;
      if (activeKeysRef.current.has(code)) {
        activeKeysRef.current.delete(code);
        setActiveKeysList(Array.from(activeKeysRef.current));
      }
    };

    const onBlur = () => {
      clearInputs();
    };

    const onVisibility = () => {
      if (document.hidden) clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [rebindTarget, clearInputs, paused]);

  // Main 60fps canvas combat loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = RING_WIDTH;
    let height = RING_HEIGHT;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(300, rect.width || RING_WIDTH);
      height = Math.max(200, rect.height || RING_HEIGHT);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      renderRing(ctx, matchRef.current, width, height, performance.now() / 1000, reducedMotionRef.current);
      canvas.dataset.ready = 'true';
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let raf = 0;
    let lastTime = performance.now();
    let hudAccumulator = 0;

    const mergeControls = (
      kb: PlayerControls,
      touch: PlayerControls
    ): PlayerControls => ({
      left: kb.left || touch.left,
      right: kb.right || touch.right,
      block: kb.block || touch.block,
      punch: kb.punch || touch.punch,
    });

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.04);
      lastTime = now;

      if (!pausedRef.current) {
        if (matchRef.current.status === 'active') {
          const kbP1 = readControlsFromKeys(activeKeysRef.current, bindingsRef.current.p1);
          const kbP2 = readControlsFromKeys(activeKeysRef.current, bindingsRef.current.p2);
          const p1Controls = mergeControls(kbP1, touchControlsRef.current.p1);
          const p2Controls = mergeControls(kbP2, touchControlsRef.current.p2);

          if (queuedPunchRef.current.p1) {
            p1Controls.punch = true;
            matchRef.current.fighters.p1.punchHeld = false;
            queuedPunchRef.current.p1 = false;
          }
          if (queuedPunchRef.current.p2) {
            p2Controls.punch = true;
            matchRef.current.fighters.p2.punchHeld = false;
            queuedPunchRef.current.p2 = false;
          }

          const prevStatus = matchRef.current.status;
          const updated = stepMatch(
            matchRef.current,
            { p1: p1Controls, p2: p2Controls },
            dt,
            reducedMotionRef.current
          );

          if (touchControlsRef.current.p1.punch) {
            touchControlsRef.current.p1.punch = false;
          }
          if (touchControlsRef.current.p2.punch) {
            touchControlsRef.current.p2.punch = false;
          }

          if (
            prevStatus === 'active' &&
            updated.status === 'match_over' &&
            !recordedMatchRef.current
          ) {
            recordedMatchRef.current = true;
            const byKO = matchRef.current.winReason.includes('KO');
            setRecord(prev =>
              recordMatchResult(prev, matchRef.current.mode, matchRef.current.winner, byKO)
            );
          }
        } else {
          // Continue animating KO fall, knockdown dust, and hit sparks after the bell!
          stepVisuals(matchRef.current, dt);
        }
      }

      renderRing(ctx, matchRef.current, width, height, now / 1000, reducedMotionRef.current);

      hudAccumulator += dt;
      if (hudAccumulator >= 0.05) {
        hudAccumulator = 0;
        forceHudTick(n => (n + 1) % 1000000);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  const state = matchRef.current;
  const { p1, p2 } = state.fighters;
  const p1Active = readControlsFromKeys(new Set(activeKeysList), bindings.p1);
  const p2Active = readControlsFromKeys(new Set(activeKeysList), bindings.p2);
  const conflicts = findBindingConflicts(bindings);
  const currentCanonicalDiff = normalizeDifficulty(aiDifficulty);

  const formatClock = (seconds: number) => {
    const s = Math.ceil(seconds);
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${mins}:${rem.toString().padStart(2, '0')}`;
  };

  const holdTouch = (fighter: FighterId, action: ControlAction, down: boolean) => {
    if (action === 'punch') {
      if (down) {
        touchControlsRef.current[fighter].punch = true;
        matchRef.current.fighters[fighter].punchHeld = false;
      }
      return;
    }
    touchControlsRef.current[fighter][action] = down;
  };

  return (
    <section className="boxing-page" aria-label="Jorata Boxing" data-assets-ready={assetsReady}>
      <header className="b-header">
        <div className="b-title-block">
          <button type="button" className="b-back" onClick={onExit}>
            ← Jorata Games
          </button>
          <div className="b-heading-row">
            <img
              src={BOXING_ASSET_PATHS.props.championshipBelt}
              alt=""
              className="b-header-belt pixel-art"
              width={72}
              height={38}
            />
            <div>
              <h1>Ringcraft Boxing</h1>
              <p>
                JORATA pixel-art arcade boxing. Two fighters on one shared keyboard or solo vs AI —
                move, guard, and chain automatic Jab → Hook → Uppercut combos at 60 FPS.
              </p>
            </div>
          </div>
        </div>
        <div className="b-header-actions">
          <button
            type="button"
            className={`b-pause-btn ${isPaused ? 'is-open' : ''}`}
            aria-pressed={isPaused}
            onClick={() => {
              clearInputs();
              setIsPaused(p => !p);
            }}
          >
            <img src={BOXING_ASSET_PATHS.ui.pause} alt="" className="pixel-art" width={18} height={18} />
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
          <button
            type="button"
            className={`b-guide-toggle ${showHowToPlay ? 'is-open' : ''}`}
            aria-expanded={showHowToPlay}
            onClick={() => setShowHowToPlay(v => !v)}
          >
            {showHowToPlay ? 'Hide Guide' : 'How to Play'}
          </button>
          <button
            type="button"
            className={`b-config-toggle ${showKeyConfig ? 'is-open' : ''}`}
            aria-expanded={showKeyConfig}
            onClick={() => {
              setShowKeyConfig(v => !v);
              setRebindTarget(null);
            }}
          >
            {showKeyConfig ? 'Hide Key Setup' : 'Customize Keys & Ghosting'}
          </button>
          <button
            type="button"
            className="b-reset-btn"
            onClick={() => startNewMatch(mode, aiDifficulty)}
          >
            Restart Match
          </button>
        </div>
      </header>

      {showHowToPlay && (
        <section className="b-howto-panel" aria-label="How to Play Jorata Boxing">
          <div className="b-howto-grid">
            <div className="b-howto-card">
              <h3>1. Shared Keyboard Controls</h3>
              <p>
                <strong>Player 1 (Red):</strong> <kbd>{formatKeyCode(bindings.p1.left)}</kbd>/<kbd>{formatKeyCode(bindings.p1.right)}</kbd> Move,{' '}
                <kbd>{formatKeyCode(bindings.p1.block)}</kbd> Block, <kbd>{formatKeyCode(bindings.p1.punch)}</kbd> Punch.
              </p>
              <p>
                <strong>Player 2 (Blue):</strong> <kbd>{formatKeyCode(bindings.p2.left)}</kbd>/<kbd>{formatKeyCode(bindings.p2.right)}</kbd> Move,{' '}
                <kbd>{formatKeyCode(bindings.p2.block)}</kbd> Block, <kbd>{formatKeyCode(bindings.p2.punch)}</kbd> Punch.
              </p>
            </div>
            <div className="b-howto-card">
              <h3>2. Automatic 3-Hit Combo Chain</h3>
              <p>
                Tap your Punch key in rhythm to chain <strong>1. Jab → 2. Hook → 3. Uppercut</strong> automatically.
                Wait briefly to reset back to a fast Jab.
              </p>
            </div>
            <div className="b-howto-card">
              <h3>3. Guard, Stamina & Perfect Block</h3>
              <p>
                Blocking absorbs 80% of punch damage but drains Stamina. Raising guard right before impact triggers a{' '}
                <strong>Perfect Guard</strong> (zero damage + stamina boost). Zero stamina causes a Guard Break stun!
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="b-toolbar" role="region" aria-label="Game mode and match setup">
        <div className="b-mode-tabs" role="group" aria-label="Select game mode">
          <button
            type="button"
            className={mode === 'local1v1' ? 'is-active' : ''}
            aria-pressed={mode === 'local1v1'}
            onClick={() => handleModeChange('local1v1')}
          >
            <strong>Local 1v1</strong>
            <span>2 Humans · Shared Keyboard</span>
          </button>
          <button
            type="button"
            className={mode === 'ai' ? 'is-active' : ''}
            aria-pressed={mode === 'ai'}
            onClick={() => handleModeChange('ai')}
          >
            <strong>Single Player vs AI</strong>
            <span>1 Human vs Computer</span>
          </button>
        </div>

        {mode === 'ai' && (
          <div className="b-difficulty" role="group" aria-label="AI difficulty">
            <span>AI Difficulty:</span>
            {DIFFICULTY_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                className={currentCanonicalDiff === opt.id ? 'is-active' : ''}
                aria-pressed={currentCanonicalDiff === opt.id}
                title={opt.desc}
                onClick={() => handleDifficultyChange(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div className="b-record-summary" aria-label="Local device record">
          <img
            src={BOXING_ASSET_PATHS.ui.medals}
            alt=""
            className="b-record-medal pixel-art"
            width={24}
            height={18}
          />
          <span>
            Bouts <strong>{record.matchesPlayed}</strong>
          </span>
          <span>
            1v1 <strong>{record.local1v1Matches}</strong>
          </span>
          <span>
            AI Wins <strong>{record.aiWins}</strong>
          </span>
          <span>
            KOs <strong>{record.totalKOs}</strong>
          </span>
        </div>
      </div>

      {/* Live Fighter HUD */}
      <div className="b-hud" aria-label="Fighter status">
        {/* Player 1 (Red Corner) HUD */}
        <div className="b-fighter-card b-fighter-p1">
          <div className="b-fighter-top">
            <div className="b-fighter-identity">
              <img
                src={BOXING_ASSET_PATHS.ui.portraitRed}
                alt="Player 1 Red Corner fighter portrait"
                className="b-portrait pixel-art"
                width={52}
                height={55}
              />
              <div>
                <span className="b-corner-tag">Corner 1 · Red</span>
                <div className="b-name-row">
                  <h2>{p1.name}</h2>
                  {state.scores.p1 > state.scores.p2 && (
                    <img
                      src={BOXING_ASSET_PATHS.ui.crown}
                      alt="Leading in rounds"
                      className="b-leader-crown pixel-art"
                      width={20}
                      height={17}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="b-rounds-won" aria-label={`Player 1 rounds won: ${state.scores.p1}`}>
              {[0, 1].map(i => {
                const won = state.scores.p1 > i;
                return (
                  <img
                    key={i}
                    src={won ? BOXING_ASSET_PATHS.ui.roundDot : BOXING_ASSET_PATHS.ui.roundDotEmpty}
                    alt={won ? 'Round won' : 'Round empty'}
                    className={`b-round-dot-img pixel-art ${won ? 'won' : ''}`}
                    width={22}
                    height={22}
                  />
                );
              })}
            </div>
          </div>

          <div className="b-meter-row">
            <div className="b-meter-label">
              <span>Health</span>
              <strong>{Math.ceil(p1.hp)}%</strong>
            </div>
            <div
              className="b-meter-track"
              role="progressbar"
              aria-label="Player 1 Health"
              aria-valuenow={Math.ceil(p1.hp)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="b-meter-fill b-hp-p1" style={{ width: `${Math.max(0, p1.hp)}%` }} />
            </div>
          </div>

          <div className="b-meter-row">
            <div className="b-meter-label">
              <span>Stamina</span>
              <strong>{Math.round(p1.stamina)}%</strong>
            </div>
            <div
              className="b-meter-track b-meter-stamina"
              role="progressbar"
              aria-label="Player 1 Stamina"
              aria-valuenow={Math.round(p1.stamina)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="b-meter-fill b-stam-fill" style={{ width: `${Math.max(0, p1.stamina)}%` }} />
            </div>
          </div>

          <div className="b-combo-strip" aria-label="Player 1 automatic punch combo chain">
            <span className="b-combo-title">Auto-Combo ({formatKeyCode(bindings.p1.punch)}):</span>
            <div className="b-combo-steps">
              {PUNCH_CHAIN.map((type, idx) => (
                <span
                  key={type}
                  className={`b-combo-pill ${p1.comboStage === idx ? 'is-next' : ''} ${p1.attack?.type === type ? 'is-firing' : ''}`}
                >
                  {idx + 1}. {PUNCH_SPECS[type].label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Center Clock, Versus Badge & Callout */}
        <div className="b-center-hud">
          <div className="b-vs-row">
            <img
              src={BOXING_ASSET_PATHS.ui.versus}
              alt="VS"
              className="b-vs-badge pixel-art"
              width={42}
              height={30}
            />
            <span className="b-round-badge">Round {state.round} of 3</span>
          </div>
          <strong className="b-clock" aria-label="Round timer">
            {formatClock(state.roundTimer)}
          </strong>
          <p className="b-callout" role="status" aria-live="polite">
            {isPaused ? 'Match Paused' : state.callout}
          </p>
        </div>

        {/* Player 2 / AI (Blue Corner) HUD */}
        <div className="b-fighter-card b-fighter-p2">
          <div className="b-fighter-top">
            <div className="b-fighter-identity">
              <img
                src={BOXING_ASSET_PATHS.ui.portraitBlue}
                alt="Player 2 Blue Corner fighter portrait"
                className="b-portrait pixel-art"
                width={52}
                height={55}
              />
              <div>
                <span className="b-corner-tag">
                  {mode === 'local1v1' ? 'Corner 2 · Blue' : `Corner 2 · AI (${formatDifficultyLabel(aiDifficulty)})`}
                </span>
                <div className="b-name-row">
                  <h2>{p2.name}</h2>
                  {state.scores.p2 > state.scores.p1 && (
                    <img
                      src={BOXING_ASSET_PATHS.ui.crown}
                      alt="Leading in rounds"
                      className="b-leader-crown pixel-art"
                      width={20}
                      height={17}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="b-rounds-won" aria-label={`Player 2 rounds won: ${state.scores.p2}`}>
              {[0, 1].map(i => {
                const won = state.scores.p2 > i;
                return (
                  <img
                    key={i}
                    src={won ? BOXING_ASSET_PATHS.ui.roundDot : BOXING_ASSET_PATHS.ui.roundDotEmpty}
                    alt={won ? 'Round won' : 'Round empty'}
                    className={`b-round-dot-img pixel-art ${won ? 'won' : ''}`}
                    width={22}
                    height={22}
                  />
                );
              })}
            </div>
          </div>

          <div className="b-meter-row">
            <div className="b-meter-label">
              <span>Health</span>
              <strong>{Math.ceil(p2.hp)}%</strong>
            </div>
            <div
              className="b-meter-track"
              role="progressbar"
              aria-label="Player 2 Health"
              aria-valuenow={Math.ceil(p2.hp)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="b-meter-fill b-hp-p2" style={{ width: `${Math.max(0, p2.hp)}%` }} />
            </div>
          </div>

          <div className="b-meter-row">
            <div className="b-meter-label">
              <span>Stamina</span>
              <strong>{Math.round(p2.stamina)}%</strong>
            </div>
            <div
              className="b-meter-track b-meter-stamina"
              role="progressbar"
              aria-label="Player 2 Stamina"
              aria-valuenow={Math.round(p2.stamina)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="b-meter-fill b-stam-fill" style={{ width: `${Math.max(0, p2.stamina)}%` }} />
            </div>
          </div>

          <div className="b-combo-strip" aria-label="Player 2 automatic punch combo chain">
            <span className="b-combo-title">
              Auto-Combo ({mode === 'local1v1' ? formatKeyCode(bindings.p2.punch) : 'AI'}):
            </span>
            <div className="b-combo-steps">
              {PUNCH_CHAIN.map((type, idx) => (
                <span
                  key={type}
                  className={`b-combo-pill ${p2.comboStage === idx ? 'is-next' : ''} ${p2.attack?.type === type ? 'is-firing' : ''}`}
                >
                  {idx + 1}. {PUNCH_SPECS[type].label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ring Canvas Stage */}
      <div className="b-ring-stage">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          data-assets-ready={assetsReady ? 'true' : 'false'}
          aria-label="Boxing ring canvas. Player 1 uses A and D to move, W to block, F to punch. Player 2 uses Left and Right arrows to move, Up arrow to block, L to punch."
        />

        {isPaused && state.status === 'active' && (
          <div className="b-round-overlay" role="dialog" aria-label="Match Paused">
            <div className="b-round-card">
              <img
                src={BOXING_ASSET_PATHS.ui.pause}
                alt=""
                className="b-overlay-icon pixel-art"
                width={44}
                height={44}
              />
              <span className="b-overlay-kicker">Ring Bell Hold</span>
              <h2>Match Paused</h2>
              <p>Round {state.round} of 3 · {formatClock(state.roundTimer)} remaining</p>
              <div className="b-overlay-actions">
                <button
                  type="button"
                  className="ui-button ui-button-primary"
                  onClick={() => {
                    setIsPaused(false);
                    requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
                  }}
                >
                  Resume Fight →
                </button>
                <button
                  type="button"
                  className="ui-button ui-button-secondary"
                  onClick={() => startNewMatch(mode, aiDifficulty)}
                >
                  Restart Match
                </button>
              </div>
            </div>
          </div>
        )}

        {state.status !== 'active' && (
          <div className="b-round-overlay" role="region" aria-label="Round result">
            <div className="b-round-card">
              <div className="b-overlay-banners">
                <img
                  src={
                    state.winner === 'draw'
                      ? BOXING_ASSET_PATHS.ui.draw
                      : state.winReason.includes('KO')
                        ? BOXING_ASSET_PATHS.ui.ko
                        : BOXING_ASSET_PATHS.ui.win
                  }
                  alt={state.winner === 'draw' ? 'Draw' : state.winReason.includes('KO') ? 'KO' : 'Win'}
                  className="b-result-banner pixel-art"
                />
                {state.status === 'match_over' && state.winner && state.winner !== 'draw' && (
                  <img
                    src={BOXING_ASSET_PATHS.props.championshipBelt}
                    alt="JORATA Championship Belt"
                    className="b-victory-belt pixel-art"
                    width={96}
                    height={50}
                  />
                )}
              </div>
              <span className="b-overlay-kicker">
                {state.status === 'match_over' ? 'Final Bell · Match Complete' : `End of Round ${state.round}`}
              </span>
              <h2>{state.callout}</h2>
              <p>{state.winReason}</p>
              <div className="b-round-stats">
                <span>
                  P1 (Red) Landed: <strong>{p1.stats.landed}</strong> ({p1.stats.combosCompleted} full combos)
                </span>
                <span>
                  P2 (Blue) Landed: <strong>{p2.stats.landed}</strong> ({p2.stats.combosCompleted} full combos)
                </span>
              </div>
              <div className="b-overlay-actions">
                <button
                  type="button"
                  className="ui-button ui-button-primary"
                  onClick={handleContinueRound}
                >
                  {state.status === 'match_over' ? 'Play Rematch →' : `Start Round ${state.round + 1} →`}
                </button>
                {state.status === 'round_over' && (
                  <button
                    type="button"
                    className="ui-button ui-button-secondary"
                    onClick={() => startNewMatch(mode, aiDifficulty)}
                  >
                    New Match
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Shared Keyboard 4-Key Control Deck (Live Key Visualization + Touch Support) */}
      <div className="b-keyboard-deck" aria-label="Shared keyboard controls">
        <div className="b-deck-column">
          <div className="b-deck-header">
            <div className="b-deck-title">
              <img
                src={BOXING_ASSET_PATHS.props.gloveRed}
                alt=""
                className="b-deck-glove pixel-art"
                width={22}
                height={28}
              />
              <h3>Player 1 Controls (4 Keys)</h3>
            </div>
            <span>Red Corner · Simultaneous input</span>
          </div>
          <div className="b-key-grid">
            <button
              type="button"
              className={`b-key-cap ${p1Active.left ? 'is-pressed' : ''}`}
              aria-label="Player 1 Move Left"
              onPointerDown={e => {
                e.preventDefault();
                holdTouch('p1', 'left', true);
              }}
              onPointerUp={() => holdTouch('p1', 'left', false)}
              onPointerLeave={() => holdTouch('p1', 'left', false)}
              onPointerCancel={() => holdTouch('p1', 'left', false)}
            >
              <kbd>{formatKeyCode(bindings.p1.left)}</kbd>
              <span>Move Left</span>
            </button>
            <button
              type="button"
              className={`b-key-cap ${p1Active.right ? 'is-pressed' : ''}`}
              aria-label="Player 1 Move Right"
              onPointerDown={e => {
                e.preventDefault();
                holdTouch('p1', 'right', true);
              }}
              onPointerUp={() => holdTouch('p1', 'right', false)}
              onPointerLeave={() => holdTouch('p1', 'right', false)}
              onPointerCancel={() => holdTouch('p1', 'right', false)}
            >
              <kbd>{formatKeyCode(bindings.p1.right)}</kbd>
              <span>Move Right</span>
            </button>
            <button
              type="button"
              className={`b-key-cap ${p1Active.block || p1.blocking ? 'is-pressed' : ''}`}
              aria-label="Player 1 Block"
              onPointerDown={e => {
                e.preventDefault();
                holdTouch('p1', 'block', true);
              }}
              onPointerUp={() => holdTouch('p1', 'block', false)}
              onPointerLeave={() => holdTouch('p1', 'block', false)}
              onPointerCancel={() => holdTouch('p1', 'block', false)}
            >
              <kbd>{formatKeyCode(bindings.p1.block)}</kbd>
              <span>Block</span>
            </button>
            <button
              type="button"
              className={`b-key-cap b-key-punch ${p1Active.punch || p1.attack ? 'is-pressed' : ''}`}
              aria-label="Player 1 Punch"
              onClick={() => holdTouch('p1', 'punch', true)}
            >
              <kbd>{formatKeyCode(bindings.p1.punch)}</kbd>
              <span>Punch ({PUNCH_SPECS[PUNCH_CHAIN[p1.comboStage]].label})</span>
            </button>
          </div>
        </div>

        <div className="b-deck-column">
          <div className="b-deck-header">
            <div className="b-deck-title">
              <img
                src={BOXING_ASSET_PATHS.props.gloveBlue}
                alt=""
                className="b-deck-glove pixel-art"
                width={22}
                height={28}
              />
              <h3>
                {mode === 'local1v1'
                  ? 'Player 2 Controls (4 Keys)'
                  : 'Player 2 Controls (AI Active — Switch to 1v1 to Play)'}
              </h3>
            </div>
            <span>{mode === 'local1v1' ? 'Blue Corner · Shared keyboard' : `AI (${formatDifficultyLabel(aiDifficulty)})`}</span>
          </div>
          <div className="b-key-grid">
            <button
              type="button"
              className={`b-key-cap ${p2Active.left ? 'is-pressed' : ''}`}
              aria-label="Player 2 Move Left"
              disabled={mode === 'ai'}
              onPointerDown={e => {
                e.preventDefault();
                holdTouch('p2', 'left', true);
              }}
              onPointerUp={() => holdTouch('p2', 'left', false)}
              onPointerLeave={() => holdTouch('p2', 'left', false)}
              onPointerCancel={() => holdTouch('p2', 'left', false)}
            >
              <kbd>{formatKeyCode(bindings.p2.left)}</kbd>
              <span>Move Left</span>
            </button>
            <button
              type="button"
              className={`b-key-cap ${p2Active.right ? 'is-pressed' : ''}`}
              aria-label="Player 2 Move Right"
              disabled={mode === 'ai'}
              onPointerDown={e => {
                e.preventDefault();
                holdTouch('p2', 'right', true);
              }}
              onPointerUp={() => holdTouch('p2', 'right', false)}
              onPointerLeave={() => holdTouch('p2', 'right', false)}
              onPointerCancel={() => holdTouch('p2', 'right', false)}
            >
              <kbd>{formatKeyCode(bindings.p2.right)}</kbd>
              <span>Move Right</span>
            </button>
            <button
              type="button"
              className={`b-key-cap ${p2Active.block || p2.blocking ? 'is-pressed' : ''}`}
              aria-label="Player 2 Block"
              disabled={mode === 'ai'}
              onPointerDown={e => {
                e.preventDefault();
                holdTouch('p2', 'block', true);
              }}
              onPointerUp={() => holdTouch('p2', 'block', false)}
              onPointerLeave={() => holdTouch('p2', 'block', false)}
              onPointerCancel={() => holdTouch('p2', 'block', false)}
            >
              <kbd>{formatKeyCode(bindings.p2.block)}</kbd>
              <span>Block</span>
            </button>
            <button
              type="button"
              className={`b-key-cap b-key-punch ${p2Active.punch || p2.attack ? 'is-pressed' : ''}`}
              aria-label="Player 2 Punch"
              disabled={mode === 'ai'}
              onClick={() => holdTouch('p2', 'punch', true)}
            >
              <kbd>{formatKeyCode(bindings.p2.punch)}</kbd>
              <span>Punch ({PUNCH_SPECS[PUNCH_CHAIN[p2.comboStage]].label})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Customizable Key Bindings & Anti-Ghosting Panel */}
      {showKeyConfig && (
        <section className="b-config-panel" aria-label="Customize key bindings and anti-ghosting">
          <div className="b-config-top">
            <div>
              <h2>Custom Key Bindings & Laptop Anti-Ghosting</h2>
              <p>
                Some laptop keyboards cannot register certain 3+ key combinations on the same matrix row.
                Hold both players’ keys below to test simultaneous registration, choose an anti-ghosting
                layout, or click any key to rebind.
              </p>
            </div>
            <div className="b-ghost-meter" role="status">
              <span>
                Simultaneous Keys Registered: <strong>{activeKeysList.length}</strong>
              </span>
              <small>
                {activeKeysList.length > 0
                  ? `Active: ${activeKeysList.map(formatKeyCode).join(' + ')}`
                  : 'Hold multiple P1 + P2 keys together to test your keyboard'}
              </small>
            </div>
          </div>

          <div className="b-presets" role="group" aria-label="Anti-ghosting presets">
            {Object.entries(BINDING_PRESETS).map(([id, preset]) => (
              <button
                key={id}
                type="button"
                className="b-preset-btn"
                onClick={() => {
                  setRebindTarget(null);
                  applyNewBindings(structuredClone(preset.bindings), `Applied ${preset.name} bindings.`);
                }}
              >
                <strong>{preset.name}</strong>
                <span>{preset.note}</span>
              </button>
            ))}
            <button
              type="button"
              className="b-preset-btn"
              onClick={() => {
                setRebindTarget(null);
                applyNewBindings(
                  structuredClone(DEFAULT_BINDINGS),
                  'Reset controls to default (P1: A/D/W/F, P2: Arrows + L).'
                );
              }}
            >
              <strong>Reset Defaults</strong>
              <span>Restore A/D/W/F & Arrows/L</span>
            </button>
          </div>

          <div className="b-rebind-columns">
            {(['p1', 'p2'] as const).map(fighter => (
              <div key={fighter} className="b-rebind-group">
                <h3>{fighter === 'p1' ? 'Player 1 (Red) Bindings' : 'Player 2 (Blue) Bindings'}</h3>
                {(['left', 'right', 'block', 'punch'] as const).map(action => {
                  const isListening =
                    rebindTarget?.fighter === fighter && rebindTarget?.action === action;
                  const currentCode = bindings[fighter][action];
                  return (
                    <div key={action} className="b-rebind-row">
                      <span>{ACTION_LABELS[action]}</span>
                      <button
                        type="button"
                        className={`b-rebind-btn ${isListening ? 'is-listening' : ''}`}
                        aria-label={`Rebind ${fighter === 'p1' ? 'Player 1' : 'Player 2'} ${ACTION_LABELS[action]}`}
                        onClick={() =>
                          setRebindTarget(isListening ? null : { fighter, action })
                        }
                      >
                        {isListening ? 'Press any key…' : formatKeyCode(currentCode)}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <p className="b-binding-notice" role="status">
            {conflicts.length > 0 ? `Conflict: ${conflicts.join(', ')}` : bindingNotice}
          </p>
        </section>
      )}
    </section>
  );
}
