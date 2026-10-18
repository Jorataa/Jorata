import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AttachmentIcon, ChatIcon, ChevronLeftIcon, EmojiIcon, SearchIcon, SendIcon, TasksIcon, UsersIcon } from './Icons';
import { usePresence, useSwipeReply } from './interactions';
import { PrivateImage } from './PrivateImage';
import { SocialDialog } from './SocialDialog';
import type { ChatMessage, Profile } from './types';
import type { useSocial } from './useSocial';

type Platform = ReturnType<typeof useSocial>;
type Props = {
  profile: Profile;
  platform: Platform;
  guest: boolean;
  active?: boolean;
  panel: 'tasks' | 'members' | null;
  onPanel: (panel: 'tasks' | 'members') => void;
  onBack: () => void;
  onSummarize: () => void;
  onPhoto: (replyTo: string | null, onSent: () => void, initialPhoto?: Blob) => void;
};
type MessageMenu = { message: ChatMessage; x: number; y: number; trigger: HTMLElement | null };
type Position = { top: number; bottom: boolean };
const REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '👋'];
const EMOJI = ['😊', '😂', '❤️', '🔥', '👍', '🎉', '✨', '👀', '👋', '🙏', '🙌', '💚'];

function DotsIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>;
}

function linkedText(body: string): ReactNode[] {
  return body.split(/(https?:\/\/[^\s<>]+)/gi).map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return part;
    const trailing = part.match(/[.,!?;:]+$/)?.[0] || '';
    const href = trailing ? part.slice(0, -trailing.length) : part;
    return <Fragment key={index}><a href={href} target="_blank" rel="noopener noreferrer">{href}</a>{trailing}</Fragment>;
  });
}

function dateLabel(iso: string) {
  const date = new Date(iso), today = new Date(), yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' as const } : {}) });
}

function grouped(first: ChatMessage | undefined, second: ChatMessage | undefined) {
  return !!first && !!second && !first.deleted && !second.deleted && first.sender_id === second.sender_id &&
    new Date(first.created_at).toDateString() === new Date(second.created_at).toDateString() &&
    Math.abs(Date.parse(second.created_at) - Date.parse(first.created_at)) < 5 * 60 * 1000;
}

export function ChatConversation({ profile, platform: social, guest, active = true, panel, onPanel, onBack, onSummarize, onPhoto }: Props) {
  const room = social.rooms.find(item => item.id === social.selected);
  const roomId = room?.id || '';
  const messages = useMemo(() => social.messages.filter(message => message.room_id === roomId), [social.messages, roomId]);
  const profiles = useMemo(() => new Map(social.profiles.map(person => [person.id, person])), [social.profiles]);
  const messageMap = useMemo(() => new Map(messages.map(message => [message.id, message])), [messages]);
  const membership = room?.kind === 'channel' ? social.communityMembers.filter(member => member.community_id === room.community_id) : social.members.filter(member => member.room_id === roomId);
  const other = room?.kind === 'direct' ? profiles.get(membership.find(member => member.user_id !== profile.id)?.user_id || '') : undefined;
  const name = room?.kind === 'direct' ? other?.display_name || 'Direct conversation' : room?.name || '';
  const typing = social.typing.filter(id => membership.some(member => member.user_id === id)).map(id => profiles.get(id)?.display_name || 'Someone');

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replyState, setReply] = useState<{ roomId: string; message: ChatMessage } | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [sendingRooms, setSendingRooms] = useState<Set<string>>(new Set());
  const [sendErrors, setSendErrors] = useState<Record<string, string>>({});
  const [showEmoji, setShowEmoji] = useState(false);
  const [menu, setMenu] = useState<MessageMenu | null>(null);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [away, setAway] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyExhausted, setHistoryExhausted] = useState(false);
  const [report, setReport] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');
  const [photo, setPhoto] = useState<{ path: string; alt: string } | null>(null);
  const [notice, setNotice] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, Position>());
  const keepBottom = useRef(true);
  const currentRoom = useRef(roomId);
  currentRoom.current = roomId;
  const readContext = useRef({ roomId, active, markRead: social.markRead });
  readContext.current = { roomId, active, markRead: social.markRead };
  const pendingSend = useRef(new Set<string>());
  const rendered = useRef<{ roomId: string; ids: Set<string>; lastTime: number; ready: boolean }>({ roomId: '', ids: new Set(), lastTime: 0, ready: false });
  const olderPosition = useRef<{ roomId: string; top: number; height: number; count: number } | null>(null);
  const draft = drafts[roomId] || '';
  const reply = replyState?.roomId === roomId ? replyState.message : null;
  const busy = sendingRooms.has(roomId);
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const headerPresence = usePresence(headerMenu), emojiPresence = usePresence(showEmoji), searchPresence = usePresence(searchOpen);
  const dropPresence = usePresence(dragActive);
  const swipe = useSwipeReply(id => { const message = messageMap.get(id); if (message && !message.deleted) replyTo(message); });
  function previewPhoto(file?: Blob) {
    const selected = roomId;
    onPhoto(reply?.id || null, () => {
      setReply(current => current?.roomId === selected ? null : current);
      if (currentRoom.current === selected) jumpLatest();
    }, file);
  }
  const searchMatches = useMemo(() => search.trim() ? messages.filter(message => !message.deleted && message.body.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) : [], [messages, search]);

  function markVisibleRead() {
    const latest = readContext.current;
    if (latest.active && latest.roomId && keepBottom.current && document.visibilityState === 'visible') latest.markRead(latest.roomId);
  }

  useLayoutEffect(() => {
    const node = composer.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 152)}px`;
  }, [draft, roomId, active]);

  useLayoutEffect(() => {
    const node = scroller.current;
    if (!roomId) {
      rendered.current = { roomId: '', ids: new Set(), lastTime: 0, ready: false };
      return;
    }
    if (!node || !active) return;
    const previous = rendered.current;
    if (previous.roomId !== roomId) {
      const position = positions.current.get(roomId);
      keepBottom.current = position?.bottom ?? true;
      node.scrollTop = position?.top ?? node.scrollHeight;
      setAway(!keepBottom.current);
      setNewCount(0);
      setAnimatedIds(new Set());
      rendered.current = { roomId, ids: new Set(messages.map(message => message.id)), lastTime: Date.parse(messages.at(-1)?.created_at || '') || 0, ready: false };
      return;
    }
    if (social.loading) return;
    const appended = previous.ready ? messages.filter(message => !previous.ids.has(message.id) && Date.parse(message.created_at) >= previous.lastTime) : [];
    if (appended.length) {
      setAnimatedIds(new Set(appended.map(message => message.id)));
      if (!keepBottom.current) setNewCount(count => count + appended.length);
    }
    if (olderPosition.current?.roomId === roomId) {
      node.scrollTop = olderPosition.current.top + node.scrollHeight - olderPosition.current.height;
      setHistoryExhausted(messages.length <= olderPosition.current.count);
      olderPosition.current = null;
    } else if (keepBottom.current) {
      node.scrollTop = node.scrollHeight;
      markVisibleRead();
    } else if (!previous.ready) {
      node.scrollTop = positions.current.get(roomId)?.top || 0;
    }
    rendered.current = { roomId, ids: new Set(messages.map(message => message.id)), lastTime: Date.parse(messages.at(-1)?.created_at || '') || 0, ready: previous.ready };
  }, [messages, social.loading, roomId, active]);

  useEffect(() => {
    if (!roomId || social.loading || !active) return;
    const frame = requestAnimationFrame(() => {
      if (rendered.current.roomId === roomId) rendered.current.ready = true;
      if (keepBottom.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
      markVisibleRead();
    });
    return () => cancelAnimationFrame(frame);
  }, [roomId, social.loading, active]);

  useEffect(() => {
    setMenu(null); setHeaderMenu(false); setShowEmoji(false); setEditing(null);
    setSearchOpen(false); setSearch(''); setHistoryExhausted(false); setNotice('');
    olderPosition.current = null;
  }, [roomId, active]);

  useEffect(() => {
    function close(event: PointerEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target)) setMenu(null);
      if (!headerRef.current?.contains(target)) setHeaderMenu(false);
      if (!emojiRef.current?.contains(target)) setShowEmoji(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (menu) { menu.trigger?.focus(); setMenu(null); }
      setHeaderMenu(false); setShowEmoji(false);
    }
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape); };
  }, [menu]);

  useEffect(() => {
    if (menu) menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    if (headerMenu) headerRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [menu, headerMenu]);

  useEffect(() => {
    if (!active || !roomId) return;
    const node = scroller.current;
    const resize = () => {
      if (node && keepBottom.current) node.scrollTop = node.scrollHeight;
    };
    const observer = new ResizeObserver(resize);
    if (node) observer.observe(node);
    if (node?.firstElementChild) observer.observe(node.firstElementChild);
    document.addEventListener('visibilitychange', markVisibleRead);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', markVisibleRead); };
  }, [active, roomId]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(timeout);
  }, [notice]);

  async function run(operation: () => Promise<unknown>) {
    social.setError('');
    try { await operation(); return true; }
    catch (error) { social.setError(error instanceof Error ? error.message : 'Something went wrong. Please try again.'); return false; }
  }

  function updateDraft(value: string) {
    setDrafts(current => ({ ...current, [roomId]: value }));
    if (sendErrors[roomId]) setSendErrors(current => ({ ...current, [roomId]: '' }));
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!roomId || !draft.trim() || pendingSend.current.has(roomId)) return;
    const sendingRoom = roomId, body = draft, replyTo = reply?.id;
    pendingSend.current.add(sendingRoom);
    setSendingRooms(current => new Set(current).add(sendingRoom));
    setSendErrors(current => ({ ...current, [sendingRoom]: '' }));
    if (currentRoom.current === sendingRoom) keepBottom.current = true;
    try {
      await social.mutate('send_message', { room_id: sendingRoom, body, reply_to: replyTo });
      setDrafts(current => current[sendingRoom] === body ? { ...current, [sendingRoom]: '' } : current);
      setReply(current => current?.roomId === sendingRoom && current.message.id === replyTo ? null : current);
      if (currentRoom.current === sendingRoom) { setAway(false); setNewCount(0); }
    } catch (error) {
      setSendErrors(current => ({ ...current, [sendingRoom]: error instanceof Error ? error.message : 'Message could not be sent.' }));
    } finally {
      pendingSend.current.delete(sendingRoom);
      setSendingRooms(current => { const next = new Set(current); next.delete(sendingRoom); return next; });
    }
  }

  function replyTo(message: ChatMessage) {
    setReply({ roomId, message }); setMenu(null); composer.current?.focus();
  }

  function jumpLatest() {
    keepBottom.current = true;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    setAway(false); setNewCount(0); markVisibleRead();
  }

  function jumpMessage(id: string) {
    const element = scroller.current?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`);
    element?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    element?.focus({ preventScroll: true });
  }

  async function older() {
    if (!scroller.current || loadingOlder) return;
    olderPosition.current = { roomId, top: scroller.current.scrollTop, height: scroller.current.scrollHeight, count: messages.length };
    keepBottom.current = false; setLoadingOlder(true);
    const success = await run(() => social.loadOlder());
    if (!success) olderPosition.current = null;
    setLoadingOlder(false);
  }

  function openMenu(message: ChatMessage, x: number, y: number, trigger: HTMLElement | null) {
    if (message.deleted) return;
    setMenu({ message, x: Math.max(10, Math.min(x, window.innerWidth - 242)), y: Math.max(10, Math.min(y, window.innerHeight - 285)), trigger });
  }

  function menuKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  if (!room) return null;

  return <div className="social-conversation-content"
    onDragEnter={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); dragDepth.current++; setDragActive(true); } }}
    onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }}
    onDragLeave={event => { if (event.dataTransfer.types.includes('Files') && --dragDepth.current <= 0) { dragDepth.current = 0; setDragActive(false); } }}
    onDrop={event => {
      event.preventDefault(); dragDepth.current = 0; setDragActive(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length !== 1) { social.setError('Choose one photo at a time. Supported formats: JPEG, PNG and WebP.'); return; }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(files[0].type)) { social.setError('This chat supports JPEG, PNG and WebP photos. Other file types are not supported yet.'); return; }
      previewPhoto(files[0]);
    }}>
    {dropPresence.value && <div className="social-drop-overlay" data-closing={dropPresence.closing}><AttachmentIcon size={32} /><h2>Drop a photo</h2><p>Preview it before you send.</p><small>JPEG, PNG or WebP</small></div>}
    <header className="social-conversation-heading">
      <button type="button" className="social-mobile-back social-icon-button" onClick={onBack} aria-label="Back to conversations"><ChevronLeftIcon size={23} /></button>
      <button type="button" className="social-heading-lockup" onClick={() => onPanel('members')} aria-label={`View details for ${name}`}>
        <span className="social-heading-avatar">
          {other?.avatar_path ? <PrivateImage bucket="jr-avatars" path={other.avatar_path} alt="" /> : <span className="social-avatar" aria-hidden="true">{room.kind === 'direct' ? name.charAt(0).toUpperCase() : room.kind === 'group' ? <UsersIcon size={22} /> : '#'}</span>}
          {other && social.online.includes(other.id) && <span className="social-online-dot" />}
        </span>
        <span className="social-heading-info"><span className="social-conversation-name" role="heading" aria-level={2}>{name}</span><span className={`social-heading-status ${other && social.online.includes(other.id) ? 'social-online-label' : 'social-muted'}`}>{typing.length ? <><span className="social-typing-dots" aria-hidden="true"><i /><i /><i /></span> {typing.length === 1 ? `${typing[0]} is typing` : 'Several people are typing'}</> : room.kind === 'direct' ? social.online.includes(other?.id || '') ? 'online' : 'Direct conversation' : `${membership.length} ${membership.length === 1 ? 'member' : 'members'}`}</span></span>
      </button>
      <div className="social-actions">
        <button className="social-icon-button" type="button" aria-label="Search in conversation" aria-expanded={searchOpen} onClick={() => setSearchOpen(value => !value)} title="Search in conversation"><SearchIcon size={21} /></button>
        <div className="social-chat-menu-wrap" ref={headerRef}>
          <button className="social-icon-button" type="button" aria-label="Conversation options" aria-haspopup="menu" aria-expanded={headerMenu} onClick={() => setHeaderMenu(value => !value)} title="Conversation options"><DotsIcon /></button>
          {headerPresence.value && <div data-closing={headerPresence.closing} inert={headerPresence.closing} className="social-chat-menu" role="menu" aria-label="Conversation options" onKeyDown={menuKeys}>
            <button role="menuitem" onClick={() => { onPanel('members'); setHeaderMenu(false); }}><UsersIcon />{room.kind === 'direct' ? 'Contact details' : 'Members'}</button>
            <button role="menuitem" onClick={() => { onPanel('tasks'); setHeaderMenu(false); }}><TasksIcon />{panel === 'tasks' ? 'Close shared tasks' : 'Shared tasks'}</button>
            {!guest && <button role="menuitem" onClick={() => { onSummarize(); setHeaderMenu(false); }}><ChatIcon />Summarize conversation</button>}
          </div>}
        </div>
      </div>
    </header>
    {social.status !== 'Live' && social.status !== 'Browser demo' && <div className="social-chat-connection" role="status"><span className="social-connection-dot" aria-hidden="true" /><span>{social.status === 'Connecting' ? 'Connecting to your conversation…' : social.status === 'Reconnecting' ? 'Connection lost. Reconnecting…' : social.status === 'Offline' ? 'You’re offline. Your unsent message stays here.' : 'Connection unavailable. Your unsent message stays here.'}</span></div>}
    {searchPresence.value && <form data-closing={searchPresence.closing} inert={searchPresence.closing} className="social-chat-search" onSubmit={event => { event.preventDefault(); if (searchMatches.length) { const index = searchIndex % searchMatches.length; jumpMessage(searchMatches[index].id); setSearchIndex(index + 1); } }}>
      <SearchIcon /><input autoFocus aria-label="Search loaded messages" placeholder="Search this conversation" value={search} onChange={event => { setSearch(event.target.value); setSearchIndex(0); }} />
      <span role="status">{search ? `${searchMatches.length} ${searchMatches.length === 1 ? 'match' : 'matches'}` : 'Loaded messages'}</span>
      {searchMatches.length > 0 && <button type="submit">Next</button>}<button type="button" className="social-icon-button" aria-label="Close conversation search" onClick={() => { setSearchOpen(false); setSearch(''); }}>×</button>
    </form>}
    <div className="social-message-area">
      <div ref={scroller} className="social-messages" role="log" aria-label="Conversation messages" aria-live={social.loading ? 'off' : 'polite'} aria-relevant="additions" aria-busy={social.loading} onScroll={() => {
        const node = scroller.current!;
        // A newly selected room can briefly render before its history arrives.
        // Do not let that empty scroller overwrite the room's saved position.
        if (!rendered.current.ready || rendered.current.roomId !== roomId) return;
        keepBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
        positions.current.set(roomId, { top: node.scrollTop, bottom: keepBottom.current });
        setAway(!keepBottom.current);
        if (keepBottom.current) { setNewCount(0); markVisibleRead(); }
      }}>
        <div className="social-message-stream">
          {social.loading && messages.length === 0 && <div className="social-message-loading" role="status"><span className="sr-only">Loading messages…</span>{[0, 1, 2, 3].map(index => <div key={index} className={`social-message-skeleton ${index % 2 ? 'mine' : ''}`} />)}</div>}
          {!guest && messages.length >= 100 && !historyExhausted && <button type="button" className="social-history-button" disabled={loadingOlder} onClick={() => void older()}>{loadingOlder ? 'Loading earlier messages…' : 'Load earlier messages'}</button>}
          {!social.loading && messages.length === 0 && <div className="social-conversation-empty"><span className="social-empty-icon"><ChatIcon size={28} /></span><h3>Say hello to {room.kind === 'direct' ? name : 'everyone'}.</h3><p>This is the beginning of your conversation.</p><button type="button" onClick={() => composer.current?.focus()}>Write the first message</button></div>}
          {messages.map((message, index) => {
            const previous = messages[index - 1], next = messages[index + 1];
            const own = message.sender_id === profile.id;
            const sender = profiles.get(message.sender_id);
            const parent = message.reply_to ? messageMap.get(message.reply_to) : undefined;
            const newDay = !previous || new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString();
            const reactions = social.reactions.filter(reaction => reaction.message_id === message.id && reaction.active);
            const emojis = [...new Set(reactions.map(reaction => reaction.emoji))];
            return <Fragment key={message.id}>
              {newDay && <div className="social-day-divider"><span>{dateLabel(message.created_at)}</span></div>}
              <article {...(!message.deleted ? swipe : {})} tabIndex={-1} data-message-id={message.id} className={`social-message ${own ? 'mine' : ''} ${!grouped(previous, message) ? 'grouped-start' : ''} ${!grouped(message, next) ? 'grouped-end' : ''} ${animatedIds.has(message.id) ? 'is-new' : ''} ${searchMatches.some(match => match.id === message.id) ? 'is-search-result' : ''}`} onContextMenu={event => { if (!message.deleted) { event.preventDefault(); openMenu(message, event.clientX, event.clientY, event.currentTarget); } }}>
                {!message.deleted && <span className="social-swipe-reply" aria-hidden="true">↩</span>}
                {!own && room.kind !== 'direct' && !grouped(previous, message) && <strong className="social-message-sender">{sender?.display_name || 'Member'}</strong>}
                {message.reply_to && <button type="button" className="social-message-reply" disabled={!parent} onClick={() => parent && jumpMessage(parent.id)}><strong>{parent ? profiles.get(parent.sender_id)?.display_name || 'Member' : 'Earlier message'}</strong><span>{parent?.deleted ? 'Message deleted' : parent?.body || (parent?.attachment_path ? 'Photo' : 'Reply to an earlier message')}</span></button>}
                {message.deleted ? <p className="social-message-body social-muted"><i>Message deleted</i></p> : <>
                  {editing?.id === message.id ? <form className="social-message-edit" onSubmit={event => { event.preventDefault(); if (!editText.trim() || editBusy) return; setEditBusy(true); void run(() => social.mutate('edit_message', { room_id: roomId, message_id: message.id, body: editText })).then(ok => { if (ok) setEditing(null); }).finally(() => setEditBusy(false)); }}>
                    <textarea autoFocus aria-label="Edit message text" rows={3} required maxLength={4000} value={editText} onChange={event => setEditText(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setEditing(null); }} />
                    <div><button type="button" onClick={() => setEditing(null)}>Cancel</button><button type="submit" disabled={editBusy || !editText.trim()}>{editBusy ? 'Saving…' : 'Save edit'}</button></div>
                  </form> : message.body && <p className="social-message-body">{linkedText(message.body)}</p>}
                  {message.attachment_path && <button className="social-message-photo-button" type="button" aria-label={`Open photo from ${sender?.display_name || 'member'}`} onClick={() => setPhoto({ path: message.attachment_path!, alt: `Photo from ${sender?.display_name || 'member'}` })}><PrivateImage path={message.attachment_path} alt={`Photo from ${sender?.display_name || 'member'}`} /></button>}
                </>}
                <div className="social-message-meta">{message.edited_at && !message.deleted && <span>edited</span>}<time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString()}>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>{own && !message.deleted && <span className="social-message-tick" aria-label="Sent" title="Sent">✓</span>}</div>
                {!message.deleted && emojis.length > 0 && <div className="social-reactions">{emojis.map(emoji => <button type="button" key={emoji} className="social-reaction" aria-label={`React ${emoji}`} aria-pressed={reactions.some(reaction => reaction.emoji === emoji && reaction.user_id === profile.id)} onClick={() => void run(() => social.mutate('react', { room_id: roomId, message_id: message.id, emoji }))}>{emoji}<span>{reactions.filter(reaction => reaction.emoji === emoji).length}</span></button>)}</div>}
                {!message.deleted && <div className="social-message-tools"><button type="button" className="social-message-more" aria-label="Message options" aria-haspopup="menu" aria-expanded={menu?.message.id === message.id} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); openMenu(message, own ? rect.left - 200 : rect.right + 4, rect.top, event.currentTarget); }}><DotsIcon /></button></div>}
              </article>
            </Fragment>;
          })}
        </div>
      </div>
      {away && <button type="button" className="social-jump-latest" onClick={jumpLatest} aria-label={newCount ? `${newCount} new messages. Jump to latest message` : 'Jump to latest message'}><span aria-hidden="true">↓</span>{newCount > 0 && <span className="social-jump-count">{newCount}</span>}</button>}
    </div>
    <div className="social-composer-shell">
      <div className={`social-typing ${typing.length ? 'is-typing' : ''}`} aria-live="polite">{typing.length > 0 && <><span className="social-typing-dots" aria-hidden="true"><i /><i /><i /></span><span>{typing.length === 1 ? `${typing[0]} is typing…` : 'Several people are typing…'}</span></>}</div>
      <form className="social-composer" onSubmit={event => void submit(event)}>
        {reply && <div className="social-reply-preview"><div className="social-reply-meta"><strong>Replying to {profiles.get(reply.sender_id)?.display_name || 'Member'}</strong><span>{reply.deleted ? 'Message deleted' : reply.body || 'Photo'}</span></div><button type="button" className="social-icon-button" aria-label="Cancel reply" onClick={() => setReply(null)}>×</button></div>}
        {sendErrors[roomId] && <div className="social-send-error" role="alert"><span>Couldn’t send. {sendErrors[roomId]}</span><button type="button" disabled={busy || !draft.trim()} onClick={() => void submit()}>Try again</button></div>}
        <div className="social-composer-row">
          <button type="button" className="social-composer-attach-btn social-icon-button" onClick={() => previewPhoto()} aria-label="Attach or capture photo" title="Attach a photo"><AttachmentIcon size={22} /></button>
          <textarea ref={composer} id="social-composer" aria-label="Message" rows={1} maxLength={4000} placeholder="Message…" value={draft} onChange={event => { updateDraft(event.target.value); social.sendTyping(); }} onPaste={event => { const file = Array.from(event.clipboardData.items).find(item => item.type.startsWith('image/'))?.getAsFile(); if (file) { event.preventDefault(); previewPhoto(file); } }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void submit(); } }} />
          <div className="social-emoji-anchor" ref={emojiRef}>
            <button type="button" className="social-composer-emoji-btn social-icon-button" aria-label="Insert emoji" title="Insert emoji" aria-expanded={showEmoji} aria-controls="social-emoji-picker" onClick={() => setShowEmoji(value => !value)}><EmojiIcon size={22} /></button>
            {emojiPresence.value && <div data-closing={emojiPresence.closing} inert={emojiPresence.closing} id="social-emoji-picker" className="social-composer-emoji-popover" role="dialog" aria-label="Emoji picker">{EMOJI.map(emoji => <button type="button" key={emoji} aria-label={`Insert ${emoji}`} onClick={() => { const node = composer.current; const start = node?.selectionStart ?? draft.length, end = node?.selectionEnd ?? draft.length; const next = draft.slice(0, start) + emoji + draft.slice(end); if (next.length > 4000) return; updateDraft(next); setShowEmoji(false); requestAnimationFrame(() => { node?.focus(); node?.setSelectionRange(start + emoji.length, start + emoji.length); }); }}>{emoji}</button>)}</div>}
          </div>
          <button type="submit" className={`social-primary social-composer-send ${busy ? 'is-sending' : ''}`} disabled={busy || !draft.trim()} aria-label={busy ? 'Sending message' : 'Send'} title={busy ? 'Sending…' : 'Send message'}>{busy ? <span className="social-spinner" aria-hidden="true" /> : <SendIcon size={21} />}</button>
        </div>
      </form>
      <span className="sr-only" role="status">{busy ? 'Sending message…' : notice}</span>
    </div>
    {menu && <div ref={menuRef} className="social-context-menu" style={{ left: menu.x, top: menu.y }} role="menu" aria-label="Message options" onKeyDown={menuKeys}>
      <div className="social-context-emojis">{REACTIONS.map(emoji => <button key={emoji} role="menuitem" aria-label={`React ${emoji}`} onClick={() => { void run(() => social.mutate('react', { room_id: menu.message.room_id, message_id: menu.message.id, emoji })); setMenu(null); }}>{emoji}</button>)}</div>
      <button role="menuitem" onClick={() => replyTo(menu.message)}>Reply</button>
      {menu.message.body && <button role="menuitem" onClick={() => { const body = menu.message.body; setMenu(null); void run(async () => { await navigator.clipboard.writeText(body); setNotice('Message copied'); }); }}>Copy text</button>}
      {menu.message.sender_id === profile.id ? <><button role="menuitem" onClick={() => { setEditing(menu.message); setEditText(menu.message.body); setMenu(null); }}>Edit message</button><button role="menuitem" className="social-danger-text" onClick={() => { void run(() => social.mutate('delete_message', { room_id: menu.message.room_id, message_id: menu.message.id })); setMenu(null); }}>Delete message</button></> : <button role="menuitem" onClick={() => { setReport(menu.message); setReportReason(''); setReportError(''); setMenu(null); }}>Report message</button>}
    </div>}
    {report && <SocialDialog title="Report message" close={() => setReport(null)}><form className="social-form" onSubmit={event => { event.preventDefault(); if (reportBusy || reportReason.trim().length < 3) return; setReportBusy(true); setReportError(''); void social.mutate('report', { room_id: report.room_id, user_id: report.sender_id, message_id: report.id, reason: reportReason.trim() }).then(() => { setReport(null); setNotice('Report submitted'); }).catch(error => setReportError(error instanceof Error ? error.message : 'Could not submit report.')).finally(() => setReportBusy(false)); }}><p className="social-muted">Tell us what’s wrong with this message.</p><label>Reason<textarea autoFocus required minLength={3} maxLength={1000} rows={4} value={reportReason} onChange={event => setReportReason(event.target.value)} /></label>{reportError && <p className="social-error" role="alert">{reportError}</p>}<button className="social-primary" disabled={reportBusy || reportReason.trim().length < 3}>{reportBusy ? 'Submitting…' : 'Submit report'}</button></form></SocialDialog>}
    {photo && <SocialDialog title="Photo" close={() => setPhoto(null)}><div className="social-photo-viewer"><PrivateImage path={photo.path} alt={photo.alt} /></div></SocialDialog>}
    {notice && <div className="social-chat-toast" role="status">{notice}</div>}
  </div>;
}
