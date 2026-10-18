# JORATA — communication workspace

JORATA opens directly into a temporary guest workspace. **No login, signup or Supabase configuration is needed.** Messaging is the main experience; the Meadow is optional.

## Run in Codespaces

```sh
cd /workspaces/Jorata/jorata-game
npm ci
npm run dev
```

Open the **port 3000** preview from Codespaces → Ports. Keep its visibility **Private**: this is a development service. Open two tabs, choose **Settings → Edit guest** to name each guest, then use the lounge or **New chat** to find the other guest. **New guest** creates a distinct identity; the identity selector restores only identities created in this browser. Reload keeps the current tab's identity.

## Working features

- Direct and group conversations, history, timestamps, replies, own-message editing/deletion, reactions, conversation search, presence and typing.
- Group invitations, renaming, member removal and leaving; discover/create/join communities and create text channels with owner/admin/member permissions.
- A shared task list in each conversation: assignment, deadlines, details, completion, edits and permission-checked deletion.
- Camera capture or file upload; filters, brightness/contrast/saturation, decorative frames, captions, stickers and explicit photo sending. Frames are not background removal. Photos are validated and re-encoded; guest JPEG payload limit is about 1 MB.
- Optional Meadow: keyboard movement/jumping, other players, shared blocks, speech bubbles, emotes and opening a nearby player's conversation.

## Data modes

**Local development:** real Socket.IO communication across clients connected to this Codespace. The server creates random session capabilities, binds sender identity to the session, checks memberships and rate-limits mutations. Data persists in ignored `data/development-social.json`; back it up before rebuilding the Codespace. It is test data, not verified accounts or production-secure messaging. Do not share sensitive information or publish this development port.

**Vercel / production build:** explicitly labeled **sample demo**. IndexedDB stores sample data in this browser; BroadcastChannel synchronizes tabs on the same origin/browser profile. Separate devices or browser profiles do not communicate. Anyone with access to that browser's storage can inspect its sample data. No guest backend, production conversation reads, Supabase calls or Gemini requests are used by the default workspace. Clearing site storage erases the demo. Use sample content only.

The existing Supabase implementation and migrations remain intact for future integration. `VITE_ENABLE_ACCOUNTS=true` explicitly enables the preserved `/accounts` route for engineering use; it is off by default. No new authentication screens were built. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Verify

```sh
npm run build
npm test
# Isolated two-user messaging, persistence, gestures, desktop and mobile:
npm run test:redesign
# Legacy guest smoke test (older UI selectors):
# With npm run dev on port 3000:
GUEST_TEST_URL=http://localhost:3000 npm run test:guest:browser
# With a production build served locally or on a safe Vercel preview:
GUEST_TEST_URL=https://your-preview.vercel.app GUEST_TEST_DEMO=true npm run test:guest:browser
```

Browser tests use two temporary identities; local mode uses separate browser contexts, demo mode uses two tabs in one context. Camera automation uses a synthetic Chromium device; verify real phones manually. Install Chromium with `npx playwright install --with-deps chromium` if needed.

Antigravity: [DESIGN_HANDOFF.md](DESIGN_HANDOFF.md). Original server-authoritative game is preserved at `/world-local` in development, with its separate `data/meadow.json` save.

## Compact chat controls

Drag the inbox divider to resize it (250–420px); double-click to reset to 288px. The focused divider also supports arrow keys, Home/End and Enter. On touchscreens, swipe a message to the right to reply. Vertical scrolling stays native. Drop or paste a JPEG, PNG or WebP to preview it, then choose **Send photo**; other file types are not supported by the existing media service.

Guest identities are in **Settings**. Open an independent tab or browser context for a second guest; if your browser duplicates an existing tab session, choose **New guest**. Both clients use the local Socket.IO server. Settings also provides light, dark and system appearance.
