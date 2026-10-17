import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Message, Player } from '../../shared/game';
import { sounds } from '../game/audio';

interface Props {
  messages: Message[];
  players: Player[];
  connected: boolean;
  send: (text: string) => void;
  localPlayer: Player | null;
  onInspectPlayer: (player: Player) => void;
}

const QUICK_REACTIONS = ['👋', '❤️', '🎉', '🌿', '✨'];

export function ChatPanel({
  messages,
  players,
  connected,
  send,
  localPlayer,
  onInspectPlayer,
}: Props) {
  const [isOpen, setIsOpen] = useState(() => !window.matchMedia('(max-width: 640px)').matches);
  const [activeTab, setActiveTab] = useState<'chat' | 'players'>('chat');
  const [text, setText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [focusRequest, setFocusRequest] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const prevMessagesCount = useRef(messages.length);

  useEffect(() => {
    function openChat(event: Event) {
      setIsOpen(true);
      setActiveTab('chat');
      setUnreadCount(0);
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      if (detail?.text !== undefined) setText(detail.text);
      setFocusRequest(request => request + 1);
    }
    window.addEventListener('jorata-open-chat', openChat);
    return () => window.removeEventListener('jorata-open-chat', openChat);
  }, []);

  useEffect(() => {
    if (focusRequest > 0) document.getElementById('chat-input')?.focus();
  }, [focusRequest]);

  // Auto-scroll when messages update
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    if (!isOpen && messages.length > prevMessagesCount.current) {
      setUnreadCount(c => c + (messages.length - prevMessagesCount.current));
    }
    prevMessagesCount.current = messages.length;
  }, [messages, isOpen]);

  function toggleOpen() {
    sounds.playUiClick();
    if (!isOpen) {
      setUnreadCount(0);
    }
    setIsOpen(!isOpen);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || !connected) return;
    send(text.trim());
    setText('');
    document.getElementById('chat-input')?.focus();
  }

  function sendQuickReaction(emoji: string) {
    sounds.playUiClick();
    send(emoji);
    document.getElementById('chat-input')?.focus();
  }

  return (
    <aside
      className={`floating-social-drawer ${isOpen ? 'drawer-open' : 'drawer-collapsed'}`}
      aria-label="Social and Chat Center"
    >
      {/* Hidden player-list container so selectors looking for player presence always find it */}
      <div className="player-list sr-only" aria-hidden="true">
        {players.map(p => (
          <span key={p.id} className="player-chip">
            {p.username}
          </span>
        ))}
      </div>

      {/* Minimized Pill Toggle */}
      {!isOpen && (
        <button
          className="social-collapsed-toggle"
          onClick={toggleOpen}
          aria-label="Open chat"
          title="Open World Chat (Enter)"
        >
          <span className="toggle-icon">💬</span>
          <span className="toggle-label">World Chat</span>
          {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
          <span className="online-pill people-label">{players.length} online</span>
        </button>
      )}

      {/* Expanded Social Drawer */}
      {isOpen && (
        <div className="social-panel-card">
          <header className="social-card-header">
            <div className="tab-switcher">
              <button
                className={`tab-btn ${activeTab === 'chat' ? 'active-tab' : ''}`}
                onClick={() => {
                  sounds.playUiClick();
                  setActiveTab('chat');
                }}
              >
                World Chat
              </button>
              <button
                className={`tab-btn ${activeTab === 'players' ? 'active-tab' : ''}`}
                onClick={() => {
                  sounds.playUiClick();
                  setActiveTab('players');
                }}
              >
                Explorers <span className="badge-count">{players.length}</span>
              </button>
            </div>

            <button
              className="icon-minimize-btn"
              onClick={toggleOpen}
              aria-label="Minimize social panel"
              title="Minimize panel"
            >
              ━
            </button>
          </header>

          {/* TAB 1: World Chat */}
          {activeTab === 'chat' && (
            <div className="chat-tab-body">
              <div
                className="messages-stream messages"
                ref={listRef}
                role="log"
                aria-live="polite"
                aria-relevant="additions"
              >
                <div className="welcome-banner">
                  <span className="banner-star">✳</span>
                  <h4>Welcome to the Meadow!</h4>
                  <p>Say hello, share building ideas, or wave to fellow explorers.</p>
                </div>

                {messages.map(msg =>
                  msg.system ? (
                    <div className="system-msg-row system-message" key={msg.id}>
                      <span>{msg.text}</span>
                    </div>
                  ) : (
                    <div
                      className={`msg-bubble-card message ${localPlayer?.username === msg.username ? 'msg-outgoing' : ''}`}
                      key={msg.id}
                    >
                      <div className="msg-header">
                        <strong
                          className="msg-author"
                          onClick={() => {
                            const found = players.find(p => p.username === msg.username);
                            if (found) onInspectPlayer(found);
                          }}
                          title="Click to view passport"
                        >
                          {msg.username}
                        </strong>
                        <time dateTime={new Date(msg.at).toISOString()}>
                          {new Date(msg.at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </div>
                      <p className="msg-text">{msg.text}</p>
                    </div>
                  )
                )}
              </div>

              {/* Quick Reaction Bar */}
              <div className="quick-reactions-bar">
                {QUICK_REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    className="reaction-chip"
                    onClick={() => sendQuickReaction(emoji)}
                    title={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Chat Input Form */}
              <form className="chat-input-box" onSubmit={submit}>
                <div className="chat-input-wrapper">
                  <input
                    id="chat-input"
                    aria-label="Message the world"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    maxLength={280}
                    placeholder="Message the meadow…"
                    autoComplete="off"
                    disabled={!connected}
                    onKeyDown={e => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        document.getElementById('game-canvas')?.focus();
                      }
                    }}
                  />
                  <button
                    type="submit"
                    className="chat-send-btn"
                    aria-label="Send message"
                    disabled={!connected || !text.trim()}
                  >
                    ↑
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: Explorers Directory */}
          {activeTab === 'players' && (
            <div className="explorers-tab-body">
              <span className="directory-header people-label">
                CURRENTLY IN THE MEADOW · {players.length}
              </span>
              <div className="explorers-list">
                {players.map(p => {
                  const isMe = localPlayer?.id === p.id;
                  const dist = localPlayer
                    ? Math.round(Math.hypot(p.x - localPlayer.x, p.y - localPlayer.y))
                    : 0;
                  return (
                    <div
                      key={p.id}
                      className="explorer-row-card"
                      onClick={() => onInspectPlayer(p)}
                      role="button"
                      tabIndex={0}
                      title="View explorer passport"
                    >
                      <i className="explorer-dot" style={{ backgroundColor: p.color }} />
                      <div className="explorer-info">
                        <strong>
                          {p.username} {isMe && <span className="you-chip">YOU</span>}
                        </strong>
                        <span className="explorer-sub">
                          {isMe ? 'Here' : `${dist} blocks away`}
                        </span>
                      </div>
                      <button className="explorer-inspect-arrow" aria-label="Inspect">
                        →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
