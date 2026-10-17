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
import { useGame } from './useGame';
import { sounds } from './game/audio';

export function App() {
  const game = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [selected, setSelected] = useState(4); // Default to Timber
  const [mode, updateMode] = useState<'place' | 'remove'>('place');

  // Modal states
  const [inspectedPlayer, setInspectedPlayer] = useState<Player | null>(null);
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showEmotes, setShowEmotes] = useState(false);

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

  // Global ESC key listener to close modals
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isSnapshotOpen) setIsSnapshotOpen(false);
        else if (inspectedPlayer) setInspectedPlayer(null);
        else if (isHelpOpen) setIsHelpOpen(false);
        else if (showEmotes) setShowEmotes(false);
        document.getElementById('game-canvas')?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSnapshotOpen, inspectedPlayer, isHelpOpen, showEmotes]);

  const me = game.players.find(player => player.id === game.model.id);

  function handleMention(username: string) {
    window.dispatchEvent(new CustomEvent('jorata-open-chat', { detail: { text: `@${username} ` } }));
  }

  return (
    <div className="game-viewport-container">
      {/* 1. Edge-to-Edge 2D Game Canvas */}
      <GameCanvas
        model={game.model}
        sendInput={game.sendInput}
        edit={game.edit}
        select={select}
        onInspectPlayer={player => setInspectedPlayer(player)}
        onToggleEmotes={() => setShowEmotes(prev => !prev)}
        onSnapshot={() => setIsSnapshotOpen(true)}
        onToggleMode={() => setMode(game.model.mode === 'remove' ? 'place' : 'remove')}
        canvasRef={canvasRef}
      />

      {/* 2. Floating Tactile HUD Layer */}
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
          onOpenSnapshot={() => setIsSnapshotOpen(true)}
          onOpenHelp={() => setIsHelpOpen(true)}
          onSendChat={game.chat}
          showEmotes={showEmotes}
          setShowEmotes={setShowEmotes}
        />
      )}

      {/* 3. Floating Collapsible Social Center */}
      {game.joined && (
        <ChatPanel
          messages={game.messages}
          players={game.players}
          connected={game.status === 'Live'}
          send={game.chat}
          localPlayer={me || null}
          onInspectPlayer={player => setInspectedPlayer(player)}
        />
      )}

      {/* 4. Touch Controls for Mobile Devices */}
      {game.joined && <TouchControls />}

      {/* 5. Modals & Overlays */}
      {!game.joined && <JoinScreen join={game.join} status={game.status} />}

      {isSnapshotOpen && (
        <SnapshotModal
          canvas={canvasRef.current}
          username={me?.username || 'Explorer'}
          playerX={me?.x || 12}
          playerY={me?.y || 25}
          onClose={() => setIsSnapshotOpen(false)}
        />
      )}

      {inspectedPlayer && (
        <PlayerProfileModal
          player={inspectedPlayer}
          localPlayer={me || null}
          onClose={() => setInspectedPlayer(null)}
          onSendChat={game.chat}
          onMention={handleMention}
        />
      )}

      {isHelpOpen && <ControlsHelpModal onClose={() => setIsHelpOpen(false)} />}

      {/* 6. Notifications & Reconnect Banners */}
      {game.notice && (
        <div className="toast-notification" role="alert">
          <span className="toast-icon">ℹ</span>
          <span>{game.notice}</span>
        </div>
      )}

      {game.joined && game.status !== 'Live' && (
        <div className="reconnect-banner" role="alert">
          <span className="reconnect-spinner">⏳</span>
          <span>Reconnecting to the meadow… Your world will refresh once reconnected.</span>
        </div>
      )}
    </div>
  );
}
