import express from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGameServer } from './game-server.ts';
const root = fileURLToPath(new URL('..', import.meta.url));
const app = express();
const http = createServer(app);
const game = createGameServer(http, resolve(process.env.WORLD_FILE || `${root}/data/meadow.json`));
app.get('/api/health', (_req, res) => res.json({ ok: true, world: 'The Meadow', players: game.players.size, revision: game.world.revision }));
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve(root, 'dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve(root, 'dist/index.html')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ root, server: { middlewareMode: true, hmr: { server: http } }, appType: 'spa' });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000);
http.listen(port, '0.0.0.0', () => {
  const address = http.address();
  console.log(`JORATA is ready at http://localhost:${typeof address === 'object' && address ? address.port : port}`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => { await game.close(); http.close(); process.exit(0); });
