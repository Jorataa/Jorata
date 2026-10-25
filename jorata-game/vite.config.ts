import { defineConfig, loadEnv } from 'vite';
import assistant from './api/surgery-assistant';
const codespace = process.env.CODESPACE_NAME;
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'');
 for(const key of ['GEMINI_API_KEY','GOOGLE_API_KEY','GEMINI_MODEL'])if(!process.env[key]&&env[key])process.env[key]=env[key];
 return {
 plugins:[{name:'surgery-assistant-server',configureServer(server){server.middlewares.use('/api/surgery-assistant',assistant);},configurePreviewServer(server){server.middlewares.use('/api/surgery-assistant',assistant);}}],
  server: {
    allowedHosts: codespace
      ? ['localhost', '.app.github.dev', ...[3000, 3107, 3108, 3109, 5173].map(port => `${codespace}-${port}.${forwardingDomain}`)]
      : ['localhost'],
  },
};});
