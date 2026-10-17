import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Workspace } from "../social/SocialApp";
import { MediaResolver } from "../social/PrivateImage";
import { prepareImage } from "../social/media";
import {
  connectGuests,
  forgetIdentity,
  savedIdentities,
  switchIdentity,
  type GuestTransport,
  type LiveSnapshot,
} from "./transport";
import type { useSocial } from "../social/useSocial";
import GuestWorld from "./GuestWorld";
const Context = createContext<GuestTransport | null>(null);
export function useGuestTransport() {
  const value = useContext(Context);
  if (!value) throw new Error("Guest transport unavailable.");
  return value;
}
const directImage = async (path: string) => path;
export function GuestApp() {
  const [transport, setTransport] = useState<GuestTransport | null>(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true,
      connection: GuestTransport | undefined;
    void connectGuests()
      .then((t) => {
        connection = t;
        if (alive) setTransport(t);
        else t.close();
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
      connection?.close();
    };
  }, [version]);
  function restart() {
    setTransport(null);
    setVersion((v) => v + 1);
  }
  if (error)
    return (
      <main className="social-loading">
        <h1>JORATA</h1>
        <p role="alert">{error}</p>
        <button
          onClick={() => {
            setError("");
            forgetIdentity(import.meta.env.DEV ? "development" : "demo");
            restart();
          }}
        >
          Create a fresh test identity
        </button>
      </main>
    );
  if (!transport)
    return (
      <main className="social-loading" role="status">
        Opening JORATA workspace…
      </main>
    );
  return (
    <Context.Provider value={transport}>
      <MediaResolver.Provider value={directImage}>
        <GuestWorkspace key={transport.id} restart={restart} />
      </MediaResolver.Provider>
    </Context.Provider>
  );
}
function GuestWorkspace({ restart }: { restart: () => void }) {
  const transport = useGuestTransport(),
    [data, setData] = useState<LiveSnapshot | null>(null),
    [selected, setSelected] = useState<string | null>("guest-lobby"),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Connecting"),
    [typingAt, setTypingAt] = useState<
      Record<string, { room: string; at: number }>
    >({});
  const [now, setNow] = useState(Date.now()),
    [name, setName] = useState(""),
    [bio, setBio] = useState(""),
    [profileOpen, setProfileOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const selectedRef = useRef(selected),
    lastTyping = useRef(0);
  selectedRef.current = selected;
  useEffect(() => {
    const off = transport.subscribe(setData),
      offStatus = transport.onStatus(setStatus),
      offSignal = transport.onSignal((e) => {
        if (e.type === "typing" && e.uid !== transport.id && e.room_id)
          setTypingAt((v) => ({
            ...v,
            [e.uid]: { room: e.room_id!, at: Date.now() },
          }));
      });
    const timer = setInterval(() => setNow(Date.now()), 800);
    const refresh = () => void transport.refresh();
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      off();
      offStatus();
      offSignal();
      clearInterval(timer);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [transport]);
  useEffect(() => {
    lastTyping.current = 0;
  }, [selected]);
  useEffect(() => {
    if (data && selected && !data.rooms.some((r) => r.id === selected))
      setSelected(null);
  }, [data, selected]);
  const mutate = useCallback(
    (action: string, payload: Record<string, unknown> = {}) =>
      transport.mutate(action, { room_id: selectedRef.current, ...payload }),
    [transport],
  );
  if (!data)
    return (
      <main className="social-loading">
        <p role="status">{status} · Loading temporary workspace…</p>
        <button
          onClick={() => {
            forgetIdentity(transport.mode);
            restart();
          }}
        >
          New guest identity
        </button>
      </main>
    );
  const profile = data.profiles.find((p) => p.id === transport.id)!;
  const social: ReturnType<typeof useSocial> = {
    profiles: data.profiles,
    rooms: [...data.rooms].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    ),
    members: data.members,
    communities: data.communities,
    communityMembers: data.communityMembers,
    blocks: data.blocks,
    selected,
    setSelected,
    messages: data.messages.filter((m) => m.room_id === selected),
    reactions: data.reactions,
    tasks: data.tasks.filter((t) => t.room_id === selected),
    online: data.online,
    typing: Object.entries(typingAt)
      .filter(
        ([uid, v]) =>
          uid !== transport.id && v.room === selected && now - v.at < 3500,
      )
      .map(([uid]) => uid),
    status,
    error,
    setError,
    loading: false,
    mutate,
    refresh: transport.refresh,
    searchProfiles: async (query: string) =>
      data.profiles
        .filter((p) =>
          `${p.username} ${p.display_name}`
            .toLowerCase()
            .includes(query.toLowerCase().trim()),
        )
        .slice(0, 30),
    sendTyping: () => {
      if (selected && Date.now() - lastTyping.current > 1000) {
        lastTyping.current = Date.now();
        transport.signal({ type: "typing", room_id: selected });
      }
    },
    loadOlder: async () => {},
  };
  async function photo(blob: Blob) {
    const encoded = await prepareImage(blob);
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read photo."));
      reader.readAsDataURL(encoded);
    });
  }
  const controls = (
    <>
      <button
        onClick={() => {
          setName(profile.display_name);
          setBio(profile.bio);
          setProfileOpen(true);
        }}
      >
        Edit guest
      </button>
      <label className="guest-switch">
        <span className="sr-only">Switch test identity</span>
        <select
          aria-label="Switch test identity"
          value={transport.id}
          onChange={(e) => {
            switchIdentity(transport.mode, e.target.value);
            restart();
          }}
        >
          {savedIdentities(transport.mode).map((s) => (
            <option key={s.id} value={s.id}>
              {data.profiles.find((p) => p.id === s.id)?.display_name ||
                s.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={() => {
          forgetIdentity(transport.mode);
          restart();
        }}
      >
        New guest
      </button>
    </>
  );
  return (
    <>
      <Workspace
        profile={profile}
        refreshProfile={transport.refresh}
        platform={social}
        guest={{
          controls,
          edit: () => {
            setName(profile.display_name);
            setBio(profile.bio);
            setProfileOpen(true);
          },
          upload: photo,
          world: (
            <GuestWorld
              profile={profile}
              profiles={data.profiles}
              tiles={data.tiles}
              openDM={async (uid) => {
                const result = await mutate("open_dm", { user_id: uid });
                if (result.id) {
                  setSelected(result.id);
                  history.replaceState({}, "", "/");
                  window.dispatchEvent(new Event("jorata-open-chat"));
                }
              }}
            />
          ),
          notice:
            transport.mode === "development"
              ? "LOCAL DEVELOPMENT · Temporary guests and test data on this Codespace. Keep port 3000 private."
              : "SAMPLE DEMO · Stored only in this browser. Open a second tab to test. Same-browser tabs only; use sample content, not private information.",
        }}
      />
      {profileOpen && (
        <div
          className="social-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Temporary profile"
        >
          <section className="social-dialog">
            <h2>Temporary profile</h2>
            <p>
              Your username is @{profile.username}. This is a test identity, not
              a verified account.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await mutate("profile_update", { display_name: name, bio });
                  setProfileOpen(false);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Display name
                <input
                  required
                  minLength={2}
                  maxLength={32}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                About
                <input
                  maxLength={160}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </label>
              <button disabled={busy}>Save profile</button>
              <button type="button" onClick={() => setProfileOpen(false)}>
                Cancel
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
