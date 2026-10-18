import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { frontendConfig } from '@ibogaspirit/frontend-tooling/config';
export default defineConfig(({ mode }) => {
 const config = frontendConfig(loadEnv(mode, process.cwd(), ''), react());
 return {...config, build: {...config.build,
      rollupOptions: {
        output: {
          // Keep shared transitive dependencies out of lazy PDF engine chunks.
          onlyExplicitManualChunks: true,
          // Let Rollup separate shared UI dependencies automatically. Explicitly
          // grouping antd and its dependencies can create an entry/vendor cycle.
          // PDF engines stay separate and import only when export is requested.
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("node_modules/html2canvas"))
              return "vendor-html2canvas";
            if (id.includes("node_modules/jspdf")) return "vendor-jspdf";
            return undefined;
          },
        },
      },
 }};
});
