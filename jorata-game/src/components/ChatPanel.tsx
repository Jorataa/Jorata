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
  onOpenSnapStudio: () => void;
  channelName?: string;
  isCompactMode?: boolean;
}

const QUICK_REACTIONS = ['❤️', '🔥', '👍', '🎉', '🌿', '✨'];

export function ChatPanel({
  messages,
  players,
  connected,
  send,
  localPlayer,
  onInspectPlayer,
  onOpenSnapStudio,
  channelName = 'general',
  isCompactMode = false,
}: Props) {
  const [text, setText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [reactions, setReactions] = useState<Record<string, Record<string, string[]>>>({});
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);

  const [isOpen, setIsOpen] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function handleOpenChat(e: Event) {
      setIsOpen(true);
      setTimeout(() => {
        const input = document.getElementById('chat-input') as HTMLInputElement | null;
        if (input) {
          const custom = e as CustomEvent<{ text?: string }>;
          if (custom.detail?.text) input.value = custom.detail.text;
          input.focus();
        }
      }, 50);
    }
    window.addEventListener('jorata-open-chat', handleOpenChat);
    return () => window.removeEventListener('jorata-open-chat', handleOpenChat);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setText(e.target.value);
    setIsTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1400);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || !connected) return;
    send(text.trim());
    setText('');
    setIsTyping(false);
    document.getElementById('chat-input')?.focus();
  }

  function toggleReaction(msgId: string, emoji: string) {
    sounds.playUiClick();
    const myName = localPlayer?.username || 'You';
    setReactions(prev => {
      const msgReactions = { ...(prev[msgId] || {}) };
      const currentUsers = msgReactions[emoji] || [];
      const hasReacted = currentUsers.includes(myName);

      if (hasReacted) {
        msgReactions[emoji] = currentUsers.filter(u => u !== myName);
        if (msgReactions[emoji].length === 0) delete msgReactions[emoji];
      } else {
        msgReactions[emoji] = [...currentUsers, myName];
      }

      return { ...prev, [msgId]: msgReactions };
    });
  }

  // Filter messages based on search
  const filteredMessages = messages.filter(m => {
    if (!searchTerm.trim()) return true;
    return (
      m.text.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      m.username.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
  });

  if (!isOpen) {
    return (
      <div className="messaging-view-container compact-layout collapsed">
        <button
          className="social-collapsed-toggle"
          onClick={() => setIsOpen(true)}
          aria-label="Open chat"
          title="Open World Chat (Enter)"
        >
          <span className="toggle-icon">💬</span>
          <span className="toggle-label">World Chat</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`messaging-view-container ${isCompactMode ? 'compact-layout' : ''}`} aria-label="Messaging Channel">

      {/* Channel Header */}
      <header className="channel-top-bar">
        <div className="channel-title-lockup">
          <span className="channel-hash">#</span>
          <div className="channel-headings">
            <h3>{channelName}</h3>
            <span className="channel-topic-text">
              {channelName === 'creations'
                ? 'Showcase of meadow builds, snapshots, and art'
                : 'Real-time meadow chat and collaborative discussion'}
            </span>
          </div>
        </div>

        {/* In-chat search box */}
        <div className="chat-header-actions">
          <div className="chat-search-pill">
            <span className="chat-search-icon">🔍</span>
            <input
              type="search"
              placeholder="Filter messages…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              aria-label="Filter messages"
            />
            {searchTerm && (
              <button className="search-clear-mini" onClick={() => setSearchTerm('')}>
                ✕
              </button>
            )}
          </div>

          <button
            className="header-snap-btn"
            onClick={() => {
              sounds.playUiClick();
              onOpenSnapStudio();
            }}
            title="Open Camera & Snap Studio"
            aria-label="Open Camera"
          >
            📸 <span className="btn-text-desktop">Snap</span>
          </button>

          <button
            className="icon-minimize-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Minimize social panel"
            title="Minimize panel"
          >
            ━
          </button>
        </div>
      </header>

      {/* Message Stream */}
      <div
        className="messages-stream messages"
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div className="welcome-channel-card">
          <span className="welcome-star">✳</span>
          <h4>Welcome to #{channelName}!</h4>
          <p>
            {channelName === 'creations'
              ? 'This is the start of the creations channel. Snap photos and share your builds!'
              : 'This is the start of the #general channel. Be kind and inspire each other.'}
          </p>
        </div>

        {filteredMessages.map(msg => {
          const isMe = localPlayer?.username === msg.username;
          const msgReactions = reactions[msg.id] || {};
          const isSnapMessage = msg.text.includes('📸 Shared');
          const hasImageInText = msg.text.includes('data:image/');

          return msg.system ? (
            <div className="system-msg-row system-message" key={msg.id}>
              <span>{msg.text}</span>
            </div>
          ) : (
            <div
              className={`msg-bubble-card message ${isMe ? 'msg-outgoing' : 'msg-incoming'}`}
              key={msg.id}
            >
              <div className="msg-header">
                <strong
                  className="msg-author"
                  onClick={() => {
                    const found = players.find(p => p.username === msg.username);
                    if (found) onInspectPlayer(found);
                  }}
                  title="Click to view explorer passport"
                >
                  {msg.username} {isMe && <span className="you-msg-pill">YOU</span>}
                </strong>
                <div className="msg-meta-right">
                  <time dateTime={new Date(msg.at).toISOString()}>
                    {new Date(msg.at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                  {isMe && <span className="delivered-ticks" title="Sent and delivered">✓✓</span>}
                </div>
              </div>

              {/* Message text / Snap preview */}
              <p className="msg-text">{msg.text}</p>

              {/* Reactions row */}
              <div className="msg-reactions-row">
                {Object.entries(msgReactions).map(([emoji, users]) => (
                  <button
                    key={emoji}
                    className={`reaction-count-pill ${users.includes(localPlayer?.username || '') ? 'my-reaction' : ''}`}
                    onClick={() => toggleReaction(msg.id, emoji)}
                    title={`Reacted by: ${users.join(', ')}`}
                  >
                    <span>{emoji}</span>
                    <span className="reaction-num">{users.length}</span>
                  </button>
                ))}

                {/* Quick Add Reaction Popover Button */}
                <div className="reaction-adder-container">
                  <span className="reaction-add-trigger">+</span>
                  <div className="reaction-hover-tray">
                    {QUICK_REACTIONS.map(emoji => (
                      <button
                        key={emoji}
                        className="quick-hover-emoji"
                        onClick={() => toggleReaction(msg.id, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator bubble */}
        {isTyping && (
          <div className="typing-indicator-row">
            <span className="typing-dots">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </span>
            <span className="typing-text">Someone is typing…</span>
          </div>
        )}
      </div>

      {/* Chat Form */}
      <form className="chat-input-bar-form" onSubmit={submit}>
        <div className="chat-input-pill-shell">
          <button
            type="button"
            className="attach-snap-btn"
            onClick={() => {
              sounds.playUiClick();
              onOpenSnapStudio();
            }}
            title="Attach a Snap Photo"
            aria-label="Attach Photo"
          >
            📷
          </button>

          <input
            id="chat-input"
            value={text}
            onChange={handleInputChange}
            maxLength={280}
            placeholder={`Message #${channelName}… (Enter to send)`}
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
            className="send-msg-btn"
            aria-label="Send message"
            disabled={!connected || !text.trim()}
          >
            ↑
          </button>
        </div>
      </form>
    </div>
  );
}
