import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BOXING_ASSET_PATHS,
  preloadBoxingAssets,
} from './assets';
import {
  boxingAudio,
  loadAudioPrefs,
  type BoxingAudioPrefs,
} from './audio';
import {
  DEFAULT_BINDINGS,
  PUNCH_CHAIN,
  PUNCH_SPECS,
  RING_HEIGHT,
  RING_WIDTH,
  createMatch,
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
} from './storage';
import './boxing.css';

type Props = {
  onExit: () => void;
  reducedMotion?: boolean;
  paused?: boolean;
};

type CursorMode = 'idle' | 'hover' | 'hero';

const DIFFICULTY_OPTIONS: ReadonlyArray<{ id: CanonicalDifficulty; label: string }> = [
  { id: 'easy', label: 'Easy' },
  { id: 'normal', label: 'Normal' },
  { id: 'hard', label: 'Hard' },
];

export default function Boxing({ onExit, reducedMotion = false, paused = false }: Props) {
  const pageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  // Core menu & match state
  const [inMenu, setInMenu] = useState(true);
  const [mode, setMode] = useState<GameMode>('local1v1');
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('normal');
  const [bindings] = useState<DualKeyBindings>(() => loadBindings() ?? DEFAULT_BINDINGS);
  const [audioPrefs, setAudioPrefs] = useState<BoxingAudioPrefs>(loadAudioPrefs);
  const [showSettings, setShowSettings] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [bellBanner, setBellBanner] = useState<string | null>(null);
  const [isStartingTransition, setIsStartingTransition] = useState(false);
  const [cursorMode, setCursorMode] = useState<CursorMode>('idle');
  const [cursorPunch, setCursorPunch] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [, forceHudTick] = useState(0);

  const matchRef = useRef<MatchState>(createMatch('local1v1', 'normal'));
  const bindingsRef = useRef<DualKeyBindings>(bindings);
  const activeKeysRef = useRef<Set<string>>(new Set());
  const queuedPunchRef = useRef<{ p1: boolean; p2: boolean }>({ p1: false, p2: false });
  const touchControlsRef = useRef<{ p1: PlayerControls; p2: PlayerControls }>({
    p1: { left: false, right: false, block: false, punch: false },
    p2: { left: false, right: false, block: false, punch: false },
  });
  const inMenuRef = useRef(inMenu);
  const pausedRef = useRef(paused || isPaused || showSettings);
  const reducedMotionRef = useRef(reducedMotion);
  const recordedMatchRef = useRef(false);
  const bellTimerRef = useRef<number | null>(null);
  const prevHitsRef = useRef({ p1Landed: 0, p2Landed: 0, p1Blocked: 0, p2Blocked: 0 });

  bindingsRef.current = bindings;
  inMenuRef.current = inMenu;
  pausedRef.current = paused || isPaused || showSettings;
  reducedMotionRef.current = reducedMotion;

  useEffect(() => {
    let mounted = true;
    preloadBoxingAssets(store => {
      if (mounted && store.ready) {
        setAssetsReady(true);
        forceHudTick(n => n + 1);
      }
    });
    return () => {
      mounted = false;
      boxingAudio.stopAmbience();
      if (bellTimerRef.current !== null) {
        window.clearTimeout(bellTimerRef.current);
      }
    };
  }, []);

  const triggerBellAnnouncement = useCallback((roundNum: number) => {
    if (bellTimerRef.current !== null) {
      window.clearTimeout(bellTimerRef.current);
    }
    setBellBanner(`ROUND ${roundNum}`);
    bellTimerRef.current = window.setTimeout(() => {
      setBellBanner('FIGHT!');
      bellTimerRef.current = window.setTimeout(() => {
        setBellBanner(null);
        bellTimerRef.current = null;
      }, 520);
    }, 480);
  }, []);

  const clearInputs = useCallback(() => {
    activeKeysRef.current.clear();
    queuedPunchRef.current = { p1: false, p2: false };
    touchControlsRef.current = {
      p1: { left: false, right: false, block: false, punch: false },
      p2: { left: false, right: false, block: false, punch: false },
    };
  }, []);

  const startNewMatch = useCallback(
    (nextMode: GameMode = mode, nextDiff: AiDifficulty = aiDifficulty) => {
      clearInputs();
      setIsPaused(false);
      setShowSettings(false);
      recordedMatchRef.current = false;
      matchRef.current = createMatch(nextMode, nextDiff);
      prevHitsRef.current = { p1Landed: 0, p2Landed: 0, p1Blocked: 0, p2Blocked: 0 };
      boxingAudio.playBell(1);
      boxingAudio.startAmbience();
      triggerBellAnnouncement(1);
      forceHudTick(n => n + 1);
      requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
    },
    [mode, aiDifficulty, clearInputs, triggerBellAnnouncement]
  );

  const handleStartPlay = useCallback(() => {
    boxingAudio.playMenuClick(true);
    setCursorVisible(false);
    if (reducedMotionRef.current) {
      setInMenu(false);
      startNewMatch(mode, aiDifficulty);
      return;
    }
    setIsStartingTransition(true);
    window.setTimeout(() => {
      setInMenu(false);
      setIsStartingTransition(false);
      startNewMatch(mode, aiDifficulty);
    }, 180);
  }, [mode, aiDifficulty, startNewMatch]);

  const handleReturnToMenu = useCallback(() => {
    boxingAudio.playMenuClick(false);
    boxingAudio.stopAmbience();
    clearInputs();
    setIsPaused(false);
    setShowSettings(false);
    setBellBanner(null);
    matchRef.current = createMatch(mode, aiDifficulty);
    setInMenu(true);
    forceHudTick(n => n + 1);
  }, [mode, aiDifficulty, clearInputs]);

  const handleContinueRound = useCallback(() => {
    boxingAudio.playMenuClick(true);
    setCursorVisible(false);
    clearInputs();
    setIsPaused(false);
    if (matchRef.current.status === 'match_over') {
      recordedMatchRef.current = false;
    }
    matchRef.current = nextRound(matchRef.current);
    prevHitsRef.current = {
      p1Landed: matchRef.current.fighters.p1.stats.landed,
      p2Landed: matchRef.current.fighters.p2.stats.landed,
      p1Blocked: matchRef.current.fighters.p1.stats.blocked,
      p2Blocked: matchRef.current.fighters.p2.stats.blocked,
    };
    boxingAudio.playBell(1);
    boxingAudio.startAmbience();
    triggerBellAnnouncement(matchRef.current.round);
    forceHudTick(n => n + 1);
    requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
  }, [clearInputs, triggerBellAnnouncement]);

  const handleModeSelect = (nextMode: GameMode) => {
    boxingAudio.playMenuClick(false);
    setMode(nextMode);
    matchRef.current = createMatch(nextMode, aiDifficulty);
    forceHudTick(n => n + 1);
  };

  const handleDifficultySelect = (nextDiff: CanonicalDifficulty) => {
    boxingAudio.playMenuClick(false);
    setAiDifficulty(nextDiff);
    if (!inMenu) {
      matchRef.current.aiDifficulty = nextDiff;
    } else {
      matchRef.current = createMatch(mode, nextDiff);
    }
    forceHudTick(n => n + 1);
  };

  const toggleAudioPref = (key: keyof BoxingAudioPrefs) => {
    const next: BoxingAudioPrefs = { ...audioPrefs, [key]: !audioPrefs[key] };
    setAudioPrefs(next);
    boxingAudio.setPrefs(next);
    if (key === 'sfx' && next.sfx) {
      boxingAudio.playMenuClick(false);
    }
    if (key === 'music') {
      if (next.music && !inMenu && !isPaused) {
        boxingAudio.startAmbience();
      } else if (!next.music) {
        boxingAudio.stopAmbience();
      }
    }
  };

  // Custom pixel-art boxing glove cursor tracking & micro-interactions
  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)');
    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const onPointerMove = (e: PointerEvent) => {
      if (!finePointer.matches || reduceMotionQuery.matches || reducedMotion) {
        setCursorVisible(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      const interactive = target?.closest<HTMLElement>('button, a, [role="button"]');
      const isHero = Boolean(interactive?.classList.contains('b-start-btn'));

      // During active keyboard combat, only show the cursor if hovering over the top HUD controls
      const inActiveCombat =
        !inMenuRef.current &&
        !pausedRef.current &&
        matchRef.current.status === 'active';

      if (inActiveCombat && !interactive) {
        setCursorVisible(false);
        return;
      }

      setCursorVisible(true);
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }

      const nextMode: CursorMode = isHero ? 'hero' : interactive ? 'hover' : 'idle';
      setCursorMode(prev => {
        if (prev !== nextMode && nextMode !== 'idle') {
          boxingAudio.playMenuHover();
        }
        return nextMode;
      });
    };

    const onPointerDown = () => {
      setCursorPunch(true);
      window.setTimeout(() => setCursorPunch(false), 110);
    };

    const onPointerLeave = () => {
      setCursorVisible(false);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [reducedMotion]);

  // Global keyboard handler supporting simultaneous P1 + P2 input
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

      if (code === 'Escape' && !event.repeat) {
        if (showSettings) {
          event.preventDefault();
          boxingAudio.playMenuClick(false);
          setShowSettings(false);
          if (!inMenuRef.current && !isPaused) {
            requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
          }
          return;
        }
        if (!inMenuRef.current && matchRef.current.status === 'active') {
          event.preventDefault();
          boxingAudio.playMenuClick(false);
          clearInputs();
          setIsPaused(p => !p);
          return;
        }
      }

      if (inMenuRef.current || pausedRef.current) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) {
        return;
      }

      if (isGameKey(code, bindingsRef.current)) {
        event.preventDefault();
        // Auto-hide cursor during active keyboard combat
        setCursorVisible(false);
      }

      if (event.repeat) return;

      if (code === bindingsRef.current.p1.punch) {
        queuedPunchRef.current.p1 = true;
      }
      if (code === bindingsRef.current.p2.punch) {
        queuedPunchRef.current.p2 = true;
      }

      activeKeysRef.current.add(code);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const code = normalizeEventCode(event);
      if (!code) return;
      activeKeysRef.current.delete(code);
    };

    const onBlur = () => clearInputs();
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
  }, [clearInputs, paused, showSettings, isPaused]);

  // Main 60fps canvas loop (runs both behind the Main Menu and during active combat)
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
      renderRing(
        ctx,
        matchRef.current,
        width,
        height,
        performance.now() / 1000,
        reducedMotionRef.current,
        inMenuRef.current
      );
      canvas.dataset.ready = 'true';
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let raf = 0;
    let lastTime = performance.now();
    let hudAccumulator = 0;

    const mergeControls = (kb: PlayerControls, touch: PlayerControls): PlayerControls => ({
      left: kb.left || touch.left,
      right: kb.right || touch.right,
      block: kb.block || touch.block,
      punch: kb.punch || touch.punch,
    });

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.04);
      lastTime = now;

      if (!inMenuRef.current && !pausedRef.current) {
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
          const prevP1Attack = matchRef.current.fighters.p1.attack?.type ?? null;
          const prevP2Attack = matchRef.current.fighters.p2.attack?.type ?? null;

          const updated = stepMatch(
            matchRef.current,
            { p1: p1Controls, p2: p2Controls },
            dt,
            reducedMotionRef.current
          );

          // Trigger punch swing & impact sound effects on state transitions
          const curP1Attack = updated.fighters.p1.attack?.type ?? null;
          const curP2Attack = updated.fighters.p2.attack?.type ?? null;
          if (curP1Attack && curP1Attack !== prevP1Attack) {
            boxingAudio.playPunchSwing(curP1Attack);
          }
          if (curP2Attack && curP2Attack !== prevP2Attack) {
            boxingAudio.playPunchSwing(curP2Attack);
          }

          if (updated.fighters.p1.stats.landed > prevHitsRef.current.p1Landed) {
            prevHitsRef.current.p1Landed = updated.fighters.p1.stats.landed;
            boxingAudio.playHit(curP1Attack ?? 'jab', false);
          } else if (updated.fighters.p2.stats.blocked > prevHitsRef.current.p2Blocked) {
            prevHitsRef.current.p2Blocked = updated.fighters.p2.stats.blocked;
            boxingAudio.playHit(curP1Attack ?? 'jab', true);
          }

          if (updated.fighters.p2.stats.landed > prevHitsRef.current.p2Landed) {
            prevHitsRef.current.p2Landed = updated.fighters.p2.stats.landed;
            boxingAudio.playHit(curP2Attack ?? 'jab', false);
          } else if (updated.fighters.p1.stats.blocked > prevHitsRef.current.p1Blocked) {
            prevHitsRef.current.p1Blocked = updated.fighters.p1.stats.blocked;
            boxingAudio.playHit(curP2Attack ?? 'jab', true);
          }

          if (touchControlsRef.current.p1.punch) {
            touchControlsRef.current.p1.punch = false;
          }
          if (touchControlsRef.current.p2.punch) {
            touchControlsRef.current.p2.punch = false;
          }

          if (prevStatus === 'active' && updated.status !== 'active') {
            boxingAudio.stopAmbience();
            boxingAudio.playBell(updated.status === 'match_over' ? 3 : 2);
            if (updated.status === 'match_over' && !recordedMatchRef.current) {
              recordedMatchRef.current = true;
              const byKO = updated.winReason.includes('KO');
              recordMatchResult(loadRecord(), updated.mode, updated.winner, byKO);
            }
          }
        } else {
          stepVisuals(matchRef.current, dt);
        }
      }

      renderRing(
        ctx,
        matchRef.current,
        width,
        height,
        now / 1000,
        reducedMotionRef.current,
        inMenuRef.current
      );

      if (!inMenuRef.current) {
        hudAccumulator += dt;
        if (hudAccumulator >= 0.05) {
          hudAccumulator = 0;
          forceHudTick(n => (n + 1) % 1000000);
        }
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
    <section
      ref={pageRef}
      className={`boxing-page ${inMenu ? 'is-menu' : 'is-playing'} ${isStartingTransition ? 'is-transitioning' : ''}`}
      aria-label="Boxing Jorata"
      data-assets-ready={assetsReady}
    >
      {/* Full-viewport living pixel-art boxing arena */}
      <div className="b-arena-viewport">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          data-assets-ready={assetsReady ? 'true' : 'false'}
          aria-label="Boxing ring canvas. Player 1 uses A and D to move, W to block, F to punch. Player 2 uses Left and Right arrows to move, Up arrow to block, L to punch."
        />

        {/* Unobtrusive exit link in top-left corner when in menu */}
        {inMenu && (
          <button
            type="button"
            className="b-corner-exit"
            onClick={onExit}
            aria-label="Back to Jorata Games"
          >
            ← Jorata
          </button>
        )}

        {/* ============================================================
            IN-GAME MAIN MENU OVERLAY
            Hierarchy:
            BOXING JORATA
            [ START PLAY ]
            [ 1 PLAYER ] [ 2 PLAYERS ]
            [ SETTINGS ]
           ============================================================ */}
        {inMenu && (
          <div className="b-menu-overlay" role="region" aria-label="Main Menu">
            <div className="b-menu-core">
              <div className="b-menu-emblem" aria-hidden="true">
                <img
                  src={BOXING_ASSET_PATHS.props.gloveRed}
                  alt=""
                  className="b-emblem-glove b-emblem-glove-left pixel-art"
                  width={26}
                  height={32}
                />
                <span className="b-emblem-tag">CHAMPIONSHIP ARCADE</span>
                <img
                  src={BOXING_ASSET_PATHS.props.gloveBlue}
                  alt=""
                  className="b-emblem-glove b-emblem-glove-right pixel-art"
                  width={26}
                  height={32}
                />
              </div>

              <h1 className="b-menu-title">BOXING JORATA</h1>

              <button
                type="button"
                className="b-start-btn"
                onClick={handleStartPlay}
              >
                <span>START PLAY</span>
              </button>

              <div className="b-mode-segment" role="group" aria-label="Player mode">
                <button
                  type="button"
                  className={`b-segment-btn ${mode === 'ai' ? 'is-active' : ''}`}
                  aria-pressed={mode === 'ai'}
                  onClick={() => handleModeSelect('ai')}
                >
                  1 PLAYER
                </button>
                <button
                  type="button"
                  className={`b-segment-btn ${mode === 'local1v1' ? 'is-active' : ''}`}
                  aria-pressed={mode === 'local1v1'}
                  onClick={() => handleModeSelect('local1v1')}
                >
                  2 PLAYERS
                </button>
              </div>

              <button
                type="button"
                className="b-settings-trigger"
                aria-expanded={showSettings}
                onClick={() => {
                  boxingAudio.playMenuClick(false);
                  setShowSettings(true);
                }}
              >
                SETTINGS
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            MINIMAL IN-GAME HUD (Visible only during match)
            Only essential info: Health, Stamina, Round timer,
            Round indicator, and Compact pause access.
           ============================================================ */}
        {!inMenu && (
          <header className="b-hud" aria-label="Match HUD">
            {/* Player 1 (Red) */}
            <div className="b-hud-wing b-fighter-p1">
              <div className="b-hud-meta">
                <span className="b-hud-name">P1 · RED</span>
                <div className="b-hud-rounds" aria-label={`Player 1 rounds won: ${state.scores.p1}`}>
                  {[0, 1].map(i => (
                    <span
                      key={i}
                      className={`b-round-pip ${state.scores.p1 > i ? 'is-won' : ''}`}
                    />
                  ))}
                </div>
                <strong className="b-hud-hp-num">{Math.ceil(p1.hp)}%</strong>
              </div>

              <div
                className="b-bar-track b-bar-hp"
                role="progressbar"
                aria-label="Player 1 Health"
                aria-valuenow={Math.ceil(p1.hp)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="b-bar-fill b-fill-p1"
                  style={{ width: `${Math.max(0, p1.hp)}%` }}
                />
              </div>

              <div
                className="b-bar-track b-bar-stamina"
                role="progressbar"
                aria-label="Player 1 Stamina"
                aria-valuenow={Math.round(p1.stamina)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="b-bar-fill b-fill-stamina"
                  style={{ width: `${Math.max(0, p1.stamina)}%` }}
                />
              </div>

              <div className="b-hud-combo" aria-label="Player 1 combo chain">
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

            {/* Center Round & Timer */}
            <div className="b-hud-center">
              <span className="b-hud-round">ROUND {state.round}/3</span>
              <strong className="b-hud-clock" aria-label="Round timer">
                {formatClock(state.roundTimer)}
              </strong>
            </div>

            {/* Player 2 (Blue / AI) + Compact Pause Access */}
            <div className="b-hud-right-group">
              <div className="b-hud-wing b-fighter-p2">
                <div className="b-hud-meta b-hud-meta-right">
                  <strong className="b-hud-hp-num">{Math.ceil(p2.hp)}%</strong>
                  <div className="b-hud-rounds" aria-label={`Player 2 rounds won: ${state.scores.p2}`}>
                    {[0, 1].map(i => (
                      <span
                        key={i}
                        className={`b-round-pip ${state.scores.p2 > i ? 'is-won' : ''}`}
                      />
                    ))}
                  </div>
                  <span className="b-hud-name">
                    {mode === 'local1v1' ? 'P2 · BLUE' : `AI · ${formatDifficultyLabel(aiDifficulty).toUpperCase()}`}
                  </span>
                </div>

                <div
                  className="b-bar-track b-bar-hp b-bar-reverse"
                  role="progressbar"
                  aria-label="Player 2 Health"
                  aria-valuenow={Math.ceil(p2.hp)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="b-bar-fill b-fill-p2"
                    style={{ width: `${Math.max(0, p2.hp)}%` }}
                  />
                </div>

                <div
                  className="b-bar-track b-bar-stamina b-bar-reverse"
                  role="progressbar"
                  aria-label="Player 2 Stamina"
                  aria-valuenow={Math.round(p2.stamina)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="b-bar-fill b-fill-stamina"
                    style={{ width: `${Math.max(0, p2.stamina)}%` }}
                  />
                </div>

                <div className="b-hud-combo b-hud-combo-right" aria-label="Player 2 combo chain">
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

              <button
                type="button"
                className={`b-hud-pause ${isPaused ? 'is-open' : ''}`}
                aria-label="Pause"
                aria-pressed={isPaused}
                title="Pause (Esc)"
                onClick={() => {
                  boxingAudio.playMenuClick(false);
                  clearInputs();
                  setIsPaused(p => !p);
                }}
              >
                <span className="b-pause-bars" aria-hidden="true" />
              </button>
            </div>
          </header>
        )}

        {/* Short Boxing Bell / Countdown Callout on Round Start */}
        {!inMenu && bellBanner && state.status === 'active' && !isPaused && (
          <div className="b-bell-callout" aria-live="polite">
            <span>{bellBanner}</span>
          </div>
        )}

        {/* Mobile / Touch-Only Controls (Hidden on desktop pointer:fine) */}
        {!inMenu && state.status === 'active' && !isPaused && (
          <div className="b-touch-controls" aria-label="Touch controls">
            <div className="b-touch-cluster">
              <button
                type="button"
                aria-label="Move Left"
                onPointerDown={e => {
                  e.preventDefault();
                  holdTouch('p1', 'left', true);
                }}
                onPointerUp={() => holdTouch('p1', 'left', false)}
                onPointerCancel={() => holdTouch('p1', 'left', false)}
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Move Right"
                onPointerDown={e => {
                  e.preventDefault();
                  holdTouch('p1', 'right', true);
                }}
                onPointerUp={() => holdTouch('p1', 'right', false)}
                onPointerCancel={() => holdTouch('p1', 'right', false)}
              >
                →
              </button>
            </div>
            <div className="b-touch-cluster">
              <button
                type="button"
                aria-label="Block"
                onPointerDown={e => {
                  e.preventDefault();
                  holdTouch('p1', 'block', true);
                }}
                onPointerUp={() => holdTouch('p1', 'block', false)}
                onPointerCancel={() => holdTouch('p1', 'block', false)}
              >
                GUARD
              </button>
              <button
                type="button"
                className="b-touch-punch"
                aria-label="Punch"
                onPointerDown={e => {
                  e.preventDefault();
                  holdTouch('p1', 'punch', true);
                }}
              >
                PUNCH
              </button>
            </div>
          </div>
        )}

        {/* Compact Pause Overlay */}
        {!inMenu && isPaused && state.status === 'active' && !showSettings && (
          <div className="b-modal-backdrop" role="dialog" aria-modal="true" aria-label="Match Paused">
            <div className="b-modal-card b-pause-card">
              <span className="b-modal-kicker">ROUND {state.round} · {formatClock(state.roundTimer)}</span>
              <h2>PAUSED</h2>
              <div className="b-pause-actions">
                <button
                  type="button"
                  className="b-arcade-btn b-arcade-btn-primary"
                  onClick={() => {
                    boxingAudio.playMenuClick(true);
                    setCursorVisible(false);
                    setIsPaused(false);
                    requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
                  }}
                >
                  RESUME FIGHT
                </button>
                <button
                  type="button"
                  className="b-arcade-btn"
                  onClick={() => {
                    boxingAudio.playMenuClick(false);
                    setShowSettings(true);
                  }}
                >
                  SETTINGS
                </button>
                <button
                  type="button"
                  className="b-arcade-btn"
                  onClick={() => startNewMatch(mode, aiDifficulty)}
                >
                  RESTART
                </button>
                <button
                  type="button"
                  className="b-arcade-btn b-arcade-btn-subtle"
                  onClick={handleReturnToMenu}
                >
                  MAIN MENU
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Victory / Knockout / Round End Presentation */}
        {!inMenu && state.status !== 'active' && !showSettings && (
          <div className="b-modal-backdrop" role="dialog" aria-modal="true" aria-label="Round result">
            <div className="b-modal-card b-result-card">
              <div className="b-result-art">
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
                    alt="Championship Belt"
                    className="b-victory-belt pixel-art"
                    width={92}
                    height={48}
                  />
                )}
              </div>
              <span className="b-modal-kicker">
                {state.status === 'match_over' ? 'FINAL BELL' : `END OF ROUND ${state.round}`}
              </span>
              <h2>{state.callout}</h2>
              <p className="b-result-reason">{state.winReason}</p>
              <div className="b-pause-actions">
                <button
                  type="button"
                  className="b-arcade-btn b-arcade-btn-primary"
                  onClick={handleContinueRound}
                >
                  {state.status === 'match_over' ? 'REMATCH' : `ROUND ${state.round + 1}`}
                </button>
                <button
                  type="button"
                  className="b-arcade-btn"
                  onClick={handleReturnToMenu}
                >
                  MAIN MENU
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            MINIMAL SETTINGS OVERLAY
            Only includes:
            1. Sound/music controls
            2. AI difficulty when 1 Player is selected
            3. Control reference
           ============================================================ */}
        {showSettings && (
          <div
            className="b-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            onClick={e => {
              if (e.target === e.currentTarget) {
                boxingAudio.playMenuClick(false);
                setShowSettings(false);
              }
            }}
          >
            <div className="b-modal-card b-settings-card">
              <div className="b-settings-header">
                <h2>SETTINGS</h2>
                <button
                  type="button"
                  className="b-settings-close"
                  aria-label="Close settings"
                  onClick={() => {
                    boxingAudio.playMenuClick(false);
                    setShowSettings(false);
                    if (!inMenu && !isPaused) {
                      requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
                    }
                  }}
                >
                  ✕
                </button>
              </div>

              {/* 1. Sound / Music Controls */}
              <div className="b-settings-section">
                <span className="b-settings-label">AUDIO</span>
                <div className="b-audio-row">
                  <button
                    type="button"
                    className={`b-toggle-pill ${audioPrefs.sfx ? 'is-on' : ''}`}
                    aria-pressed={audioPrefs.sfx}
                    onClick={() => toggleAudioPref('sfx')}
                  >
                    <span>Sound Effects</span>
                    <strong>{audioPrefs.sfx ? 'ON' : 'OFF'}</strong>
                  </button>
                  <button
                    type="button"
                    className={`b-toggle-pill ${audioPrefs.music ? 'is-on' : ''}`}
                    aria-pressed={audioPrefs.music}
                    onClick={() => toggleAudioPref('music')}
                  >
                    <span>Arena Music</span>
                    <strong>{audioPrefs.music ? 'ON' : 'OFF'}</strong>
                  </button>
                </div>
              </div>

              {/* 2. AI Difficulty (Shown when 1 Player is selected) */}
              {mode === 'ai' && (
                <div className="b-settings-section">
                  <span className="b-settings-label">AI DIFFICULTY</span>
                  <div className="b-difficulty-segment" role="group" aria-label="AI difficulty">
                    {DIFFICULTY_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`b-diff-btn ${currentCanonicalDiff === opt.id ? 'is-active' : ''}`}
                        aria-pressed={currentCanonicalDiff === opt.id}
                        onClick={() => handleDifficultySelect(opt.id)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Control Reference */}
              <div className="b-settings-section">
                <span className="b-settings-label">CONTROLS (SHARED KEYBOARD)</span>
                <div className="b-controls-ref">
                  <div className="b-control-col b-control-p1">
                    <h3>PLAYER 1 · RED</h3>
                    <div className="b-control-line">
                      <span>Move</span>
                      <div>
                        <kbd>{formatKeyCode(bindings.p1.left)}</kbd>
                        <kbd>{formatKeyCode(bindings.p1.right)}</kbd>
                      </div>
                    </div>
                    <div className="b-control-line">
                      <span>Block</span>
                      <kbd>{formatKeyCode(bindings.p1.block)}</kbd>
                    </div>
                    <div className="b-control-line">
                      <span>Punch</span>
                      <kbd>{formatKeyCode(bindings.p1.punch)}</kbd>
                    </div>
                  </div>

                  <div className="b-control-col b-control-p2">
                    <h3>PLAYER 2 · BLUE</h3>
                    <div className="b-control-line">
                      <span>Move</span>
                      <div>
                        <kbd>{formatKeyCode(bindings.p2.left)}</kbd>
                        <kbd>{formatKeyCode(bindings.p2.right)}</kbd>
                      </div>
                    </div>
                    <div className="b-control-line">
                      <span>Block</span>
                      <kbd>{formatKeyCode(bindings.p2.block)}</kbd>
                    </div>
                    <div className="b-control-line">
                      <span>Punch</span>
                      <kbd>{formatKeyCode(bindings.p2.punch)}</kbd>
                    </div>
                  </div>
                </div>
                <p className="b-controls-hint">
                  Tap Punch in rhythm to chain <strong>Jab → Hook → Uppercut</strong>.
                </p>
              </div>

              <button
                type="button"
                className="b-arcade-btn b-arcade-btn-primary b-settings-done"
                onClick={() => {
                  boxingAudio.playMenuClick(false);
                  setShowSettings(false);
                  if (!inMenu && !isPaused) {
                    requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
                  }
                }}
              >
                DONE
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom Pixel-Art Boxing Glove Cursor */}
      <div
        ref={cursorRef}
        className={`b-glove-cursor is-${cursorMode} ${cursorPunch ? 'is-punching' : ''} ${cursorVisible ? 'is-visible' : ''}`}
        aria-hidden="true"
      >
        <span className="b-cursor-tip" />
        <img
          src={BOXING_ASSET_PATHS.props.gloveRed}
          alt=""
          className="b-cursor-sprite pixel-art"
          width={24}
          height={30}
        />
      </div>
    </section>
  );
}
