import { defineConfig } from 'vite';
const codespace = process.env.CODESPACE_NAME;
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
export default defineConfig({
  server: {
    allowedHosts: codespace
      ? ['localhost', ...[3000, 3107].map(port => `${codespace}-${port}.${forwardingDomain}`)]
      : ['localhost'],
  },
});
