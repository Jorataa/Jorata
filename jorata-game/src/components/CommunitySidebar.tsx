import { useState } from 'react';
import type { Player } from '../../shared/game';
import { sounds } from '../game/audio';

interface Props {
  activeChannel: string;
  setActiveChannel: (channel: string) => void;
  players: Player[];
  me: Player | undefined;
  onInspectPlayer: (player: Player) => void;
  onOpenTasks: () => void;
  onOpenWorld: () => void;
  unreadCount?: number;
  openTasksCount?: number;
}

export function CommunitySidebar({
  activeChannel,
  setActiveChannel,
  players,
  me,
  onInspectPlayer,
  onOpenTasks,
  onOpenWorld,
  unreadCount = 0,
  openTasksCount = 0,
}: Props) {
  const [search, setSearch] = useState('');

  const filteredPlayers = players.filter(p =>
    p.username.toLowerCase().includes(search.toLowerCase().trim())
  );

  function selectChannel(ch: string) {
    sounds.playUiClick();
    setActiveChannel(ch);
    if (ch === 'tasks') onOpenTasks();
    if (ch === 'world') onOpenWorld();
  }

  return (
    <aside className="community-sidebar-panel" aria-label="Community Channels & Explorers">
      {/* Community Header Banner */}
      <header className="community-brand-header">
        <div className="community-title-row">
          <span className="community-badge-icon">🌿</span>
          <div className="community-title-text">
            <h2>The Meadow</h2>
            <span className="community-sub">Public Community #001</span>
          </div>
        </div>
        <span className="live-status-chip">
          <i className="live-dot" /> {players.length} online
        </span>
      </header>

      {/* Explorer / Channel Search */}
      <div className="community-search-box">
        <div className="search-input-shell">
          <span className="search-icon">🔍</span>
          <input
            type="search"
            placeholder="Search channels or explorers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search"
          />
          {search && (
            <button className="search-clear-btn" onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="community-scroll-container">
        {/* TEXT CHANNELS */}
        <section className="channel-category-section">
          <span className="category-header">CHANNELS</span>
          <div className="channel-list">
            <button
              className={`channel-item-btn ${activeChannel === 'general' ? 'active-channel' : ''}`}
              onClick={() => selectChannel('general')}
            >
              <span className="channel-prefix">#</span>
              <span className="channel-name">general</span>
              {unreadCount > 0 && <span className="channel-unread-pill">{unreadCount}</span>}
            </button>

            <button
              className={`channel-item-btn ${activeChannel === 'creations' ? 'active-channel' : ''}`}
              onClick={() => selectChannel('creations')}
            >
              <span className="channel-prefix">#</span>
              <span className="channel-name">creations-and-snaps</span>
            </button>

            <button
              className={`channel-item-btn ${activeChannel === 'announcements' ? 'active-channel' : ''}`}
              onClick={() => selectChannel('announcements')}
            >
              <span className="channel-prefix">📢</span>
              <span className="channel-name">announcements</span>
            </button>
          </div>
        </section>

        {/* COLLABORATIVE TASKS */}
        <section className="channel-category-section">
          <span className="category-header">COLLABORATION</span>
          <div className="channel-list">
            <button
              className={`channel-item-btn ${activeChannel === 'tasks' ? 'active-channel' : ''}`}
              onClick={() => selectChannel('tasks')}
            >
              <span className="channel-prefix">📋</span>
              <span className="channel-name">meadow-goals</span>
              {openTasksCount > 0 && (
                <span className="channel-unread-pill tasks-pill">{openTasksCount}</span>
              )}
            </button>
          </div>
        </section>

        {/* 2D SOCIAL SPACES */}
        <section className="channel-category-section">
          <span className="category-header">VIRTUAL SPACES</span>
          <div className="channel-list">
            <button
              className={`channel-item-btn ${activeChannel === 'world' ? 'active-channel' : ''}`}
              onClick={() => selectChannel('world')}
            >
              <span className="channel-prefix">🎮</span>
              <span className="channel-name">live-meadow-sandbox</span>
              <span className="space-live-tag">LIVE</span>
            </button>
          </div>
        </section>

        {/* DIRECT MESSAGES / CONNECTED EXPLORERS */}
        <section className="channel-category-section explorers-section">
          <div className="explorers-header-row">
            <span className="category-header people-label">EXPLORERS · {players.length}</span>
          </div>

          <div className="explorers-directory-list player-list">
            {filteredPlayers.map(p => {
              const isMe = me?.id === p.id;
              const dist = me
                ? Math.round(Math.hypot(p.x - me.x, p.y - me.y))
                : 0;
              return (
                <div
                  key={p.id}
                  className="explorer-roster-item"
                  onClick={() => {
                    sounds.playUiClick();
                    onInspectPlayer(p);
                  }}
                  role="button"
                  tabIndex={0}
                  title={`View ${p.username}'s Passport`}
                >
                  <div className="roster-avatar-wrap">
                    <i className="roster-color-dot" style={{ backgroundColor: p.color }} />
                    <span className="roster-online-status" />
                  </div>
                  <div className="roster-meta">
                    <strong className="roster-name">
                      {p.username} {isMe && <span className="you-roster-tag">YOU</span>}
                    </strong>
                    <span className="roster-sub">
                      {isMe ? 'Spawn Meadow' : `${dist} blocks away`}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredPlayers.length === 0 && (
              <span className="no-explorers-text">No explorers found matching search.</span>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
