import { type Player } from '../../shared/game';
import { sounds } from '../game/audio';

interface Props {
  player: Player;
  localPlayer: Player | null;
  onClose: () => void;
  onSendChat: (text: string) => void;
  onMention: (username: string) => void;
}

export function PlayerProfileModal({ player, localPlayer, onClose, onSendChat, onMention }: Props) {
  const isMe = localPlayer?.id === player.id;
  const distance = localPlayer
    ? Math.round(Math.hypot(player.x - localPlayer.x, player.y - localPlayer.y))
    : 0;

  function wave() {
    sounds.playUiClick();
    onSendChat(`*waves at ${player.username} 👋*`);
    onClose();
  }

  function mention() {
    sounds.playUiClick();
    onMention(player.username);
    onClose();
  }

  function copyName() {
    sounds.playUiClick();
    navigator.clipboard.writeText(player.username).catch(() => {});
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="profile-title">
      <div className="profile-card" onClick={e => e.stopPropagation()}>
        <header className="profile-header">
          <span className="eyebrow">EXPLORER PASSPORT</span>
          <button className="icon-close-btn" onClick={onClose} aria-label="Close passport">✕</button>
        </header>

        <div className="profile-avatar-stage">
          <div className="avatar-preview-box">
            <div className="avatar-preview-sprite" style={{ '--player-color': player.color } as React.CSSProperties}>
              <div className="sprite-head" />
              <div className="sprite-body" />
              <div className="sprite-legs" />
            </div>
            <div className="avatar-shadow" />
          </div>

          <h2 id="profile-title" className="profile-name">
            {player.username} {isMe && <span className="you-pill">YOU</span>}
          </h2>
          <span className="profile-rank">Meadow Pioneer · Resident #001</span>
        </div>

        <div className="profile-stats-grid">
          <div className="stat-cell">
            <span className="stat-label">STATUS</span>
            <span className="stat-value active-status">
              <i className="status-dot" /> Online in Meadow
            </span>
          </div>
          <div className="stat-cell">
            <span className="stat-label">DISTANCE</span>
            <span className="stat-value">{isMe ? 'Here' : `${distance} blocks away`}</span>
          </div>
          <div className="stat-cell">
            <span className="stat-label">LOCATION</span>
            <span className="stat-value">X: {player.x.toFixed(0)}, Y: {player.y.toFixed(0)}</span>
          </div>
        </div>

        {!isMe && (
          <div className="profile-actions">
            <button className="action-button primary" onClick={wave}>
              <span>👋</span> Wave Hello
            </button>
            <button className="action-button secondary" onClick={mention}>
              <span>💬</span> Mention in Chat
            </button>
            <button className="action-button tertiary" onClick={copyName} title="Copy username">
              <span>📋</span> Copy Name
            </button>
          </div>
        )}

        {isMe && (
          <div className="profile-actions">
            <button className="action-button primary" onClick={onClose}>
              Continue Exploring <span>→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
