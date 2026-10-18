import express from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameServer } from './game-server.ts';
import { createGuestServer } from './guest-server.ts';
import aiHandler from '../api/ai.ts';
const root = fileURLToPath(new URL('..', import.meta.url));
const app = express();
try { process.loadEnvFile(resolve(root, '.env.local')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const http = createServer(app);
const game = createGameServer(http, resolve(process.env.WORLD_FILE || `${root}/data/meadow.json`));
const guests=createGuestServer(app,game.io,resolve(process.env.GUEST_FILE || `${root}/data/development-social.json`));
app.all('/api/dev/{*path}',(_req,res)=>res.status(404).json({error:'Development services are unavailable.'}));
app.get('/api/health', (_req, res) => res.json({ ok: true, world: 'The Meadow', players: game.players.size, revision: game.world.revision }));
app.post('/api/ai', express.json({limit:'8kb'}), async (req,res) => { await aiHandler(req,res); });
let devServer: import('vite').ViteDevServer | undefined;
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve(root, 'dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve(root, 'dist/index.html')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = devServer = await createViteServer({ root, server: { middlewareMode: true, hmr: { server: http } }, appType: 'spa' });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000);
http.listen(port, '0.0.0.0', () => {
  const address = http.address();
  console.log(`JORATA is ready at http://localhost:${typeof address === 'object' && address ? address.port : port}`);
});
let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  // Stop accepting reconnects before closing either websocket service. Otherwise
  // Vite's client can open an unhandled upgrade while Socket.IO awaits HTTP close.
  http.close();
  await guests?.close();
  await Promise.all([devServer?.close(), game.close()]);
  process.exit(0);
});
