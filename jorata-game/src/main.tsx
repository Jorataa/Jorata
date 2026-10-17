import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import { SocialApp } from './social/SocialApp';
import './styles.css';
const LegacyApp = lazy(() => import('./App').then(module => ({default:module.App})));
const legacy = (import.meta.env.DEV || import.meta.env.VITE_ENABLE_LEGACY_WORLD === 'true') &&
  (location.pathname === '/world-local' || new URLSearchParams(location.search).has('legacy'));
createRoot(document.getElementById('root')!).render(legacy ? <Suspense fallback={<p>Opening the local world…</p>}><LegacyApp /></Suspense> : <SocialApp />);
