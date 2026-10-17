import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
const ProfileEditor = lazy(() => import('./AuthPanel').then(m => ({ default: m.ProfileEditor })));
import { check, db } from './client';
import { PrivateImage } from './PrivateImage';
import { PhotoEditor } from './PhotoEditor';
import { TaskBoard } from './TaskBoard';
import { uploadImage } from './media';
import type { useSocial } from './useSocial';
import type { ChatMessage, Profile, Room } from './types';
import {
  ChatIcon,
  UsersIcon,
  TasksIcon,
  CameraIcon,
  WorldIcon,
  SearchIcon,
  SendIcon,
  ChevronLeftIcon,
  PlusIcon,
  AttachmentIcon,
  BookmarkIcon,
  MoreIcon,
  EmojiIcon,
} from './Icons';
import './social.css';

const SocialWorld = lazy(() => import('./SocialWorld'));
type Platform = ReturnType<typeof useSocial>;

function avatar(profile: Profile, size = 32) {
  return profile.avatar_path ? (
    <PrivateImage bucket="jr-avatars" path={profile.avatar_path} alt={`${profile.display_name}'s profile photo`} />
  ) : (
    <span
      className="social-avatar"
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.42)) }}
      aria-hidden="true"
    >
      {profile.display_name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function roomName(room: Room, social: Platform, uid: string) {
  if (room.kind !== 'direct') return `${room.kind === 'channel' ? '# ' : ''}${room.name}`;
  const other = social.members.find(m => m.room_id === room.id && m.user_id !== uid);
  return social.profiles.find(p => p.id === other?.user_id)?.display_name || 'Direct conversation';
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return (
    <div className="social-modal" role="dialog" aria-modal="true" aria-label={title}>
      <section className="social-dialog">
        <div className="social-row">
          <h2>{title}</h2>
          <button onClick={close} aria-label="Close dialog">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

export type GuestWorkspaceOptions = {
  controls: ReactNode;
  edit: () => void;
  upload: (photo: Blob) => Promise<string>;
  world: ReactNode;
  notice: string;
};

export function Workspace({
  profile,
  refreshProfile,
  platform: social,
  guest,
}: {
  profile: Profile;
  refreshProfile: () => Promise<void>;
  platform: Platform;
  guest?: GuestWorkspaceOptions;
}) {
  const [dialog, setDialog] = useState<'new' | 'communities' | 'profile' | 'photo' | 'ai' | null>(null);
  const [world, setWorld] = useState(location.pathname === '/world');
  const [panel, setPanel] = useState<'tasks' | 'members' | null>(null);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiText, setAiText] = useState('');
  const [search, setSearch] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);

  // Drag & drop image upload state
  const [dragActive, setDragActive] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  // Floating Context Menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: ChatMessage } | null>(null);

  // Swipe-to-reply gesture state
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  const swipeStartRef = useRef<{ id: string; x: number } | null>(null);

  const messageList = useRef<HTMLDivElement>(null);
  const keepBottom = useRef(true);
  const room = social.rooms.find(r => r.id === social.selected);
  const membership =
    room?.kind === 'channel'
      ? social.communityMembers.filter(m => m.community_id === room.community_id)
      : social.members.filter(m => m.room_id === room?.id);
  const memberProfiles = membership
    .map(m => social.profiles.find(p => p.id === m.user_id))
    .filter((p): p is Profile => !!p);
  const role = membership.find(m => m.user_id === profile.id)?.role;
  const admin = role === 'owner' || role === 'admin';
  const other = room?.kind === 'direct' ? memberProfiles.find(p => p.id !== profile.id) : null;

  useEffect(() => {
    setDraft('');
    setReply(null);
    setEditing(null);
    setContextMenu(null);
    setShowEmoji(false);
    keepBottom.current = true;
  }, [social.selected]);

  useEffect(() => {
    if (keepBottom.current && messageList.current) {
      messageList.current.scrollTop = messageList.current.scrollHeight;
    }
  }, [social.messages]);

  useEffect(() => {
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDialog(null);
        setContextMenu(null);
      }
    }
    function onPointerDown(e: MouseEvent) {
      if ((e.target as HTMLElement).closest('.social-context-menu')) return;
      setContextMenu(null);
    }
    window.addEventListener('keydown', escape);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', escape);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  useEffect(() => {
    const open = () => setWorld(false);
    window.addEventListener('jorata-open-chat', open);
    return () => window.removeEventListener('jorata-open-chat', open);
  }, []);

  async function run(operation: () => Promise<unknown>) {
    social.setError('');
    try {
      return await operation();
    } catch (e) {
      social.setError((e as Error).message);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      await social.mutate('send_message', { body: draft, reply_to: reply?.id });
      setDraft('');
      setReply(null);
      keepBottom.current = true;
    } catch (e) {
      social.setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendPhoto(photo: Blob) {
    if (!room) throw new Error('Open a conversation first.');
    const path = guest
      ? await guest.upload(photo)
      : await uploadImage(photo, 'jr-media', `${room.id}/${profile.id}`);
    try {
      await social.mutate('send_message', { body: '', attachment_path: path, reply_to: reply?.id });
      setReply(null);
      keepBottom.current = true;
    } catch (e) {
      if (!guest) await db().storage.from('jr-media').remove([path]);
      throw e;
    }
  }

  function selectRoom(id: string) {
    social.setSelected(id);
    setPanel(null);
    setWorld(false);
    history.replaceState({}, '', '/');
  }

  async function summarize() {
    setBusy(true);
    setAiText('');
    try {
      const session = check(await db().auth.getSession()).session;
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ room_id: room?.id, consent: true }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Summary unavailable.');
      setAiText(data.text);
    } catch (e) {
      setAiText((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Drag and drop handlers
  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(c => c + 1);
    if (e.dataTransfer.types.includes('Files')) {
      setDragActive(true);
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(c => {
      const next = c - 1;
      if (next <= 0) {
        setDragActive(false);
        return 0;
      }
      return next;
    });
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setDragCounter(0);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        try {
          await sendPhoto(file);
        } catch (err) {
          social.setError((err as Error).message);
        }
      }
    }
  }

  // Swipe gesture handlers
  function handlePointerDown(messageId: string, e: React.PointerEvent) {
    if (e.button !== 0) return;
    swipeStartRef.current = { id: messageId, x: e.clientX };
  }

  function handlePointerMove(messageId: string, e: React.PointerEvent) {
    if (!swipeStartRef.current || swipeStartRef.current.id !== messageId) return;
    const diff = e.clientX - swipeStartRef.current.x;
    const damped = Math.sign(diff) * Math.min(60, Math.abs(diff) * 0.4);
    setSwipeOffset(prev => ({ ...prev, [messageId]: damped }));
  }

  function handlePointerUp(message: ChatMessage) {
    if (!swipeStartRef.current || swipeStartRef.current.id !== message.id) return;
    const offset = swipeOffset[message.id] || 0;
    if (Math.abs(offset) > 35) {
      setReply(message);
      document.getElementById('social-composer')?.focus();
    }
    swipeStartRef.current = null;
    setSwipeOffset(prev => ({ ...prev, [message.id]: 0 }));
  }

  // Context Menu handler
  function handleContextMenu(message: ChatMessage, e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({
      x: Math.min(window.innerWidth - 210, Math.max(10, e.clientX)),
      y: Math.min(window.innerHeight - 260, Math.max(10, e.clientY)),
      message,
    });
  }

  return (
    <div className={`social-app ${room ? 'has-room' : ''} ${panel ? 'has-panel' : ''}`}>
      {/* Top utility & identity status bar */}
      <header className="social-topbar">
        <a href="/" className="social-brand">
          ✳ JORATA
        </a>
        <span className="social-topline">A little closer, together.</span>
        <span role="status" className="social-status">
          {social.status === 'Live' ? '● Connected' : social.status}
        </span>
        <button
          onClick={() => (guest ? guest.edit() : setDialog('profile'))}
          className="social-profile-button"
        >
          {avatar(profile)}
          <span>{profile.display_name}</span>
        </button>
        {guest ? (
          guest.controls
        ) : (
          <button onClick={() => void run(async () => { check(await db().auth.signOut()); })}>
            Sign out
          </button>
        )}
      </header>

      {guest && (
        <div className="guest-notice" role="note">
          {guest.notice}
        </div>
      )}

      {/* 3-Region Workspace: Rail -> Conversation List -> Active Chat */}
      <div className="social-workspace-body">
        {/* A. LEFT: Understated Navigation Rail */}
        <nav className="social-nav-rail" aria-label="Main Navigation">
          <div className="social-nav-top">
            <button
              className={`social-nav-item ${!world && !panel ? 'active' : ''}`}
              onClick={() => {
                setWorld(false);
                setPanel(null);
              }}
              title="Chats"
              aria-label="Chats"
            >
              <ChatIcon size={20} />
              <span className="social-nav-label">Chats</span>
            </button>
            <button
              className="social-nav-item"
              onClick={() => setDialog('communities')}
              title="Communities"
              aria-label="Communities"
            >
              <UsersIcon size={20} />
              <span className="social-nav-label">Groups</span>
            </button>
            <button
              className="social-nav-item"
              onClick={() => setDialog('photo')}
              title="Saved"
              aria-label="Saved"
            >
              <BookmarkIcon size={20} />
              <span className="social-nav-label">Saved</span>
            </button>
            <button
              className={`social-nav-item ${panel === 'tasks' ? 'active' : ''}`}
              onClick={() => {
                if (room) setPanel(p => (p === 'tasks' ? null : 'tasks'));
              }}
              title="Shared tasks"
              aria-label="Shared tasks"
              disabled={!room}
            >
              <TasksIcon size={20} />
              <span className="social-nav-label">Tasks</span>
            </button>
            <button
              className={`social-nav-item ${world ? 'active' : ''}`}
              onClick={() => {
                setWorld(true);
                history.replaceState({}, '', '/world');
              }}
              title="More"
              aria-label="More"
            >
              <MoreIcon size={20} />
              <span className="social-nav-label">More</span>
            </button>
          </div>
          <div className="social-nav-bottom">
            <button
              className="social-nav-item social-nav-profile"
              onClick={() => (guest ? guest.edit() : setDialog('profile'))}
              title={profile.display_name}
              aria-label="Profile settings"
            >
              {avatar(profile, 30)}
            </button>
          </div>
        </nav>

        {/* B. CENTER: Telegram-Grade Conversation List */}
        <aside className="social-sidebar" aria-label="Conversations">
          <div className="social-sidebar-header">
            <div className="social-row">
              <h1>Messages</h1>
              <button className="social-new-chat-btn" onClick={() => setDialog('new')}>
                <PlusIcon size={14} />
                <span>New chat</span>
              </button>
            </div>

            <div className="social-search-bar">
              <SearchIcon size={14} className="social-search-icon" />
              <input
                className="guest-conversation-search"
                aria-label="Search conversations"
                placeholder="Search conversations"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="social-search-clear"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <button className="social-community-button" onClick={() => setDialog('communities')}>
              Discover communities →
            </button>
          </div>

          <nav className="social-room-list">
            {social.rooms
              .filter(r => roomName(r, social, profile.id).toLowerCase().includes(search.toLowerCase()))
              .map(r => {
                const isDirect = r.kind === 'direct';
                const otherMember = isDirect
                  ? social.members.find(m => m.room_id === r.id && m.user_id !== profile.id)
                  : null;
                const otherProfile = otherMember
                  ? social.profiles.find(p => p.id === otherMember.user_id)
                  : null;
                const isOnline = isDirect && otherProfile && social.online.includes(otherProfile.id);

                return (
                  <button
                    key={r.id}
                    className={`social-room ${social.selected === r.id && !world ? 'selected' : ''}`}
                    data-room-id={r.id}
                    onClick={() => selectRoom(r.id)}
                  >
                    <div className="social-room-avatar-wrap">
                      {isDirect && otherProfile ? (
                        avatar(otherProfile, 38)
                      ) : (
                        <span className="social-room-icon">
                          {r.kind === 'group' ? <UsersIcon size={16} /> : '#'}
                        </span>
                      )}
                      {isOnline && <span className="social-online-dot" title="Online now" />}
                    </div>
                    <div className="social-room-info">
                      <div className="social-room-row">
                        <strong>{roomName(r, social, profile.id)}</strong>
                        {r.updated_at && (
                          <time className="social-room-time">
                            {new Date(r.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </time>
                        )}
                      </div>
                      <small>
                        {r.kind === 'channel'
                          ? social.communities.find(c => c.id === r.community_id)?.name
                          : r.kind === 'group'
                          ? 'Group conversation'
                          : guest
                          ? 'Direct · test data'
                          : 'Private conversation'}
                      </small>
                    </div>
                  </button>
                );
              })}
            {social.rooms.length === 0 && (
              <div className="social-empty-list">
                <p className="social-muted">
                  No active conversations. Start a chat or join a community.
                </p>
              </div>
            )}
          </nav>

          <button
            className="social-world-link"
            onClick={() => {
              setWorld(true);
              history.replaceState({}, '', '/world');
            }}
          >
            <span>✳ Visit the Meadow</span>
            <small>Optional social world</small>
          </button>
        </aside>

        {/* C. RIGHT: Active Conversation or Secondary Meadow World */}
        {world ? (
          <main className="social-world-stage">
            <button
              className="social-world-back"
              onClick={() => {
                setWorld(false);
                history.replaceState({}, '', '/');
              }}
            >
              ← Back to messages
            </button>
            <Suspense fallback={<p>Opening the Meadow…</p>}>
              {guest ? guest.world : <SocialWorld profile={profile} />}
            </Suspense>
          </main>
        ) : (
          <main
            className="social-main"
            aria-label="Conversation"
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {dragActive && (
              <div className="social-drop-overlay" role="presentation">
                <div className="social-drop-box">
                  <div className="social-drop-icon">📸</div>
                  <div className="social-drop-title">Drop image to send</div>
                  <p className="social-drop-desc">Photo will be shared directly to this chat</p>
                </div>
              </div>
            )}

            {room ? (
              <>
                <header className="social-conversation-heading">
                  <button className="social-mobile-back" onClick={() => social.setSelected(null)}>
                    <ChevronLeftIcon size={16} />
                    <span>← Conversations</span>
                  </button>
                  <div className="social-heading-lockup">
                    {room.kind === 'direct' && other ? (
                      <div className="social-heading-avatar">
                        {avatar(other, 36)}
                        {social.online.includes(other.id) && <span className="social-online-dot" title="Online now" />}
                      </div>
                    ) : (
                      <div className="social-heading-icon">
                        {room.kind === 'group' ? <UsersIcon size={18} /> : '#'}
                      </div>
                    )}
                    <div className="social-heading-info">
                      <h2>{roomName(room, social, profile.id)}</h2>
                      <p className="social-muted">
                        {room.kind === 'direct'
                          ? social.online.includes(other?.id || '')
                            ? 'Online now'
                            : guest
                            ? 'Direct · test data'
                            : 'Private messages'
                          : `${membership.length} members`}
                      </p>
                    </div>
                  </div>
                  <div className="social-actions">
                    <button
                      aria-pressed={panel === 'tasks'}
                      onClick={() => setPanel(panel === 'tasks' ? null : 'tasks')}
                      className={`social-action-btn ${panel === 'tasks' ? 'active' : ''}`}
                    >
                      <TasksIcon size={14} />
                      <span>Tasks</span>
                    </button>
                    <button
                      aria-pressed={panel === 'members'}
                      onClick={() => setPanel(panel === 'members' ? null : 'members')}
                      className={`social-action-btn ${panel === 'members' ? 'active' : ''}`}
                    >
                      <UsersIcon size={14} />
                      <span>Members</span>
                    </button>
                    {!guest && (
                      <button
                        onClick={() => {
                          setAiText('');
                          setDialog('ai');
                        }}
                        className="social-action-btn"
                      >
                        <span>Summarize</span>
                      </button>
                    )}
                  </div>
                </header>

                <div
                  className="social-messages"
                  ref={messageList}
                  role="log"
                  aria-label="Conversation messages"
                  onScroll={() => {
                    const el = messageList.current!;
                    keepBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
                  }}
                >
                  {social.loading && <p role="status">Loading messages…</p>}
                  {!guest && social.messages.length >= 100 && (
                    <button
                      onClick={() =>
                        void run(async () => {
                          keepBottom.current = false;
                          await social.loadOlder();
                        })
                      }
                    >
                      Load earlier messages
                    </button>
                  )}
                  {social.messages.length === 0 && !social.loading && (
                    <div className="social-conversation-empty">
                      <span>✳</span>
                      <h3>A space for connection.</h3>
                      <p>Send a message, share a photo, or coordinate a task.</p>
                    </div>
                  )}
                  {social.messages.map(message => {
                    const sender = social.profiles.find(p => p.id === message.sender_id);
                    const parent = social.messages.find(p => p.id === message.reply_to);
                    const reactions = social.reactions.filter(r => r.message_id === message.id);
                    const offset = swipeOffset[message.id] || 0;

                    return (
                      <article
                        key={message.id}
                        className={`social-message ${message.sender_id === profile.id ? 'mine' : ''}`}
                        data-message-id={message.id}
                        style={{
                          transform: offset ? `translateX(${offset}px)` : undefined,
                          transition: offset ? 'none' : undefined,
                          touchAction: 'pan-y',
                        }}
                        onPointerDown={e => handlePointerDown(message.id, e)}
                        onPointerMove={e => handlePointerMove(message.id, e)}
                        onPointerUp={() => handlePointerUp(message)}
                        onContextMenu={e => handleContextMenu(message, e)}
                      >
                        <div className="social-message-meta">
                          <strong>{sender?.display_name || 'Member'}</strong>
                          <time dateTime={message.created_at}>
                            {new Date(message.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                          {message.sender_id === profile.id && (
                            <span className="social-message-tick" title="Delivered">✓✓</span>
                          )}
                          {message.edited_at && !message.deleted && <small>edited</small>}
                        </div>
                        {message.reply_to && (
                          <blockquote>
                            {parent?.deleted ? 'Message deleted' : parent?.body || 'Earlier photo or message'}
                          </blockquote>
                        )}
                        {message.deleted ? (
                          <p className="social-muted">Message deleted</p>
                        ) : (
                          <>
                            {editing?.id === message.id ? (
                              <form
                                onSubmit={e => {
                                  e.preventDefault();
                                  void run(async () => {
                                    await social.mutate('edit_message', {
                                      message_id: message.id,
                                      body: editText,
                                    });
                                    setEditing(null);
                                  });
                                }}
                              >
                                <input
                                  aria-label="Edit message text"
                                  required
                                  maxLength={4000}
                                  value={editText}
                                  onChange={e => setEditText(e.target.value)}
                                />
                                <button>Save edit</button>
                                <button type="button" onClick={() => setEditing(null)}>
                                  Cancel
                                </button>
                              </form>
                            ) : (
                              <p className="social-message-body">{message.body}</p>
                            )}
                            {message.attachment_path && (
                              <PrivateImage
                                path={message.attachment_path}
                                alt={`Photo from ${sender?.display_name || 'member'}`}
                              />
                            )}
                            <div className="social-message-actions">
                              <button
                                onClick={() => {
                                  setReply(message);
                                  document.getElementById('social-composer')?.focus();
                                }}
                              >
                                Reply
                              </button>
                              {['👍', '❤️', '😂', '🎉', '👀', '👋'].map(emoji => (
                                <button
                                  key={emoji}
                                  aria-label={`React ${emoji}`}
                                  aria-pressed={reactions.some(
                                    r => r.emoji === emoji && r.user_id === profile.id
                                  )}
                                  onClick={() =>
                                    void run(() => social.mutate('react', { message_id: message.id, emoji }))
                                  }
                                >
                                  {emoji}
                                  {reactions.filter(r => r.emoji === emoji).length || ''}
                                </button>
                              ))}
                              {message.sender_id === profile.id ? (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditing(message);
                                      setEditText(message.body);
                                    }}
                                  >
                                    Edit message
                                  </button>
                                  <button
                                    onClick={() =>
                                      void run(() => social.mutate('delete_message', { message_id: message.id }))
                                    }
                                  >
                                    Delete message
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => {
                                    const reason = window.prompt(
                                      'Why are you reporting this message? (3–1000 characters)'
                                    );
                                    if (reason)
                                      void run(() =>
                                        social.mutate('report', {
                                          user_id: message.sender_id,
                                          message_id: message.id,
                                          reason,
                                        })
                                      );
                                  }}
                                >
                                  Report
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>

                {contextMenu && (
                  <div
                    className="social-context-menu"
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                    role="menu"
                    aria-label="Message options"
                  >
                    <div className="social-context-emojis">
                      {['👍', '❤️', '😂', '🎉', '👀', '👋'].map(emoji => (
                        <button
                          key={emoji}
                          aria-label={`React ${emoji}`}
                          onClick={() => {
                            void run(() =>
                              social.mutate('react', {
                                message_id: contextMenu.message.id,
                                emoji,
                              })
                            );
                            setContextMenu(null);
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <button
                      className="social-context-item"
                      onClick={() => {
                        setReply(contextMenu.message);
                        document.getElementById('social-composer')?.focus();
                        setContextMenu(null);
                      }}
                    >
                      <span>↩</span> Reply
                    </button>
                    {contextMenu.message.body && (
                      <button
                        className="social-context-item"
                        onClick={() => {
                          void navigator.clipboard?.writeText(contextMenu.message.body);
                          setContextMenu(null);
                        }}
                      >
                        <span>📋</span> Copy text
                      </button>
                    )}
                    {contextMenu.message.sender_id === profile.id ? (
                      <>
                        <button
                          className="social-context-item"
                          onClick={() => {
                            setEditing(contextMenu.message);
                            setEditText(contextMenu.message.body);
                            setContextMenu(null);
                          }}
                        >
                          <span>✏️</span> Edit message
                        </button>
                        <button
                          className="social-context-item"
                          onClick={() => {
                            void run(() =>
                              social.mutate('delete_message', { message_id: contextMenu.message.id })
                            );
                            setContextMenu(null);
                          }}
                        >
                          <span>🗑️</span> Delete message
                        </button>
                      </>
                    ) : (
                      <button
                        className="social-context-item"
                        onClick={() => {
                          const reason = window.prompt(
                            'Why are you reporting this message? (3–1000 characters)'
                          );
                          if (reason)
                            void run(() =>
                              social.mutate('report', {
                                user_id: contextMenu.message.sender_id,
                                message_id: contextMenu.message.id,
                                reason,
                              })
                            );
                          setContextMenu(null);
                        }}
                      >
                        <span>🚩</span> Report message
                      </button>
                    )}
                  </div>
                )}

                <div className="social-typing" aria-live="polite">
                  {social.typing
                    .filter(id => memberProfiles.some(p => p.id === id))
                    .map(id => social.profiles.find(p => p.id === id)?.display_name)
                    .join(', ')}
                  {social.typing.length > 0 ? ' is typing…' : ''}
                </div>

                <form className="social-composer" onSubmit={submit}>
                  {reply && (
                    <div className="social-reply-preview">
                      <div className="social-reply-meta">
                        <strong>Replying to {social.profiles.find(p => p.id === reply.sender_id)?.display_name}:</strong>
                        <span>{reply.body.slice(0, 60) || 'Photo'}</span>
                      </div>
                      <button type="button" aria-label="Cancel reply" onClick={() => setReply(null)}>
                        ×
                      </button>
                    </div>
                  )}
                  {showEmoji && (
                    <div className="social-composer-emoji-popover" role="dialog" aria-label="Emoji picker">
                      {['😊', '😂', '❤️', '🔥', '👍', '🎉', '✨', '👀', '👋', '🙏'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          aria-label={`Insert ${emoji}`}
                          onClick={() => {
                            setDraft(d => d + emoji);
                            setShowEmoji(false);
                            document.getElementById('social-composer')?.focus();
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="social-composer-row">
                    <button
                      type="button"
                      className="social-composer-attach-btn"
                      onClick={() => setDialog('photo')}
                      aria-label="Attach or capture photo"
                      title="Attach or capture photo"
                    >
                      <CameraIcon size={19} />
                    </button>
                    <label className="sr-only" htmlFor="social-composer">
                      Message
                    </label>
                    <textarea
                      id="social-composer"
                      aria-label="Message"
                      rows={1}
                      maxLength={4000}
                      placeholder="Write a message…"
                      value={draft}
                      onChange={e => {
                        setDraft(e.target.value);
                        social.sendTyping();
                      }}
                      onPaste={e => {
                        const items = e.clipboardData?.items;
                        if (items) {
                           for (let i = 0; i < items.length; i++) {
                            if (items[i].type.startsWith('image/')) {
                              const file = items[i].getAsFile();
                              if (file) {
                                e.preventDefault();
                                void sendPhoto(file);
                                break;
                              }
                            }
                          }
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          e.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="social-composer-emoji-btn"
                      onClick={() => setShowEmoji(v => !v)}
                      aria-label="Insert emoji"
                      title="Insert emoji"
                    >
                      <EmojiIcon size={19} />
                    </button>
                    <button
                      className="social-primary social-composer-send"
                      disabled={busy || !draft.trim()}
                      aria-label="Send"
                    >
                      <SendIcon size={14} />
                      <span>Send</span>
                    </button>
                  </div>
                  <div className="social-composer-hint">
                    <span>Return to send · Shift+Return for new line · Drag & drop or paste photos</span>
                  </div>
                </form>
              </>
            ) : (
              <section className="social-welcome">
                <div className="social-welcome-glyph">✳</div>
                <h1>Make room for connection.</h1>
                <p>
                  A calm space for thoughtful conversations, shared tasks, and creative moments.
                  <br />
                  Select a chat or start a fresh connection.
                </p>
                <button className="social-primary" onClick={() => setDialog('new')}>
                  <PlusIcon size={14} />
                  <span>Start a conversation</span>
                </button>
              </section>
            )}
          </main>
        )}

        {/* Right Detail Panel (Tasks & Members) */}
        {!world && room && panel && (
          <aside className="social-detail-panel">
            <div className="social-row">
              <h2>{panel === 'tasks' ? 'Make a plan' : 'People here'}</h2>
              <button aria-label="Close side panel" onClick={() => setPanel(null)}>
                ×
              </button>
            </div>
            {panel === 'tasks' ? (
              <TaskBoard
                key={room.id}
                tasks={social.tasks}
                members={memberProfiles}
                userId={profile.id}
                admin={admin}
                mutate={social.mutate}
                fail={social.setError}
              />
            ) : (
              <>
                <MemberPanel
                  social={social}
                  room={room}
                  profile={profile}
                  memberProfiles={memberProfiles}
                  admin={admin}
                  run={run}
                />
                {room.kind !== 'direct' && room.owner_id !== profile.id && (
                  <button
                    onClick={() =>
                      void run(async () => {
                        await social.mutate('leave_room');
                        social.setSelected(null);
                      })
                    }
                  >
                    Leave {room.kind === 'channel' ? 'community' : 'group'}
                  </button>
                )}
              </>
            )}
          </aside>
        )}
      </div>

      {social.error && (
        <div className="social-alert" role="alert">
          <span>{social.error}</span>
          <button aria-label="Dismiss error" onClick={() => social.setError('')}>
            ×
          </button>
        </div>
      )}

      {!guest && dialog === 'profile' && (
        <ProfileEditor
          profile={profile}
          onSaved={async () => {
            await refreshProfile();
            await social.refresh();
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === 'new' && (
        <NewConversation
          social={social}
          profile={profile}
          close={() => setDialog(null)}
          select={id => {
            selectRoom(id);
            setPanel('members');
            setDialog(null);
          }}
        />
      )}

      {dialog === 'communities' && (
        <CommunityDirectory
          social={social}
          profile={profile}
          close={() => setDialog(null)}
          select={id => {
            selectRoom(id);
            setDialog(null);
          }}
        />
      )}

      {dialog === 'photo' && <PhotoEditor send={sendPhoto} close={() => setDialog(null)} />}

      {dialog === 'ai' && (
        <Modal title="Summarize this conversation" close={() => setDialog(null)}>
          <p>
            On your request, up to 80 recent messages will be sent to Google Gemini to produce a summary. Photos are
            excluded. Continue only if you are comfortable sharing this conversation with the AI provider.
          </p>
          <button className="social-primary" disabled={busy} onClick={summarize}>
            {busy ? 'Summarizing…' : 'Send messages to Gemini and summarize'}
          </button>
          {aiText && (
            <p className="social-ai-result" role="status">
              {aiText}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}

function NewConversation({
  social,
  profile,
  close,
  select,
}: {
  social: Platform;
  profile: Profile;
  close: () => void;
  select: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Profile[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function find(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      setFound(await social.searchProfiles(query));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await social.mutate('create_group', { name });
      if (result.id) select(result.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Start a conversation" close={close}>
      <form onSubmit={find}>
        <label>
          Find a username
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search username"
            maxLength={24}
            required
          />
        </label>
        <button disabled={busy}>Find people</button>
      </form>
      <div className="social-search-results">
        {found
          .filter(p => p.id !== profile.id)
          .map(p => (
            <div className="social-person" key={p.id}>
              {avatar(p)}
              <span>
                <strong>{p.display_name}</strong>
                <small>@{p.username}</small>
              </span>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const result = await social.mutate('open_dm', { user_id: p.id });
                    if (result.id) select(result.id);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Message {p.display_name}
              </button>
            </div>
          ))}
      </div>
      <hr />
      <form onSubmit={create}>
        <h3>Bring people together</h3>
        <label>
          Group name
          <input required minLength={2} maxLength={60} value={name} onChange={e => setName(e.target.value)} />
        </label>
        <button className="social-primary" disabled={busy}>
          Create group
        </button>
      </form>
      {error && (
        <p role="alert" className="social-error">
          {error}
        </p>
      )}
    </Modal>
  );
}

function CommunityDirectory({
  social,
  profile,
  close,
  select,
}: {
  social: Platform;
  profile: Profile;
  close: () => void;
  select: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await social.mutate('create_community', { name });
      if (result.room_id) select(result.room_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Communities" close={close}>
      <p className="social-muted">
        Communities are discoverable. Join to read and participate in their channels.
      </p>
      <div className="social-search-results">
        {social.communities.map(c => {
          const joined = social.communityMembers.some(
            m => m.community_id === c.id && m.user_id === profile.id
          );
          return (
            <div className="social-person" key={c.id}>
              <strong>{c.name}</strong>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    if (!joined) await social.mutate('join_community', { community_id: c.id });
                    await social.refresh();
                    close();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {joined ? 'Joined' : 'Join'}
              </button>
            </div>
          );
        })}
      </div>
      <form onSubmit={create}>
        <label>
          Community name
          <input required minLength={2} maxLength={60} value={name} onChange={e => setName(e.target.value)} />
        </label>
        <button className="social-primary" disabled={busy}>
          Create community
        </button>
      </form>
      {error && (
        <p role="alert" className="social-error">
          {error}
        </p>
      )}
    </Modal>
  );
}

function MemberPanel({
  social,
  room,
  profile,
  memberProfiles,
  admin,
  run,
}: {
  social: Platform;
  room: Room;
  profile: Profile;
  memberProfiles: Profile[];
  admin: boolean;
  run: (op: () => Promise<unknown>) => Promise<unknown>;
}) {
  const [user, setUser] = useState('');
  const [name, setName] = useState(room.name);
  const [channel, setChannel] = useState('');
  const isOwner =
    room.kind === 'channel'
      ? social.communities.find(c => c.id === room.community_id)?.owner_id === profile.id
      : room.owner_id === profile.id;

  return (
    <section className="social-member-panel">
      <div className="social-members">
        {memberProfiles.map(p => {
          const memberRole =
            room.kind === 'channel'
              ? social.communityMembers.find(m => m.community_id === room.community_id && m.user_id === p.id)
                  ?.role
              : social.members.find(m => m.room_id === room.id && m.user_id === p.id)?.role;
          return (
            <div className="social-member" key={p.id}>
              <div className="social-person">
                {avatar(p)}
                <span>
                  <strong>
                    {p.display_name}
                    {p.id === profile.id ? ' (you)' : ''}
                  </strong>
                  <small>
                    @{p.username} · {social.online.includes(p.id) ? 'Online' : 'Offline'} · {memberRole}
                  </small>
                </span>
              </div>
              {p.bio && <p className="social-muted">{p.bio}</p>}
              {p.id !== profile.id && (
                <div className="social-actions">
                  <button
                    onClick={() =>
                      void run(() =>
                        social.mutate(social.blocks.includes(p.id) ? 'unblock' : 'block', { user_id: p.id })
                      )
                    }
                  >
                    {social.blocks.includes(p.id) ? 'Unblock' : 'Block'}
                  </button>
                  <button
                    onClick={() => {
                      const reason = window.prompt('Why are you reporting this person?');
                      if (reason) void run(() => social.mutate('report', { user_id: p.id, reason }));
                    }}
                  >
                    Report person
                  </button>
                  {admin && room.kind === 'group' && memberRole !== 'owner' && (
                    <button
                      onClick={() => void run(() => social.mutate('remove_member', { user_id: p.id }))}
                    >
                      Remove member
                    </button>
                  )}
                  {isOwner && room.kind === 'channel' && memberRole !== 'owner' && (
                    <>
                      <button
                        onClick={() =>
                          void run(() =>
                            social.mutate('community_role', {
                              community_id: room.community_id,
                              user_id: p.id,
                              role: memberRole === 'admin' ? 'member' : 'admin',
                            })
                          )
                        }
                      >
                        {memberRole === 'admin' ? 'Remove admin' : 'Make admin'}
                      </button>
                      <button
                        onClick={() =>
                          void run(() =>
                            social.mutate('remove_community_member', {
                              community_id: room.community_id,
                              user_id: p.id,
                            })
                          )
                        }
                      >
                        Remove member
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {admin && room.kind === 'group' && (
        <>
          <form
            onSubmit={e => {
              e.preventDefault();
              void run(async () => {
                const matches = await social.searchProfiles(user);
                const target = matches.find(
                  p => p.username === user.normalize('NFKC').trim().toLowerCase()
                );
                if (!target) throw new Error('No account has that username.');
                await social.mutate('add_member', { user_id: target.id });
                setUser('');
              });
            }}
          >
            <label>
              Invite by username
              <input
                required
                aria-label="Invite username"
                value={user}
                onChange={e => setUser(e.target.value)}
              />
            </label>
            <button>Invite member</button>
          </form>
          <form
            onSubmit={e => {
              e.preventDefault();
              void run(() => social.mutate('rename_room', { name }));
            }}
          >
            <label>
              Group name
              <input
                required
                minLength={2}
                maxLength={60}
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </label>
            <button>Rename group</button>
          </form>
        </>
      )}
      {admin && room.kind === 'channel' && (
        <form
          onSubmit={e => {
            e.preventDefault();
            void run(async () => {
              const result = await social.mutate('create_channel', {
                community_id: room.community_id,
                name: channel,
              });
              if (result.id) social.setSelected(result.id);
              setChannel('');
            });
          }}
        >
          <label>
            Channel name
            <input
              required
              minLength={2}
              maxLength={60}
              value={channel}
              onChange={e => setChannel(e.target.value)}
            />
          </label>
          <button>Create channel</button>
        </form>
      )}
    </section>
  );
}
