import { sounds } from '../game/audio';

interface Props {
  onClose: () => void;
}

export function ControlsHelpModal({ onClose }: Props) {
  function handleClose() {
    sounds.playUiClick();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div className="help-card" onClick={e => e.stopPropagation()}>
        <header className="help-header">
          <div>
            <span className="eyebrow">FIELD GUIDE & CONTROLS</span>
            <h2 id="help-title">How to explore & build</h2>
          </div>
          <button className="icon-close-btn" onClick={handleClose} aria-label="Close guide">✕</button>
        </header>

        <div className="help-content">
          <section className="help-section">
            <h3>Movement & Physics</h3>
            <div className="shortcut-grid">
              <div className="shortcut-row">
                <span className="keys"><kbd>A</kbd><kbd>D</kbd> or <kbd>←</kbd><kbd>→</kbd></span>
                <span className="desc">Run left & right</span>
              </div>
              <div className="shortcut-row">
                <span className="keys"><kbd>W</kbd> or <kbd>Space</kbd> or <kbd>↑</kbd></span>
                <span className="desc">Jump / Hop</span>
              </div>
            </div>
          </section>

          <section className="help-section">
            <h3>Building & Tools</h3>
            <div className="shortcut-grid">
              <div className="shortcut-row">
                <span className="keys"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></span>
                <span className="desc">Select Timber, Clay, or Glass</span>
              </div>
              <div className="shortcut-row">
                <span className="keys"><kbd>Q</kbd> or <kbd>X</kbd></span>
                <span className="desc">Toggle Demolish Pickaxe</span>
              </div>
              <div className="shortcut-row">
                <span className="keys">Left Click</span>
                <span className="desc">Place chosen material</span>
              </div>
              <div className="shortcut-row">
                <span className="keys">Right Click or <kbd>Shift</kbd>+Click</span>
                <span className="desc">Demolish block</span>
              </div>
            </div>
          </section>

          <section className="help-section">
            <h3>Social & Shortcuts</h3>
            <div className="shortcut-grid">
              <div className="shortcut-row">
                <span className="keys"><kbd>Enter</kbd></span>
                <span className="desc">Open world chat</span>
              </div>
              <div className="shortcut-row">
                <span className="keys"><kbd>E</kbd></span>
                <span className="desc">Open Emote Wheel</span>
              </div>
              <div className="shortcut-row">
                <span className="keys"><kbd>C</kbd></span>
                <span className="desc">Take Jorata Snap (Photo)</span>
              </div>
              <div className="shortcut-row">
                <span className="keys"><kbd>M</kbd></span>
                <span className="desc">Mute / Unmute Sound FX</span>
              </div>
              <div className="shortcut-row">
                <span className="keys"><kbd>Esc</kbd></span>
                <span className="desc">Close any open menu / Return to world</span>
              </div>
            </div>
          </section>

          <div className="meadow-rules-callout">
            <strong>🌱 Meadow Guidelines</strong>
            <p>
              Build within 5 blocks of your explorer. The spawn arrival area is protected so new explorers can always enter freely. Be kind, build inspiring things, and enjoy your time together.
            </p>
          </div>
        </div>

        <div className="help-footer">
          <button className="action-button primary" onClick={handleClose}>
            Got it, let's play! <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
