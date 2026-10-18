import { useEffect, useRef, useState } from 'react';
import type { Player } from '../shared/game';
import { GameCanvas } from './components/GameCanvas';
import { ChatPanel } from './components/ChatPanel';
import { JoinScreen } from './components/JoinScreen';
import { GameHUD } from './components/GameHUD';
import { TouchControls } from './components/BuildToolbar';
import { SnapshotModal } from './components/SnapshotModal';
import { PlayerProfileModal } from './components/PlayerProfileModal';
import { ControlsHelpModal } from './components/ControlsHelpModal';
import { NavigationRail } from './components/NavigationRail';
import { CommunitySidebar } from './components/CommunitySidebar';
import { TaskBoard } from './components/TaskBoard';
import { CameraStudioModal } from './components/CameraStudioModal';
import { MobileTabBar } from './components/MobileTabBar';
import { taskStore } from './game/taskStore';
import { useGame } from './useGame';

export function App() {
  const game = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // App View Modes: 'split' | 'world' | 'chat' | 'tasks' | 'camera'
  const [activeView, setActiveView] = useState<'split' | 'world' | 'chat' | 'tasks' | 'camera'>('split');
  const [activeChannel, setActiveChannel] = useState('general');

  // Building tools
  const [selected, setSelected] = useState(4); // Default: Timber
  const [mode, updateMode] = useState<'place' | 'remove'>('place');

  // Modals & Overlays
  const [inspectedPlayer, setInspectedPlayer] = useState<Player | null>(null);
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCameraStudioOpen, setIsCameraStudioOpen] = useState(false);
  const [showEmotes, setShowEmotes] = useState(false);

  // Unread & Tasks counts
  const [unreadCount, setUnreadCount] = useState(0);
  const [openTasksCount, setOpenTasksCount] = useState(() => {
    return taskStore.getTasks().filter(t => !t.completed).length;
  });

  useEffect(() => {
    return taskStore.subscribe(tasks => {
      setOpenTasksCount(tasks.filter(t => !t.completed).length);
    });
  }, []);

  function select(id: number) {
    setSelected(id);
    updateMode('place');
    game.model.selected = id;
    game.model.mode = 'place';
  }

  function setMode(value: 'place' | 'remove') {
    updateMode(value);
    game.model.mode = value;
  }

  useEffect(() => {
    if (game.joined) {
      document.getElementById('game-canvas')?.focus();
    }
  }, [game.joined]);

  // Global ESC key listener to close active overlays
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isCameraStudioOpen) setIsCameraStudioOpen(false);
        else if (isSnapshotOpen) setIsSnapshotOpen(false);
        else if (inspectedPlayer) setInspectedPlayer(null);
        else if (isHelpOpen) setIsHelpOpen(false);
        else if (showEmotes) setShowEmotes(false);
        document.getElementById('game-canvas')?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCameraStudioOpen, isSnapshotOpen, inspectedPlayer, isHelpOpen, showEmotes]);

  const me = game.players.find(player => player.id === game.model.id);

  function handleMention(username: string) {
    const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;
    if (chatInput) {
      chatInput.value = `@${username} `;
      chatInput.focus();
    }
  }

  function handleShareToChat(text: string, mediaUrl?: string) {
    if (mediaUrl) {
      game.chat(`${text} [Attachment: Snap]`);
    } else {
      game.chat(text);
    }
  }

  return (
    <div className={`jorata-app-shell view-${activeView}`}>
      {/* 1. Global Navigation Rail (Desktop) */}
      {game.joined && (
        <NavigationRail
          activeView={activeView}
          setActiveView={view => {
            if (view === 'camera') setIsCameraStudioOpen(true);
            else setActiveView(view);
          }}
          unreadChatCount={unreadCount}
          openTasksCount={openTasksCount}
          me={me}
          onOpenProfile={() => me && setInspectedPlayer(me)}
          onOpenHelp={() => setIsHelpOpen(true)}
        />
      )}

      {/* 2. Main Work Area */}
      <main className="app-workspace-layout">
        {/* Community & Channels Sidebar (Visible in Split, Chat, Tasks) */}
        {game.joined && (activeView === 'split' || activeView === 'chat' || activeView === 'tasks') && (
          <CommunitySidebar
            activeChannel={activeChannel}
            setActiveChannel={ch => {
              setActiveChannel(ch);
              if (ch === 'tasks') setActiveView('tasks');
              else if (ch === 'world') setActiveView('world');
              else if (activeView === 'tasks') setActiveView('split');
            }}
            players={game.players}
            me={me}
            onInspectPlayer={p => setInspectedPlayer(p)}
            onOpenTasks={() => setActiveView('tasks')}
            onOpenWorld={() => setActiveView('world')}
            unreadCount={unreadCount}
            openTasksCount={openTasksCount}
          />
        )}

        {/* Center Panel: Chat or Tasks */}
        {game.joined && (activeView === 'split' || activeView === 'chat') && (
          <section className="center-messaging-pane" aria-label="Messaging pane">
            <ChatPanel
              messages={game.messages}
              players={game.players}
              connected={game.status === 'Live'}
              send={game.chat}
              localPlayer={me || null}
              onInspectPlayer={p => setInspectedPlayer(p)}
              onOpenSnapStudio={() => setIsCameraStudioOpen(true)}
              channelName={activeChannel}
              isCompactMode={activeView === 'split'}
            />
          </section>
        )}

        {/* Task Board (When Tasks view active) */}
        {game.joined && activeView === 'tasks' && (
          <section className="center-tasks-pane" aria-label="Tasks pane">
            <TaskBoard
              me={me}
              onShareToChat={handleShareToChat}
              onClose={() => setActiveView('split')}
            />
          </section>
        )}

        {/* Right / Sandbox World Stage */}
        <section
          className={`game-world-stage ${activeView === 'world' ? 'stage-fullscreen' : ''} ${activeView === 'chat' || activeView === 'tasks' ? 'stage-hidden-mobile' : ''}`}
          aria-label="Meadow Sandbox Game"
        >
          <GameCanvas
            model={game.model}
            sendInput={game.sendInput}
            edit={game.edit}
            select={select}
            onInspectPlayer={player => setInspectedPlayer(player)}
            onToggleEmotes={() => setShowEmotes(prev => !prev)}
            onSnapshot={() => setIsSnapshotOpen(true)}
            onToggleMode={() => setMode(mode === 'remove' ? 'place' : 'remove')}
            canvasRef={canvasRef}
          />

          {/* Floating HUD over canvas */}
          {game.joined && (
            <GameHUD
              status={game.status}
              revision={game.revision}
              players={game.players}
              me={me}
              selected={selected}
              mode={mode}
              select={select}
              setMode={setMode}
              onRespawn={() => {
                game.respawn();
                document.getElementById('game-canvas')?.focus();
              }}
              onOpenSnapshot={() => setIsCameraStudioOpen(true)}
              onOpenHelp={() => setIsHelpOpen(true)}
              onSendChat={game.chat}
              showEmotes={showEmotes}
              setShowEmotes={setShowEmotes}
            />
          )}

          {/* Touch Controls on mobile inside world stage */}
          {game.joined && <TouchControls />}
        </section>
      </main>

      {/* 3. Mobile Bottom Tab Bar */}
      {game.joined && (
        <MobileTabBar
          activeView={activeView}
          setActiveView={view => {
            if (view === 'camera') setIsCameraStudioOpen(true);
            else setActiveView(view);
          }}
          unreadChatCount={unreadCount}
          openTasksCount={openTasksCount}
        />
      )}

      {/* 4. Modals & Overlays */}
      {!game.joined && <JoinScreen join={game.join} status={game.status} />}

      {/* Camera Studio Modal */}
      {isCameraStudioOpen && (
        <CameraStudioModal
          canvas={canvasRef.current}
          username={me?.username || 'Explorer'}
          onSendToChat={handleShareToChat}
          onClose={() => setIsCameraStudioOpen(false)}
        />
      )}

      {/* Polaroid Snap Quick Preview */}
      {isSnapshotOpen && (
        <SnapshotModal
          canvas={canvasRef.current}
          username={me?.username || 'Explorer'}
          playerX={me?.x || 12}
          playerY={me?.y || 25}
          onClose={() => setIsSnapshotOpen(false)}
        />
      )}

      {/* Explorer Passport Modal */}
      {inspectedPlayer && (
        <PlayerProfileModal
          player={inspectedPlayer}
          localPlayer={me || null}
          onClose={() => setInspectedPlayer(null)}
          onSendChat={game.chat}
          onMention={handleMention}
        />
      )}

      {/* Controls Field Guide */}
      {isHelpOpen && <ControlsHelpModal onClose={() => setIsHelpOpen(false)} />}

      {/* Reconnect Banner */}
      {game.joined && game.status !== 'Live' && (
        <div className="reconnect-banner" role="alert">
          <span className="reconnect-spinner">⏳</span>
          <span>Reconnecting to the meadow… Your world will refresh once reconnected.</span>
        </div>
      )}

      {/* Toast Notice */}
      {game.notice && (
        <div className="toast-notification" role="alert">
          <span className="toast-icon">ℹ</span>
          <span>{game.notice}</span>
        </div>
      )}
    </div>
  );
}
