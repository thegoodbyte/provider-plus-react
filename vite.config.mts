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
    build: {
      outDir: 'build', emptyOutDir: true, manifest: true, sourcemap: env.GENERATE_SOURCEMAP === 'true', target: ['chrome107', 'edge107', 'firefox104', 'safari16'],
      rollupOptions: {
        output: {
          // PPVC-877: route-level React.lazy (PPVC-875) only splits *our*
          // page code -- these heavy shared libraries still land in
          // whichever chunk first imports them unless given their own
          // vendor chunk, which is what keeps them out of the main entry
          // regardless of which route happens to load first.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('node_modules/antd') || id.includes('node_modules/@ant-design') || id.includes('node_modules/rc-')) return 'vendor-antd';
            if (id.includes('node_modules/@mui')) return 'vendor-mui';
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'vendor-recharts';
            if (id.includes('node_modules/moment')) return 'vendor-moment';
            if (id.includes('node_modules/html2canvas')) return 'vendor-html2canvas';
            if (id.includes('node_modules/jspdf')) return 'vendor-jspdf';
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/react-icons')) return 'vendor-icons';
            return undefined;
          },
        },
      },
    },
  };
});
