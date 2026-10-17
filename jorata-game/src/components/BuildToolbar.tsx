import { MATERIALS } from '../../shared/game';
import { sounds } from '../game/audio';

function focusWorld() {
  document.getElementById('game-canvas')?.focus();
}

export function BuildToolbar({
  selected,
  mode,
  select,
  setMode,
}: {
  selected: number;
  mode: 'place' | 'remove';
  select: (id: number) => void;
  setMode: (mode: 'place' | 'remove') => void;
}) {
  return (
    <div className="build-toolbar" aria-label="Building tools">
      <div className="tool-caption">
        <span className="eyebrow">BUILD KIT</span>
        <span>Palette</span>
      </div>
      <div className="material-list">
        {MATERIALS.map(material => (
          <button
            key={material.id}
            className={`material ${selected === material.id && mode === 'place' ? 'selected' : ''}`}
            aria-pressed={selected === material.id && mode === 'place'}
            onClick={() => {
              sounds.playUiClick();
              select(material.id);
              focusWorld();
            }}
            title={`${material.name} · ${material.key}`}
          >
            <span
              className={`material-swatch swatch-${material.id}`}
              style={{ backgroundColor: material.color }}
            />
            <span>{material.name}</span>
            <kbd>{material.key}</kbd>
          </button>
        ))}
        <button
          className={`remove-tool ${mode === 'remove' ? 'selected' : ''}`}
          aria-pressed={mode === 'remove'}
          onClick={() => {
            sounds.playUiClick();
            setMode(mode === 'remove' ? 'place' : 'remove');
            focusWorld();
          }}
          title="Demolish blocks. Right click or Shift+click also removes."
        >
          <span>⛏</span>
          Demolish
        </button>
      </div>
      <span className="build-hint">
        Left click to place
        <br />
        Right click to remove
      </span>
    </div>
  );
}

export function TouchControls() {
  function control(key: string, down: boolean) {
    window.dispatchEvent(new CustomEvent('jorata-control', { detail: { key, down } }));
  }

  return (
    <div className="touch-controls" aria-label="Touch movement controls">
      <div className="touch-dpad">
        <button
          className="touch-btn touch-left"
          aria-label="Move left"
          onPointerDown={e => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            focusWorld();
            control('left', true);
          }}
          onPointerUp={() => control('left', false)}
          onPointerCancel={() => control('left', false)}
          onLostPointerCapture={() => control('left', false)}
        >
          ◀
        </button>
        <button
          className="touch-btn touch-right"
          aria-label="Move right"
          onPointerDown={e => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            focusWorld();
            control('right', true);
          }}
          onPointerUp={() => control('right', false)}
          onPointerCancel={() => control('right', false)}
          onLostPointerCapture={() => control('right', false)}
        >
          ▶
        </button>
      </div>

      <div className="touch-actions">
        <button
          className="touch-btn touch-jump"
          aria-label="Jump"
          onPointerDown={e => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            focusWorld();
            control('jump', true);
          }}
          onPointerUp={() => control('jump', false)}
          onPointerCancel={() => control('jump', false)}
          onLostPointerCapture={() => control('jump', false)}
        >
          ▲
        </button>
      </div>
    </div>
  );
}
