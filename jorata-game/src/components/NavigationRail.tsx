import { useState } from 'react';
import { sounds } from '../game/audio';
import type { Player } from '../../shared/game';

interface Props {
  activeView: 'split' | 'world' | 'chat' | 'tasks' | 'camera';
  setActiveView: (view: 'split' | 'world' | 'chat' | 'tasks' | 'camera') => void;
  unreadChatCount: number;
  openTasksCount: number;
  me: Player | undefined;
  onOpenProfile: () => void;
  onOpenHelp: () => void;
}

export function NavigationRail({
  activeView,
  setActiveView,
  unreadChatCount,
  openTasksCount,
  me,
  onOpenProfile,
  onOpenHelp,
}: Props) {
  const [isMuted, setIsMuted] = useState(() => sounds.isMuted());

  function toggleMute() {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  }

  function handleNav(view: 'split' | 'world' | 'chat' | 'tasks' | 'camera') {
    sounds.playUiClick();
    setActiveView(view);
  }

  return (
    <aside className="nav-rail-dock" aria-label="Main Navigation">
      {/* Top Wordmark / Logo */}
      <div className="rail-top">
        <button
          className="rail-brand-icon"
          onClick={() => handleNav('split')}
          title="JORATA Home (Split View)"
          aria-label="JORATA Home"
        >
          <span className="brand-star">✳</span>
        </button>

        <div className="rail-separator" />

        {/* Communities */}
        <div className="rail-communities-group">
          <button
            className={`rail-community-btn active-community`}
            title="Community: The Meadow"
            aria-label="The Meadow Community"
          >
            <span>🌿</span>
            <div className="active-pill-indicator" />
          </button>
          <button
            className="rail-community-btn"
            onClick={() => sounds.playUiClick()}
            title="Community: Builders Lounge (Coming soon)"
            aria-label="Builders Lounge"
          >
            <span>☕</span>
          </button>
          <button
            className="rail-community-btn"
            onClick={() => sounds.playUiClick()}
            title="Community: Creative Studio (Coming soon)"
            aria-label="Creative Studio"
          >
            <span>✨</span>
          </button>
        </div>

        <div className="rail-separator" />

        {/* Navigation Sections */}
        <nav className="rail-sections-nav" aria-label="Workspaces">
          <button
            className={`rail-nav-btn ${activeView === 'split' ? 'active-rail' : ''}`}
            onClick={() => handleNav('split')}
            title="Split Mode: Chat & World side by side"
            aria-label="Split View"
          >
            <span className="rail-icon">◫</span>
            <span className="rail-label">Split</span>
          </button>

          <button
            className={`rail-nav-btn ${activeView === 'chat' ? 'active-rail' : ''}`}
            onClick={() => handleNav('chat')}
            title="Full Messaging & Channels View"
            aria-label="Messages"
          >
            <span className="rail-icon">💬</span>
            <span className="rail-label">Chat</span>
            {unreadChatCount > 0 && <span className="rail-badge">{unreadChatCount}</span>}
          </button>

          <button
            className={`rail-nav-btn ${activeView === 'world' ? 'active-rail' : ''}`}
            onClick={() => handleNav('world')}
            title="Full World Sandbox View"
            aria-label="Meadow World"
          >
            <span className="rail-icon">🎮</span>
            <span className="rail-label">World</span>
          </button>

          <button
            className={`rail-nav-btn ${activeView === 'tasks' ? 'active-rail' : ''}`}
            onClick={() => handleNav('tasks')}
            title="Collaborative Meadow Goals & Tasks"
            aria-label="Collaborative Tasks"
          >
            <span className="rail-icon">📋</span>
            <span className="rail-label">Tasks</span>
            {openTasksCount > 0 && <span className="rail-badge tasks-badge">{openTasksCount}</span>}
          </button>

          <button
            className={`rail-nav-btn ${activeView === 'camera' ? 'active-rail' : ''}`}
            onClick={() => handleNav('camera')}
            title="Jorata Snaps Camera Studio"
            aria-label="Camera Studio"
          >
            <span className="rail-icon">📸</span>
            <span className="rail-label">Camera</span>
          </button>
        </nav>
      </div>

      {/* Bottom Utility Controls */}
      <div className="rail-bottom">
        <button
          className={`rail-util-btn ${isMuted ? 'muted-active' : ''}`}
          onClick={toggleMute}
          title={isMuted ? 'Unmute audio (M)' : 'Mute audio (M)'}
          aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>

        <button
          className="rail-util-btn"
          onClick={() => {
            sounds.playUiClick();
            onOpenHelp();
          }}
          title="Field Guide & Shortcuts (?)"
          aria-label="Help"
        >
          ❓
        </button>

        {me && (
          <button
            className="rail-avatar-btn"
            onClick={() => {
              sounds.playUiClick();
              onOpenProfile();
            }}
            title={`Your Explorer Passport: ${me.username}`}
            aria-label="Open your profile"
          >
            <i className="rail-avatar-dot" style={{ backgroundColor: me.color }} />
          </button>
        )}
      </div>
    </aside>
  );
}
