import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { check, db } from './client';
import { PrivateImage } from './PrivateImage';
import { PhotoEditor } from './PhotoEditor';
import { TaskBoard } from './TaskBoard';
import { uploadImage } from './media';
import { ChatConversation } from './ChatConversation';
import { SocialDialog as Modal } from './SocialDialog';
import type { useSocial } from './useSocial';
import type { Profile, Room } from './types';
import { ChatIcon, UsersIcon, WorldIcon, SearchIcon, PlusIcon, ChevronLeftIcon, SettingsIcon, CameraIcon, TasksIcon } from './Icons';
import { usePresence, useSidebarResize } from './interactions';
import './social.css';
import './compact.css';
import './atmosphere.css';
const ProfileEditor = lazy(() => import('./AuthPanel').then(m => ({ default: m.ProfileEditor })));
const SocialWorld = lazy(() => import('./SocialWorld'));
type Platform = ReturnType<typeof useSocial>;

function avatar(profile: Profile, size = 40) {
  return profile.avatar_path ? <PrivateImage bucket="jr-avatars" path={profile.avatar_path} alt={`${profile.display_name}'s profile photo`} /> :
    <span className="social-avatar" style={{ width: size, height: size, fontSize: size * .36 }} aria-hidden="true">{profile.display_name.split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()}</span>;
}
function roomName(room: Room, social: Platform, uid: string) {
  if (room.kind !== 'direct') return room.name;
  const other = social.members.find(m => m.room_id === room.id && m.user_id !== uid);
  return social.profiles.find(p => p.id === other?.user_id)?.display_name || 'Direct conversation';
}
function activityTime(value: string) {
  const date = new Date(value), today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (Date.now() - date.getTime() < 6 * 86400000) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export type GuestWorkspaceOptions = { controls: ReactNode; edit: () => void; upload: (photo: Blob) => Promise<string>; world: ReactNode; notice: string; };

export function Workspace({ profile, refreshProfile, platform: social, guest }: {
  profile: Profile; refreshProfile: () => Promise<void>; platform: Platform; guest?: GuestWorkspaceOptions;
}) {
  const [dialog, setDialog] = useState<'new' | 'communities' | 'profile' | 'photo' | 'ai' | 'settings' | null>(null);
  const [world, setWorld] = useState(location.pathname === '/world');
  const [games, setGames] = useState(false);
  const [panel, setPanel] = useState<'tasks' | 'members' | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiText, setAiText] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups'>('all');
  const [initialPhoto, setInitialPhoto] = useState<Blob | undefined>();
  const sidebar = useSidebarResize();
  const panelPresence = usePresence(panel);
  const visiblePanel = panelPresence.value;
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('jorata-appearance-v3') || 'dark'; } catch { return 'dark'; } });
  const photoContext = useRef<{ roomId: string; replyTo: string | null; onSent: () => void } | null>(null);
  const listRef = useRef<HTMLElement>(null);
  const listScroll = useRef(0);
  const room = social.rooms.find(r => r.id === social.selected);
  const membership = room?.kind === 'channel' ? social.communityMembers.filter(m => m.community_id === room.community_id) : social.members.filter(m => m.room_id === room?.id);
  const memberProfiles = membership.map(m => social.profiles.find(p => p.id === m.user_id)).filter((p): p is Profile => !!p);
  const role = membership.find(m => m.user_id === profile.id)?.role;
  const admin = role === 'owner' || role === 'admin';
  const basePath = location.pathname === '/accounts' ? '/accounts' : '/';
  const unreadTotal = Object.values(social.unreadCounts).reduce((sum, count) => sum + count, 0);
  const filteredRooms = social.rooms.filter(r => {
    const summary = social.conversationSummaries[r.id];
    return `${roomName(r, social, profile.id)} ${summary?.deleted ? '' : summary?.body || ''}`.toLowerCase().includes(search.trim().toLowerCase()) && (filter === 'all' || (filter === 'groups' ? r.kind !== 'direct' : !!social.unreadCounts[r.id]));
  }).sort((a, b) => (social.conversationSummaries[b.id]?.createdAt || b.updated_at).localeCompare(social.conversationSummaries[a.id]?.createdAt || a.updated_at));

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.jorataTheme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme; };
    apply();
    try { localStorage.setItem('jorata-appearance-v3', theme); } catch { /* Storage is optional. */ }
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      if (viewport && viewport.scale === 1) {
        document.documentElement.style.setProperty('--social-viewport-height', `${viewport.height}px`);
        document.documentElement.style.setProperty('--social-viewport-top', `${viewport.offsetTop}px`);
      }
    };
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize);
    return () => { viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); };
  }, []);
  useEffect(() => {
    const open = () => { setWorld(false); setGames(false); };
    const back = () => { social.setSelected(null); setPanel(null); setWorld(false); setGames(false); };
    window.addEventListener('jorata-open-chat', open); window.addEventListener('popstate', back);
    return () => { window.removeEventListener('jorata-open-chat', open); window.removeEventListener('popstate', back); };
  }, [social.setSelected]);
  useEffect(() => { if (!room && listRef.current) listRef.current.scrollTop = listScroll.current; }, [room]);
  useEffect(() => {
    if (!panel) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanel(null); };
    document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close);
  }, [panel]);

  async function run(operation: () => Promise<unknown>) {
    social.setError('');
    try { return await operation(); } catch (e) { social.setError((e as Error).message); }
  }
  function selectRoom(id: string) {
    listScroll.current = listRef.current?.scrollTop || 0;
    if (matchMedia('(max-width: 700px)').matches && !history.state?.jorataConversation) history.pushState({ jorataConversation: true }, '', basePath);
    social.setSelected(id); setPanel(null); setWorld(false); setGames(false);
  }
  function backToList() {
    if (history.state?.jorataConversation) history.back();
    else { social.setSelected(null); setPanel(null); }
  }
  async function sendPhoto(photo: Blob, replyTo: string | null = null, roomId = social.selected) {
    if (!roomId) throw new Error('Open a conversation first.');
    const path = guest ? await guest.upload(photo) : await uploadImage(photo, 'jr-media', `${roomId}/${profile.id}`);
    try { await social.mutate('send_message', { room_id: roomId, body: '', attachment_path: path, reply_to: replyTo }); }
    catch (e) { if (!guest) await db().storage.from('jr-media').remove([path]); throw e; }
  }
  async function summarize() {
    setBusy(true); setAiText('');
    try {
      const session = check(await db().auth.getSession()).session;
      const response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ room_id: room?.id, consent: true }), signal: AbortSignal.timeout(30000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Summary unavailable.'); setAiText(data.text);
    } catch (e) { setAiText((e as Error).message); } finally { setBusy(false); }
  }
  function showMessages() { setWorld(false); setGames(false); history.replaceState(history.state, '', basePath); }

  function openTool(tool: 'tasks' | 'photo') {
    const target = room || social.rooms[0];
    if (!target) { setDialog('new'); return; }
    selectRoom(target.id);
    if (tool === 'tasks') setPanel('tasks');
    else { photoContext.current = { roomId: target.id, replyTo: null, onSent: () => {} }; setInitialPhoto(undefined); setDialog('photo'); }
  }

  return <div className={`social-app ${room ? 'has-room' : ''} ${games || world ? 'has-secondary' : ''} ${sidebar.resizing ? 'is-resizing' : ''}`} style={{ '--sidebar-width': `${sidebar.width}px` } as CSSProperties}>
    <div className="social-workspace-body">
      <nav className="jorata-rail" aria-label="Main navigation">
        <button className="jorata-rail-brand" aria-label="Jorata home" onClick={() => { showMessages(); social.setSelected(null); }}><span className="social-brand-mark">j</span><span>jorata.</span></button>
        <div className="jorata-rail-links">
          <button aria-label="Chats" aria-current={!games && !world && filter !== 'groups' ? 'page' : undefined} onClick={() => { setFilter('all'); showMessages(); }}><ChatIcon /><span>Chats</span></button>
          <button aria-label="Groups" aria-current={!games && !world && filter === 'groups' ? 'page' : undefined} onClick={() => { setFilter('groups'); showMessages(); }}><UsersIcon /><span>Groups</span></button>
          <button aria-label="Moments" onClick={() => openTool('photo')}><CameraIcon /><span>Moments</span></button>
          <button aria-label="Tasks" onClick={() => openTool('tasks')}><TasksIcon /><span>Tasks</span></button>
          <button aria-label="Meadow" aria-current={games || world ? 'page' : undefined} onClick={() => { setGames(true); setWorld(false); setPanel(null); }}><WorldIcon /><span>Meadow</span></button>
        </div>
        <button aria-label="Jorata AI" className="jorata-ai-entry" onClick={() => { setAiText(''); setDialog('ai'); }}><span className="jorata-ai-symbol"><ChatIcon size={21} /></span><span>Jorata AI<small>Assistant</small></span></button>
        <div className="jorata-rail-account"><button className="social-profile-button" onClick={() => setDialog('settings')} aria-label="Your profile and settings" title={profile.display_name}>{avatar(profile, 32)}</button><button onClick={() => setDialog('settings')} aria-label="Settings"><SettingsIcon size={19} /></button></div>
      </nav>
      <aside className="social-sidebar" aria-label="Conversations">
        <header className="social-sidebar-header">
          <div className="social-brand-row">
            <button className="social-brand" onClick={showMessages} aria-label="Jorata messages"><span className="social-brand-mark">j</span><span>jorata<span className="social-brand-period">.</span></span></button>
            <button className="social-profile-button" onClick={() => setDialog('settings')} aria-label="Your profile and settings" title={profile.display_name}>{avatar(profile, 34)}</button>
          </div>
          <div className="social-inbox-heading"><h1>Chats</h1><button className="social-new-chat-btn social-icon-button" onClick={() => setDialog('new')} aria-label="New chat" title="New chat"><PlusIcon size={21} /></button></div>
          <div className="social-search-bar"><SearchIcon size={18} /><input aria-label="Search conversations" placeholder="Search chats and people" value={search} onChange={e => setSearch(e.target.value)} />{search && <button className="social-search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>}</div>
          <div className="social-list-tabs" aria-label="Conversation filters"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All chats</button><button aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>Unread{unreadTotal > 0 && <span>{unreadTotal > 99 ? '99+' : unreadTotal}</span>}</button><button aria-pressed={filter === 'groups'} onClick={() => setFilter('groups')}>Groups</button><button className="social-communities-link" title="Communities" aria-label="Discover communities" onClick={() => setDialog('communities')}><UsersIcon size={18} /></button></div>
        </header>
        <nav className="social-room-list" ref={listRef} aria-label="Conversation list">
          {social.indexLoading && !social.rooms.length && <div className="social-list-loading" role="status" aria-label="Loading conversations">{[0,1,2,3].map(n => <div className="social-room-skeleton" key={n}><i /><span><b /><b /></span></div>)}</div>}
          {filteredRooms.map(r => {
            const otherMember = r.kind === 'direct' ? social.members.find(m => m.room_id === r.id && m.user_id !== profile.id) : null;
            const otherProfile = social.profiles.find(p => p.id === otherMember?.user_id);
            const summary = social.conversationSummaries[r.id];
            const unread = social.unreadCounts[r.id] || 0;
            const sender = social.profiles.find(p => p.id === summary?.senderId);
            const preview = summary ? (summary.deleted ? 'Message deleted' : `${summary.attachment ? 'Photo' + (summary.body ? ' · ' : '') : ''}${summary.body}`) : 'No messages yet';
            return <button key={r.id} className={`social-room ${social.selected === r.id && !world && !games ? 'selected' : ''} ${unread ? 'unread' : ''}`} data-room-id={r.id} aria-current={social.selected === r.id && !world && !games ? 'true' : undefined} onClick={() => selectRoom(r.id)}>
              <span className="social-room-avatar-wrap">{otherProfile ? avatar(otherProfile, 38) : <span className={`social-room-icon ${r.kind}`}><UsersIcon size={19} /></span>}{otherProfile && social.online.includes(otherProfile.id) && <span className="social-online-dot" title="Online now" />}</span>
              <span className="social-room-info"><span className="social-room-row"><strong>{roomName(r, social, profile.id)}</strong>{summary && <time dateTime={summary.createdAt} className="social-room-time">{activityTime(summary.createdAt)}</time>}</span><span className="social-room-preview"><span>{summary && !summary.deleted && <span className="social-preview-sender">{summary.senderId === profile.id ? 'You: ' : r.kind !== 'direct' && sender ? `${sender.display_name.split(' ')[0]}: ` : ''}</span>}{preview}</span>{unread > 0 && <span className="social-unread-badge" aria-label={`${unread} unread messages`}>{unread > 99 ? '99+' : unread}</span>}</span></span>
            </button>;
          })}
          {!filteredRooms.length && !(social.indexLoading && !social.rooms.length) && <div className="social-empty-list"><span className="social-empty-icon">{search ? <SearchIcon size={24} /> : <ChatIcon size={24} />}</span><h3>{search ? 'No conversations found' : filter === 'unread' ? 'You’re all caught up' : 'Your conversations start here'}</h3><p>{search ? `No matches for “${search}”. Try a name or a recent message.` : filter === 'unread' ? 'New messages will appear here.' : 'Find someone you know, or bring a group together.'}</p>{search ? <button onClick={() => setSearch('')}>Clear search</button> : filter === 'all' && <button className="social-primary" onClick={() => setDialog('new')}>New chat</button>}</div>}
        </nav>
        <div className="social-sidebar-footer">
          <div className="social-connection-note"><span className={`social-connection-dot ${social.status === 'Live' || social.status === 'Browser demo' ? 'connected' : ''}`} /><span role="status">{social.status === 'Live' ? 'Connected' : social.status}</span>{guest && <button onClick={() => setDialog('settings')}>{guest.notice.startsWith('SAMPLE') ? 'Browser demo' : 'Guest workspace'}</button>}</div>
          <nav className="social-navigation" aria-label="Main navigation"><button aria-current={!games && !world ? 'page' : undefined} onClick={showMessages}><ChatIcon size={21} /><span>Chats</span></button><button aria-current={games || world ? 'page' : undefined} onClick={() => { setGames(true); setWorld(false); setPanel(null); }}><WorldIcon size={21} /><span>Games</span></button><button onClick={() => setDialog('settings')}><SettingsIcon size={21} /><span>Settings</span></button></nav>
        </div>
      </aside>

      <div className="social-sidebar-divider" role="separator" aria-label="Resize conversation sidebar" aria-orientation="vertical" aria-valuemin={250} aria-valuemax={420} aria-valuenow={sidebar.width} tabIndex={0} title="Drag to resize · Double-click to reset" {...sidebar.separator} />
      <main className="social-main" aria-label="Conversation" hidden={games || world}>
        <ChatConversation profile={profile} platform={social} guest={!!guest} active={!world && !games} panel={panel} onBack={backToList} onPanel={next => setPanel(panel === next ? null : next)} onSummarize={() => { setAiText(''); setDialog('ai'); }} onPhoto={(replyTo, onSent, initial) => { if (room) { setInitialPhoto(initial); photoContext.current = { roomId: room.id, replyTo, onSent }; setDialog('photo'); } }} />
        {!room && <section className="social-welcome"><div className="jorata-welcome-copy"><p className="jorata-greeting">{new Date().getHours() < 12 ? 'Good morning,' : new Date().getHours() < 18 ? 'Good afternoon,' : 'Good evening,'}</p><h2>{profile.display_name.split(' ')[0]}<span>.</span></h2><p>Pick up where you left off<br />with your conversations.</p><div className="social-actions"><button className="social-primary" onClick={() => setDialog('new')}><ChatIcon size={18} />New message</button><button onClick={() => setDialog('new')}><UsersIcon size={18} />New group</button></div></div></section>}
      </main>

      {games && <main className="social-games"><header className="social-section-heading"><button className="social-icon-button" onClick={showMessages} aria-label="Back to messages"><ChevronLeftIcon size={22} /></button><div><h1>Games</h1><p>A little time together.</p></div></header><section className="social-game-discovery"><span className="social-game-emblem"><WorldIcon size={48} /></span><div className="social-game-copy"><span className="social-eyebrow">YOUR SHARED WORLD</span><h2>The Meadow</h2><p>Meet your people somewhere a little different. Explore, build, and hang out together.</p><button className="social-primary" onClick={() => { setGames(false); setWorld(true); history.replaceState(history.state, '', '/world'); }}>Enter the Meadow <span aria-hidden="true">→</span></button><small>Move with WASD or the on-screen controls.</small></div></section></main>}
      {world && <main className="social-world-stage"><button className="social-world-back" onClick={showMessages}><ChevronLeftIcon size={18} />Back to messages</button><Suspense fallback={<div className="social-loading" role="status">Opening the Meadow…</div>}>{guest ? guest.world : <SocialWorld profile={profile} />}</Suspense></main>}
      {!world && !games && room && visiblePanel && <><button className="social-panel-backdrop" aria-label="Close side panel overlay" onClick={() => setPanel(null)} /><aside data-closing={panelPresence.closing} inert={panelPresence.closing} className="social-detail-panel" aria-label={visiblePanel === 'tasks' ? 'Shared tasks' : 'Conversation details'}><div className="social-panel-heading"><h2>{visiblePanel === 'tasks' ? 'Shared tasks' : 'Conversation details'}</h2><button className="social-icon-button" aria-label="Close side panel" onClick={() => setPanel(null)}>×</button></div>{visiblePanel === 'tasks' ? <TaskBoard key={room.id} tasks={social.tasks} members={memberProfiles} userId={profile.id} admin={admin} mutate={social.mutate} fail={social.setError} /> : <><MemberPanel key={room.id} social={social} room={room} profile={profile} memberProfiles={memberProfiles} admin={admin} run={run} />{room.kind !== 'direct' && room.owner_id !== profile.id && <button onClick={() => void run(async () => { await social.mutate('leave_room'); social.setSelected(null); })}>Leave {room.kind === 'channel' ? 'community' : 'group'}</button>}</>}</aside></>}
    </div>
    {social.error && <div className="social-alert" role="alert"><span>{social.error}</span><button aria-label="Dismiss error" onClick={() => social.setError('')}>×</button></div>}
    {dialog === 'settings' && <Modal title="Settings" close={() => setDialog(null)}><div className="social-settings-profile">{avatar(profile, 56)}<div><h3>{profile.display_name}</h3><p>@{profile.username}</p></div></div><div className="social-settings-section"><h3>Appearance</h3><div className="social-theme-options">{['light','dark','system'].map(value => <button key={value} aria-pressed={theme === value} onClick={() => setTheme(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div></div><div className="social-settings-section"><h3>{guest ? 'Guest profile' : 'Account'}</h3>{guest ? <div className="social-guest-controls" onClick={e => { if ((e.target as HTMLElement).closest('button')?.textContent === 'Edit guest') setDialog(null); }}>{guest.controls}</div> : <><button onClick={() => setDialog('profile')}>Edit profile</button><button onClick={() => void run(async () => { check(await db().auth.signOut()); })}>Sign out</button></>}</div>{guest && <p className="social-settings-notice">{guest.notice}</p>}<p className="social-settings-caption">Jorata · A little closer, together.</p></Modal>}
    {!guest && dialog === 'profile' && <Suspense fallback={<div className="social-loading">Opening profile…</div>}><ProfileEditor profile={profile} onSaved={async () => { await refreshProfile(); await social.refresh(); }} onClose={() => setDialog(null)} /></Suspense>}
    {dialog === 'new' && <NewConversation social={social} profile={profile} close={() => setDialog(null)} select={id => { selectRoom(id); setDialog(null); }} />}
    {dialog === 'communities' && <CommunityDirectory social={social} profile={profile} close={() => setDialog(null)} select={id => { selectRoom(id); setDialog(null); }} />}
    {dialog === 'photo' && <PhotoEditor initialPhoto={initialPhoto} close={() => { setDialog(null); setInitialPhoto(undefined); }} send={async photo => { const context = photoContext.current; await sendPhoto(photo, context?.replyTo || null, context?.roomId); context?.onSent(); }} />}
    {dialog === 'ai' && <Modal title="Jorata AI" close={() => setDialog(null)}>{guest ? <><div className="jorata-ai-intro"><ChatIcon size={28} /><h3>A little help, when you need it.</h3></div><p>Summarize conversations, find the important details, and make room for what comes next.</p><p className="social-settings-notice">AI is available with a connected account. Temporary guests can keep chatting here; their messages are not sent to an AI provider.</p><button onClick={() => setDialog(null)}>Back to conversations</button></> : <><p>On your request, up to 80 recent messages from the selected conversation will be sent to Google Gemini to produce a summary. Photos are excluded.</p><button className="social-primary" disabled={busy || !room} onClick={summarize}>{busy ? 'Summarizing…' : room ? 'Send messages to Gemini and summarize' : 'Select a conversation first'}</button>{aiText && <p className="social-ai-result" role="status">{aiText}</p>}</>}</Modal>}
  </div>;
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
  const [searched, setSearched] = useState(false);
  const [finding, setFinding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function find(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFinding(true);
    try {
      setFound(await social.searchProfiles(query));
      setSearched(true);
    } catch (e) {
      setError((e as Error).message);
    } finally { setFinding(false); }
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
        <button disabled={busy || finding}>{finding ? 'Finding people…' : 'Find people'}</button>
      </form>
      <div className="social-search-results">
        {searched && !finding && found.filter(p => p.id !== profile.id).length === 0 && <p className="social-muted" role="status">No people found. Try another name or username.</p>}
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
  const [reporting, setReporting] = useState<Profile | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const isOwner =
    room.kind === 'channel'
      ? social.communities.find(c => c.id === room.community_id)?.owner_id === profile.id
      : room.owner_id === profile.id;

  return (
    <section className="social-member-panel">
      {reporting && <Modal title={`Report ${reporting.display_name}`} close={() => setReporting(null)}><form onSubmit={e => {
        e.preventDefault(); if (reportBusy) return; setReportBusy(true);
        void run(async () => { await social.mutate('report', { user_id: reporting.id, reason: reportReason }); setReporting(null); }).finally(() => setReportBusy(false));
      }}><p className="social-muted">Tell us why you’re reporting this person.</p><label>Reason<textarea required minLength={3} maxLength={1000} rows={4} value={reportReason} onChange={e => setReportReason(e.target.value)} /></label><button className="social-primary" disabled={reportBusy || reportReason.trim().length < 3}>{reportBusy ? 'Submitting…' : 'Submit report'}</button></form></Modal>}
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
                      setReporting(p); setReportReason('');
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
