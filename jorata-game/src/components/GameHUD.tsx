import { useState } from 'react';
import { MATERIALS, type Player } from '../../shared/game';
import { sounds } from '../game/audio';

interface Props {
  status: string;
  revision: number;
  players: Player[];
  me: Player | undefined;
  selected: number;
  mode: 'place' | 'remove';
  select: (id: number) => void;
  setMode: (mode: 'place' | 'remove') => void;
  onRespawn: () => void;
  onOpenSnapshot: () => void;
  onOpenHelp: () => void;
  onSendChat: (text: string) => void;
  showEmotes: boolean;
  setShowEmotes: (show: boolean) => void;
}

const EMOTES = [
  { emoji: '👋', label: 'Wave', text: '*waves at everyone 👋*' },
  { emoji: '❤️', label: 'Love', text: '❤️' },
  { emoji: '🎉', label: 'Celebrate', text: '🎉 Woohoo!' },
  { emoji: '🌿', label: 'Meadow', text: '🌿 Sprout life!' },
  { emoji: '✨', label: 'Sparkle', text: '✨ Magic!' },
  { emoji: '🔥', label: 'Fire', text: '🔥 Awesome build!' },
  { emoji: '☕', label: 'Cozy', text: '☕ Cozy vibes' },
  { emoji: '⭐', label: 'Star', text: '⭐ High five!' },
];

export function GameHUD({
  status,
  revision,
  players,
  me,
  selected,
  mode,
  select,
  setMode,
  onRespawn,
  onOpenSnapshot,
  onOpenHelp,
  onSendChat,
  showEmotes,
  setShowEmotes,
}: Props) {
  const [isMuted, setIsMuted] = useState(() => sounds.isMuted());
  const [showWorldMenu, setShowWorldMenu] = useState(false);
  const [showTips, setShowTips] = useState(true);

  function toggleMute() {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  }

  function handleSelect(id: number) {
    sounds.playUiClick();
    select(id);
    document.getElementById('game-canvas')?.focus();
  }

  function handleModeToggle() {
    sounds.playUiClick();
    setMode(mode === 'remove' ? 'place' : 'remove');
    document.getElementById('game-canvas')?.focus();
  }

  function triggerEmote(emote: typeof EMOTES[0]) {
    sounds.playUiClick();
    onSendChat(emote.text);
    setShowEmotes(false);
    document.getElementById('game-canvas')?.focus();
  }

  return (
    <div className="game-hud-layer">
      {/* Hidden element for revision tracking and compatibility */}
      <span className="saved-state" data-revision={revision} style={{ display: 'none' }} />

      {/* Top Floating Island Header */}
      <header className="top-hud-island">
        <div className="hud-brand-group">
          <a href="/" className="hud-wordmark" aria-label="Jorata Home">
            <span className="brand-symbol">✳</span>
            <span className="brand-name">JORATA</span>
            <span className="hud-tag">MVP</span>
          </a>

          {/* World Badge with Dropdown */}
          <div className="world-selector-container">
            <button
              className="world-pill-button"
              onClick={() => {
                sounds.playUiClick();
                setShowWorldMenu(!showWorldMenu);
              }}
              aria-expanded={showWorldMenu}
              title="World details & room lore"
            >
              <i className="meadow-indicator" />
              <span className="world-name">The Meadow</span>
              <span className="world-caret">{showWorldMenu ? '▲' : '▼'}</span>
            </button>

            {showWorldMenu && (
              <div className="world-dropdown-card">
                <div className="dropdown-header">
                  <strong>The Meadow #001</strong>
                  <span className="public-tag">🌿 Public World</span>
                </div>
                <p className="dropdown-desc">
                  A sunlit, open sanctuary where players build, socialize, and explore together.
                </p>
                <div className="dropdown-meta">
                  <span>Explorers: <strong>{players.length}</strong></span>
                  <span>Revision: <strong>{revision}</strong></span>
                </div>
                <div className="dropdown-footer">
                  <span>Protected Spawn Zone Active</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center / Right Action Controls */}
        <div className="hud-actions-group">
          <button
            className={`hud-icon-btn ${isMuted ? 'active-mute' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute Sound Effects (M)' : 'Mute Sound Effects (M)'}
            aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          <button
            className="hud-icon-btn snap-btn"
            onClick={() => {
              sounds.playUiClick();
              onOpenSnapshot();
            }}
            title="Take a Jorata Snap photo (C)"
            aria-label="Capture photo"
          >
            📷 <span className="btn-label-desktop">Snap</span>
          </button>

          <button
            className="hud-icon-btn"
            onClick={() => {
              sounds.playUiClick();
              onOpenHelp();
            }}
            title="Field Guide & Controls (?)"
            aria-label="Help and controls"
          >
            ❓
          </button>

          <button
            className="hud-text-btn"
            onClick={() => {
              sounds.playUiClick();
              onRespawn();
              document.getElementById('game-canvas')?.focus();
            }}
            disabled={status !== 'Live'}
            aria-label="Return to spawn"
            title="Return to Spawn Point"
          >
            ↺ Return to spawn
          </button>

          {/* Player Identity Pill */}
          {me && (
            <div className="hud-identity-pill" title={`Connected as ${me.username}`}>
              <i className="identity-dot" style={{ backgroundColor: me.color }} />
              <span className="identity-name">{me.username}</span>
            </div>
          )}

          {/* Connection Dot & Label */}
          <div className="connection hud-connection-status" title={`Status: ${status}`}>
            <i className={status === 'Live' ? 'live-dot' : 'offline-dot'} />
            <span role="status" className="sr-only">
              {status === 'Live' ? 'Connected' : status}
            </span>
          </div>
        </div>
      </header>

      {/* Emote Picker Floating Menu */}
      {showEmotes && (
        <div className="emote-picker-island">
          <div className="emote-picker-header">
            <span>QUICK EMOTES</span>
            <button
              className="icon-close-btn small"
              onClick={() => setShowEmotes(false)}
              aria-label="Close emotes"
            >
              ✕
            </button>
          </div>
          <div className="emote-grid">
            {EMOTES.map(item => (
              <button
                key={item.label}
                className="emote-cell-btn"
                onClick={() => triggerEmote(item)}
                title={item.label}
              >
                <span className="emote-icon">{item.emoji}</span>
                <span className="emote-name">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Centered Tactile Hotbar */}
      <footer className="bottom-hud-dock">
        <div className="hotbar-container" role="toolbar" aria-label="Building tools">
          {MATERIALS.map(mat => {
            const isChosen = selected === mat.id && mode === 'place';
            return (
              <button
                key={mat.id}
                className={`hotbar-slot ${isChosen ? 'active-slot' : ''}`}
                onClick={() => handleSelect(mat.id)}
                aria-pressed={isChosen}
                aria-label={mat.name}
                title={`${mat.name} (Key ${mat.key})`}
              >
                <div className={`hotbar-swatch swatch-${mat.id}`} style={{ backgroundColor: mat.color }} />
                <span className="slot-name">{mat.name}</span>
                <span className="slot-key">{mat.key}</span>
              </button>
            );
          })}

          {/* Demolish Tool */}
          <button
            className={`hotbar-slot demolish-slot ${mode === 'remove' ? 'active-demolish' : ''}`}
            onClick={handleModeToggle}
            aria-pressed={mode === 'remove'}
            aria-label="Demolish"
            title="Demolish Pickaxe (Key Q or X). Right click also removes."
          >
            <div className="demolish-icon">⛏</div>
            <span className="slot-name">Demolish</span>
            <span className="slot-key">Q/X</span>
          </button>

          {/* Emotes Trigger */}
          <button
            className={`hotbar-slot emote-slot ${showEmotes ? 'active-slot' : ''}`}
            onClick={() => {
              sounds.playUiClick();
              setShowEmotes(!showEmotes);
            }}
            title="Quick Emotes (Key E)"
            aria-label="Emotes"
          >
            <div className="emote-slot-icon">😊</div>
            <span className="slot-name">Emote</span>
            <span className="slot-key">E</span>
          </button>
        </div>

        {/* Minimal Controls Tip Banner */}
        {showTips && (
          <div className="quick-controls-chip">
            <span><kbd>WASD</kbd> Move</span>
            <span><kbd>Space</kbd> Jump</span>
            <span><kbd>1-3</kbd> Materials</span>
            <span><kbd>Click</kbd> Build</span>
            <span><kbd>Enter</kbd> Chat</span>
            <button
              className="chip-dismiss-btn"
              onClick={() => setShowTips(false)}
              aria-label="Dismiss tips"
            >
              ✕
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}
