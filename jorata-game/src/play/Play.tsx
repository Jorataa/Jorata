import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorld, interact, materials, validWorld, TILE, type Material, type World } from './model';
import { WorldEngine, type Controls } from './engine';
import { loadWorld, saveWorld } from './storage';
import './play.css';
type Props = { onQuickNote: () => void; reducedMotion?: boolean; paused?: boolean };
const emptyControls = (): Controls => ({ left: false, right: false, jump: false });
export default function Play({ onQuickNote, reducedMotion = false, paused = false }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const importInput = useRef<HTMLInputElement>(null);
  const engine = useRef<WorldEngine | null>(null);
  const controls = useRef<Controls>(emptyControls());
  const hover = useRef<{ x: number; y: number } | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [failure, setFailure] = useState('');
  const [mode, setMode] = useState<'break' | 'place'>('break');
  const [selected, setSelected] = useState<Material>('earth');
  const [message, setMessage] = useState('A little wilderness. A world of possibility.');
  const [saveStatus, setSaveStatus] = useState('Loading your world…');
  const [, refresh] = useState(0);
  const [help, setHelp] = useState(false);
  const persist = useCallback(async () => {
    if (!engine.current) return;
    setSaveStatus('Saving…');
    try { await saveWorld(engine.current.world); setSaveStatus('Saved on this device'); }
    catch { setSaveStatus('Save failed — keep this page open and try again'); }
  }, []);
  useEffect(() => {
    let alive = true;
    loadWorld().then(saved => { if (alive) { const w = saved ?? createWorld(); setWorld(w); engine.current = new WorldEngine(w, reducedMotion); setSaveStatus(saved ? 'World restored · this device' : 'New world · saved on this device'); } }).catch(() => { if (alive) setFailure('Your saved world could not be opened. Reload to retry; your recovery copy is preserved.'); });
    return () => { alive = false; if (engine.current) void saveWorld(engine.current.world).catch(() => {}); controls.current = emptyControls(); };
  }, []);
  useEffect(() => { pausedRef.current = paused; if (paused) controls.current = emptyControls(); }, [paused]);
  useEffect(() => { if (engine.current) engine.current.reducedMotion = reducedMotion; }, [reducedMotion]);
  useEffect(() => {
    if (!world || !canvas.current || !engine.current) return;
    const c = canvas.current, e = engine.current, ctx = c.getContext('2d'); if (!ctx) return;
    const resize = () => { const box = c.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); e.width = box.width; e.height = box.height; c.width = box.width * dpr; c.height = box.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); e.centerCamera(); e.render(ctx, hover.current); c.dataset.ready = 'true'; };
    const observer = new ResizeObserver(resize); observer.observe(c); resize();
    let frame = 0, previous = performance.now();
    const loop = (now: number) => { if (!pausedRef.current) e.step(Math.min((now - previous) / 1000, .033), controls.current); previous = now; e.render(ctx, hover.current); frame = requestAnimationFrame(loop); }; frame = requestAnimationFrame(loop);
    const saving = window.setInterval(() => { void persist(); }, 5000);
    const key = (event: KeyboardEvent, down: boolean) => {
      if (!down) { const release = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump' }[event.code] as keyof Controls | undefined; if (release) controls.current[release] = false; return; }
      if (pausedRef.current || event.metaKey || event.ctrlKey || event.altKey) { controls.current = emptyControls(); return; }
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      if (down && target.closest('button') && ['Space', 'Enter'].includes(event.code)) return;
      const mapped = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump' }[event.code] as keyof Controls | undefined;
      if (mapped) { event.preventDefault(); controls.current[mapped] = down; }
      if (down && event.code === 'KeyB') setMode(value => value === 'break' ? 'place' : 'break');
      if (down && event.code === 'KeyN' && !event.repeat && !event.metaKey && !event.ctrlKey) { controls.current = emptyControls(); onQuickNote(); }
    };
    const down = (ev: KeyboardEvent) => key(ev, true), up = (ev: KeyboardEvent) => key(ev, false), blur = () => { controls.current = emptyControls(); };
    const visibility = () => { if (document.hidden) { blur(); void persist(); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => { cancelAnimationFrame(frame); clearInterval(saving); observer.disconnect(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); };
  }, [world, onQuickNote, persist]);
  const locate = (event: React.PointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(), e = engine.current!; return { x: Math.floor((event.clientX - rect.left + e.cameraX) / TILE), y: Math.floor((event.clientY - rect.top + e.cameraY) / TILE) }; };
  const act = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!engine.current || pausedRef.current || event.button !== 0) return;
    const tile = locate(event); hover.current = tile;
    const result = interact(engine.current.world, tile.x, tile.y, mode, selected);
    if (result.startsWith('Collected') || result.startsWith('Placed')) { engine.current.burst(tile.x, tile.y, '#c6c89e'); setSaveStatus('Unsaved changes'); refresh(v => v + 1); void persist(); }
    setMessage(result);
  };
  const exportWorld = () => {
    if (!engine.current) return;
    const snapshot = { ...engine.current.world, savedAt: Date.now() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `jorata-mosslight-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('World backup exported. Keep it somewhere safe.');
  };
  const importWorld = async (file: File | undefined) => {
    if (!file) return;
    controls.current = emptyControls();
    try {
      if (file.size > 2_000_000) throw new Error('This backup is too large. Choose a JORATA world JSON file.');
      const snapshot: unknown = JSON.parse(await file.text());
      if (!validWorld(snapshot)) throw new Error('This is not a valid JORATA world backup. Your current world is unchanged.');
      if (!window.confirm('Replace your current world with this backup? Export your current world first if you want to keep both.')) return;
      await saveWorld(snapshot);
      engine.current = new WorldEngine(snapshot, reducedMotion); setWorld(snapshot); setSaveStatus('Imported · saved on this device'); setMessage('Welcome back to your world.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Import failed. Your current world is unchanged.'); }
    finally { if (importInput.current) importInput.current.value = ''; }
  };
  const touchButton = (direction: keyof Controls, label: string, symbol: string) => <button type="button" aria-label={label} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); if (!pausedRef.current) controls.current[direction] = true; }} onPointerUp={() => { controls.current[direction] = false; }} onPointerCancel={() => { controls.current[direction] = false; }} onLostPointerCapture={() => { controls.current[direction] = false; }}>{symbol}</button>;
  return <section className="play-experience" aria-label="Jorata Play">
    <header className="play-heading"><div><span className="play-eyebrow">Jorata Play · Personal world</span><h1>The quiet wild.</h1><p>Make a place that feels like you.</p></div><div className="play-heading-actions"><button onClick={() => { controls.current = emptyControls(); onQuickNote(); }} className="play-secondary">Quick note <kbd>N</kbd></button><button onClick={() => setHelp(!help)} aria-expanded={help} className="play-secondary">How to play</button></div></header>
    {help && <div className="play-help"><p><strong>Explore.</strong> Move with A / D or arrow keys. Jump with W, ↑ or Space. On touch screens, use the movement controls.</p><p><strong>Create.</strong> Click or tap blocks within four tiles to collect. Choose Build, select a material, and tap an empty space to place. Press B to switch tools. Save keeps your world on this browser; no account needed.</p><p><strong>Capture.</strong> Press N for a quick note. Your world is saved automatically every five seconds and when you leave.</p></div>}
    <div className="play-world-wrap">
      {failure ? <div className="play-loading" role="alert">{failure}</div> : !world ? <div className="play-loading">Opening Mosslight…</div> : <>
        <canvas ref={canvas} aria-label="Playable sandbox world. Use arrow keys to explore, Space to jump, and click nearby blocks to collect or build." tabIndex={0} onPointerDown={act} onPointerMove={e => { hover.current = locate(e); }} onPointerLeave={() => { hover.current = null; }} />
        <div className="play-world-label"><span className="play-live-dot" /> Mosslight <span>Personal world</span></div>
        <div className="play-objective"><span>Your first chapter</span><strong>{world.collected < 5 ? 'Gather a little of the world.' : world.built < 5 ? 'Leave something of your own.' : 'A world, shaped by you.'}</strong><div className="play-progress"><i style={{ width: `${Math.min(100, (Math.min(world.collected, 5) + Math.min(world.built, 5)) * 10)}%` }} /></div><small>{Math.min(world.collected, 5)}/5 collected · {Math.min(world.built, 5)}/5 placed</small></div>
        <div className="play-touch-controls"><div>{touchButton('left', 'Move left', '←')}{touchButton('right', 'Move right', '→')}</div>{touchButton('jump', 'Jump', '↑')}</div>
      </>}
    </div>
    <div className="play-toolbelt"><div className="play-tools" role="group" aria-label="World tool"><button className={mode === 'break' ? 'is-active' : ''} onClick={() => setMode('break')} aria-pressed={mode === 'break'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="m5 20 11-12M10 4c4-2 8 1 10 5l-3 2C15 7 12 6 8 7z" /></svg>Collect</button><button className={mode === 'place' ? 'is-active' : ''} onClick={() => setMode('place')} aria-pressed={mode === 'place'}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="m12 3 8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10" /></svg>Build</button></div><div className="play-inventory" role="group" aria-label="Inventory">{materials.map(material => <button key={material} aria-label={`${material}: ${world?.inventory[material] ?? 0}`} aria-pressed={selected === material} className={selected === material ? 'is-selected' : ''} onClick={() => { setSelected(material); setMode('place'); }}><span className={`play-material ${material}`} /><span>{material}<strong>{world?.inventory[material] ?? 0}</strong></span></button>)}</div><button className="play-save" onClick={() => void persist()} disabled={!world}>Save world <span>↗</span></button></div>
    <footer className="play-footer"><span role="status" aria-live="polite">{message}</span><span className="play-save-status" role="status">{saveStatus}</span></footer>
    <div className="play-backups"><button onClick={exportWorld} disabled={!world}>Export world</button><button onClick={() => importInput.current?.click()}>Import world</button><input ref={importInput} type="file" accept="application/json,.json" aria-label="Import world backup" hidden onChange={event => void importWorld(event.target.files?.[0])} /><span>Private to this browser. Back up to keep a copy.</span></div>
    <div className="play-keyboard-hint"><span><kbd>A</kbd><kbd>D</kbd> move</span><span><kbd>Space</kbd> jump</span><span><kbd>B</kbd> switch tool</span><span>Click a nearby tile to create.</span></div>
  </section>;
}
