# JORATA

A playable shared 2D world: guest identity, server-authoritative movement and collisions, camera follow, real-time world chat, shared building and JSON persistence. React + TypeScript + Canvas, Express and Socket.IO; no external accounts or services.

## Run in Codespaces

Requires Node.js 22.12+ (the current Codespace uses Node 24).

```sh
cd /workspaces/Jorata/jorata-game
npm ci
npm run dev
```

Open port **3000** from the Codespaces **Ports** panel with **Open in Browser**. The frontend, backend, WebSockets and hot reload share this port; no backend URL or CORS configuration is needed. Open the same address in another tab and enter a different name to play together. Keep the port private unless you intend to share this guest world.

Move with A/D or left/right arrows. Jump with W, up arrow or Space. Enter focuses chat; Escape returns to the game. Select Timber, Clay or Glass with 1/2/3 or the build kit, then click a nearby empty tile to place. Right click, Shift+click or the Remove tool removes a block. The arrival area and bottom bedrock are protected; build just to the right of the spawn sign. Touch movement buttons appear on mobile. Return to spawn gets you unstuck.

The floating HUD also offers Q/X to toggle Demolish, a collapsible chat/explorer directory, quick reactions, help, sound effects and local PNG snapshots. On phones, chat starts collapsed so the world and build kit remain visible. Press Enter or tap World Chat to open it. Snapshot downloads are local images; no photo-sharing backend is involved.

## Verify

```sh
npm test
npx playwright install --with-deps chromium  # first browser-test setup only
npm run test:browser
```

The integration test uses two real Socket.IO clients and checks movement, collision, chat, edit validation, building, leaving and persistence after server restart. The browser test builds and starts an isolated production server on a temporary port/save, then checks two Chromium clients, keyboard movement/jump, chat focus, shared edits, refresh, reconnect and touch controls. Screenshots are written to ignored `artifacts/`. Tests never modify the live world's save.

For production-style local serving: `npm run build && npm start`.

## Persistence and limits

`data/meadow.json` is written atomically before accepted edits are broadcast. It survives browser refreshes and server restarts. Back it up before rebuilding the Codespace; the save is intentionally ignored by Git. `WORLD_FILE` overrides the save path and `PORT` overrides port 3000. Corrupt saves cause a clear startup error instead of silently discarding builds.

One shared world, at most 64 players; one Node process owns it. Positions and chat history are in memory (guests respawn when reconnecting; up to 80 recent messages survive only while the server runs). Names are unverified guest labels. There are no accounts, moderation, private messages, inventory or multi-server support yet. Materials are unlimited for this sandbox MVP. Rate limits, edit reach, player overlap checks and authoritative server physics provide basic safeguards.

See [the design handoff](../DESIGN_HANDOFF.md) before changing game/UI integration.
