import { useEffect, useRef, useState } from "react";
import { GameCanvas } from "../components/GameCanvas";
import { GameModel } from "../game/model";
import {
  MATERIALS,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  REACH,
  SPAWN,
  overlaps,
  tileAt,
  type Player,
} from "../../shared/game";
import type { Profile } from "../social/types";
import { useGuestTransport } from "./GuestApp";
export default function GuestWorld({
  profile,
  profiles,
  tiles,
  openDM,
}: {
  profile: Profile;
  profiles: Profile[];
  tiles: Record<string, number>;
  openDM: (uid: string) => Promise<void>;
}) {
  const transport = useGuestTransport(),
    [model] = useState(() => new GameModel()),
    [players, setPlayers] = useState<Player[]>([]),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [selected, setSelected] = useState(4),
    [remove, setRemove] = useState(false),
    [status, setStatus] = useState("Connecting"),
    [moment, setMoment] = useState("");
  const known = useRef(profiles),
    pendingBubbles = useRef<string[]>([]);
  known.current = profiles;
  useEffect(() => {
    for (const [key, tile] of Object.entries(tiles)) {
      const [x, y] = key.split(",").map(Number);
      model.world.tiles[y * model.world.width + x] = tile;
    }
    model.world.revision++;
  }, [model, tiles]);
  useEffect(() => {
    model.id = profile.id;
    model.connected = true;
    model.local = {
      id: profile.id,
      username: profile.display_name,
      color: `hsl(${parseInt(profile.id.slice(0, 6), 16) % 360} 48% 70%)`,
      ...SPAWN,
      vx: 0,
      vy: 0,
      grounded: false,
      facing: 1,
    };
    const peers = new Map<string, { player: Player; at: number }>();
    const off = transport.onSignal((e) => {
      if (e.uid === profile.id) return;
      if (e.type === "world-leave") {
        peers.delete(e.uid);
        return;
      }
      if (e.type !== "world" || !e.player) return;
      const p = known.current.find((p) => p.id === e.uid),
        v = e.player;
      if (
        !p ||
        ![v.x, v.y, v.vx, v.vy].every(
          (n) => typeof n === "number" && Number.isFinite(n),
        )
      )
        return;
      const player: Player = {
        id: p.id,
        username: p.display_name,
        color: `hsl(${parseInt(p.id.slice(0, 6), 16) % 360} 48% 70%)`,
        x: Number(v.x),
        y: Number(v.y),
        vx: Number(v.vx),
        vy: Number(v.vy),
        grounded: v.grounded === true,
        facing: v.facing === -1 ? -1 : 1,
      };
      peers.set(p.id, { player, at: Date.now() });
      if (e.bubble) {
        model.addBubble(p.display_name, e.bubble);
        setMoment(`${p.display_name}: ${e.bubble}`);
      }
    });
    const offStatus = transport.onStatus((s) => {
      setStatus(s);
      model.connected = s === "Live" || s === "Browser demo";
    });
    const timer = setInterval(() => {
      if (!model.local) return;
      if (model.local.y > 40)
        Object.assign(model.local, SPAWN, { vx: 0, vy: 0 });
      for (const [id, p] of peers)
        if (Date.now() - p.at > 6500) peers.delete(id);
      model.sync([
        { ...model.local },
        ...[...peers.values()].map((p) => p.player),
      ]);
      setPlayers([...model.players]);
      transport.signal({
        type: "world",
        player: {
          x: model.local.x,
          y: model.local.y,
          vx: model.local.vx,
          vy: model.local.vy,
          grounded: model.local.grounded,
          facing: model.local.facing,
        },
        bubble: pendingBubbles.current.shift() || "",
      });
    }, 100);
    return () => {
      off();
      offStatus();
      clearInterval(timer);
      model.connected = false;
      transport.signal({ type: "world-leave" });
    };
  }, [transport, model, profile.id, profile.display_name]);
  function say(value: string) {
    const bubble = value.trim().slice(0, 120);
    if (!bubble) return;
    model.addBubble(profile.display_name, bubble);
    pendingBubbles.current.push(bubble);
    pendingBubbles.current = pendingBubbles.current.slice(-5);
    setMoment(`${profile.display_name}: ${bubble}`);
    setText("");
  }
  function select(id: number) {
    model.selected = id;
    model.mode = "place";
    setSelected(id);
    setRemove(false);
  }
  function toggle() {
    setRemove((v) => !v);
    model.mode = model.mode === "place" ? "remove" : "place";
  }
  async function edit(x: number, y: number, right: boolean) {
    const p = model.local;
    if (!p) return;
    const tile = right || model.mode === "remove" ? 0 : model.selected;
    if (
      Math.hypot(
        x + 0.5 - p.x - PLAYER_WIDTH / 2,
        y + 0.5 - p.y - PLAYER_HEIGHT / 2,
      ) > REACH
    ) {
      setError("Move closer to that block.");
      return;
    }
    if (tile && players.some((p) => overlaps(x, y, p))) return;
    if (
      (tile === 0 && tileAt(model.world, x, y) === 0) ||
      (tile && tileAt(model.world, x, y) !== 0)
    )
      return;
    try {
      await transport.mutate("world_edit", { x, y, tile });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section
      className="social-managed-world"
      aria-label="The Meadow social world"
    >
      <GameCanvas
        model={model}
        sendInput={() => {}}
        edit={(x, y, right) => void edit(x, y, right)}
        select={select}
        onToggleMode={toggle}
        onInspectPlayer={(p) => {
          if (p.id !== profile.id)
            void openDM(p.id).catch((e) => setError(e.message));
        }}
      />
      <div className="social-world-info">
        <strong>The Meadow · guest space</strong>
        <span role="status">
          {status} · {players.length} here
        </span>
        <p data-testid="world-players">
          {players.map((p) => p.username).join(" · ")}
        </p>
        <p>
          A/D or arrows to move · W/Space to jump · Click to build · Right click
          to remove
        </p>
        <p>Click a nearby player to open a conversation.</p>
        <p role="status" aria-label="Latest Meadow moment">
          {moment}
        </p>
      </div>
      <div className="social-world-tools">
        {MATERIALS.map((m) => (
          <button
            key={m.id}
            onClick={() => select(m.id)}
            aria-pressed={selected === m.id && !remove}
          >
            {m.name}
          </button>
        ))}
        <button onClick={toggle} aria-pressed={remove}>
          Remove
        </button>
        <button
          onClick={() => {
            if (model.local)
              Object.assign(model.local, SPAWN, { vx: 0, vy: 0 });
          }}
        >
          Return to spawn
        </button>
        <div className="guest-emotes">
          {["👋", "❤️", "🎉", "😂"].map((e) => (
            <button key={e} aria-label={`Emote ${e}`} onClick={() => say(e)}>
              {e}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            say(text);
          }}
        >
          <input
            aria-label="Meadow message"
            placeholder="Say hello nearby…"
            maxLength={120}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button>Say</button>
        </form>
        {players
          .filter(
            (p) =>
              p.id !== profile.id &&
              model.local &&
              Math.hypot(p.x - model.local.x, p.y - model.local.y) < 8,
          )
          .map((p) => (
            <button
              key={p.id}
              onClick={() =>
                void openDM(p.id).catch((e) => setError(e.message))
              }
            >
              Chat with {p.username}
            </button>
          ))}
      </div>
      {error && (
        <p role="alert" className="social-world-error">
          {error}
        </p>
      )}
    </section>
  );
}
