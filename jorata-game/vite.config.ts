import { defineConfig } from 'vite';
export default defineConfig({ server: { allowedHosts: process.env.CODESPACE_NAME ? [`${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev'}`] : ['localhost'] } });
