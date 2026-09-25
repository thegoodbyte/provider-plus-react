import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = (env.PUBLIC_URL || '/').replace(/\/?$/, '/');
  // Preserve deployed REACT_APP_* configuration while exposing no server secrets.
  const browserEnv = Object.fromEntries(Object.entries(env).filter(([key]) => key.startsWith('REACT_APP_')));
  const publicUrl = base === '/' ? '' : base.replace(/\/$/, '');
  return {
    plugins: [react()], base,
    envPrefix: ['VITE_', 'REACT_APP_'],
    define: { 'process.env': JSON.stringify({ ...browserEnv, NODE_ENV: process.env.NODE_ENV || 'development', PUBLIC_URL: publicUrl }) },
    server: { port: Number(env.PORT || 3000), strictPort: true, watch: { usePolling: env.CHOKIDAR_USEPOLLING === 'true' } },
    build: { outDir: 'build', emptyOutDir: true, manifest: true, sourcemap: env.GENERATE_SOURCEMAP === 'true', target: ['chrome107', 'edge107', 'firefox104', 'safari16'] },
  };
});
