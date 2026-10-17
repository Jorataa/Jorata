import { useState, type FormEvent } from 'react';
import { sounds } from '../game/audio';

function savedName() {
  try {
    return localStorage.getItem('jorata-username') || '';
  } catch {
    return '';
  }
}

const RANDOM_NAMES = [
  'Sunlit Otter',
  'Breeze Mason',
  'Mossy Wanderer',
  'Cedar Builder',
  'Amber Finch',
  'River Nomad',
  'Pine Architect',
  'Sky Lark',
  'Clay Sculptor',
  'Fern Explorer',
  'Golden Badger',
  'Clover Scout',
];

export function JoinScreen({
  join,
  status,
}: {
  join: (username: string) => void;
  status: string;
}) {
  const [username, setUsername] = useState(savedName);
  const trimmed = username.trim();
  const valid = /^[\p{L}\p{N}_ .-]{2,20}$/u.test(trimmed);

  function pickRandomName() {
    sounds.playUiClick();
    const pick = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    setUsername(pick);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid) {
      sounds.playUiClick();
      join(trimmed);
    }
  }

  const isJoining = status === 'Connecting' || status === 'Joining';

  return (
    <div className="join-backdrop">
      <section className="join-passport-card" aria-labelledby="join-title">
        {/* Animated Avatar Preview Banner */}
        <div className="join-hero-stage">
          <div className="join-avatar-box">
            <div className="join-avatar-sprite">
              <div className="sprite-head" />
              <div className="sprite-body" />
              <div className="sprite-legs" />
            </div>
            <div className="avatar-shadow" />
          </div>
          <span className="join-symbol">✳</span>
        </div>

        <span className="eyebrow">A SHARED LIVING SANDBOX</span>
        <h1 id="join-title">
          Welcome to
          <br />
          The Meadow.
        </h1>
        <p className="join-tagline">
          An open world to explore, build, and connect.
          <br />
          Bring a name. Leave a lasting mark together.
        </p>

        {/* Feature Highlights */}
        <div className="join-highlights-row">
          <span className="highlight-pill">🧱 Creative Sandbox</span>
          <span className="highlight-pill">💬 Living World Chat</span>
          <span className="highlight-pill">📷 Jorata Snaps</span>
        </div>

        <form className="join-form" onSubmit={submit}>
          <div className="input-header-row">
            <label htmlFor="username">Choose your explorer name</label>
            <button
              type="button"
              className="random-name-btn"
              onClick={pickRandomName}
              title="Generate a cozy explorer name"
            >
              🎲 Random Name
            </button>
          </div>

          <div className="input-field-wrapper">
            <input
              id="username"
              autoFocus
              autoComplete="nickname"
              minLength={2}
              maxLength={20}
              value={username}
              onChange={event => setUsername(event.target.value)}
              placeholder="e.g. Mossy Wanderer"
              aria-describedby="name-help"
              required
            />
          </div>

          <span id="name-help" className="name-help">
            {trimmed.length === 0
              ? '2–20 letters or numbers; spaces, dots, underscores welcome.'
              : valid
              ? '✓ Great name! Ready to explore.'
              : 'Name must be 2–20 valid characters.'}
          </span>

          <button className="primary-enter-btn" type="submit" disabled={!valid || isJoining}>
            <span>{isJoining ? 'Entering the meadow…' : 'Enter the Meadow'}</span>
            <span className="arrow-icon">{isJoining ? '⏳' : '→'}</span>
          </button>
        </form>

        <footer className="join-card-footer">
          <span>Instant guest access · No account required · Be kind</span>
        </footer>
      </section>
    </div>
  );
}
