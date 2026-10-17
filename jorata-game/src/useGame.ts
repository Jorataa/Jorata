import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { type ClientEvents, type Input, type Message, type Player, type ServerEvents } from '../shared/game';
import { GameModel } from './game/model';
import { sounds } from './game/audio';
import { particles } from './game/particles';

const TILE_COLORS: Record<number, string> = {
  1: '#a57a53',
  2: '#649466',
  3: '#777f7c',
  4: '#b57c50',
  5: '#6f9e73',
  6: '#d58167',
  7: '#91d5cd',
  8: '#445758',
};

export function useGame() {
  const [model] = useState(() => new GameModel());
  const socket = useRef<Socket<ServerEvents, ClientEvents> | null>(null);
  const usernameRef = useRef('');
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState('Not connected');
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function notify(message: string) {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 4500);
  }

  function join(username: string) {
    usernameRef.current = username;
    try {
      localStorage.setItem('jorata-username', username);
    } catch {
      /* Storage is optional for guests. */
    }
    if (socket.current) {
      socket.current.emit('join', username);
      return;
    }
    setStatus('Connecting');
    const connection: Socket<ServerEvents, ClientEvents> = io({ autoConnect: false });
    socket.current = connection;
    connection.on('connect', () => {
      setStatus('Joining');
      connection.emit('join', usernameRef.current);
    });
    connection.on('welcome', data => {
      model.id = data.id;
      model.world = data.world;
      model.local = null;
      model.input = { left: false, right: false, jump: false };
      model.sync(data.players);
      model.connected = true;
      setPlayers(data.players);
      setMessages(data.messages);
      setRevision(data.world.revision);
      setJoined(true);
      setStatus('Live');
    });
    connection.on('players', data => {
      model.sync(data);
      setPlayers(data);
    });
    connection.on('chat', message => {
      setMessages(current => [...current.slice(-79), message]);
      if (!message.system) {
        model.addBubble(message.username, message.text);
        sounds.playChatPop();
      }
    });
    connection.on('tile', edit => {
      const prevTile = model.world.tiles[edit.y * model.world.width + edit.x] ?? 0;
      model.world.tiles[edit.y * model.world.width + edit.x] = edit.tile;
      model.world.revision = edit.revision;
      setRevision(edit.revision);

      const px = edit.x * 32;
      const py = edit.y * 32;
      if (edit.tile === 0 && prevTile !== 0) {
        particles.addBreak(px, py, TILE_COLORS[prevTile] || '#b57c50');
        sounds.playBreak();
      } else if (edit.tile !== 0) {
        particles.addPlace(px, py, TILE_COLORS[edit.tile] || '#cee56f');
        sounds.playPlace(edit.tile);
      }
    });
    connection.on('notice', notify);
    connection.on('disconnect', () => {
      model.connected = false;
      model.input = { left: false, right: false, jump: false };
      setStatus('Reconnecting');
    });
    connection.on('connect_error', () => {
      model.connected = false;
      setStatus('Reconnecting');
      notify('Connection interrupted. Retrying automatically…');
    });
    connection.connect();
  }

  useEffect(() => () => {
    socket.current?.disconnect();
    clearTimeout(noticeTimer.current);
  }, []);

  function sendInput(input: Input) {
    if (model.connected) socket.current?.emit('input', input);
  }

  function edit(x: number, y: number, remove = false) {
    if (model.connected) {
      socket.current?.emit('edit', {
        x,
        y,
        tile: remove || model.mode === 'remove' ? 0 : model.selected,
      });
    }
  }

  return {
    model,
    joined,
    status,
    players,
    messages,
    notice,
    revision,
    join,
    sendInput,
    edit,
    chat: (text: string) => {
      if (model.connected) socket.current?.emit('chat', text);
    },
    respawn: () => {
      if (model.connected) socket.current?.emit('respawn');
    },
  };
}
