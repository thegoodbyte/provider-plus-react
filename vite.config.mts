import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = (env.PUBLIC_URL || "/").replace(/\/?$/, "/");
  // Preserve deployed REACT_APP_* configuration while exposing no server secrets.
  const browserEnv = Object.fromEntries(
    Object.entries(env).filter(([key]) => key.startsWith("REACT_APP_")),
  );
  const publicUrl = base === "/" ? "" : base.replace(/\/$/, "");
  return {
    plugins: [react()],
    base,
    envPrefix: ["VITE_", "REACT_APP_"],
    define: {
      "process.env": JSON.stringify({
        ...browserEnv,
        NODE_ENV: process.env.NODE_ENV || "development",
        PUBLIC_URL: publicUrl,
      }),
    },
    server: {
      port: Number(env.PORT || 3000),
      strictPort: true,
      watch: { usePolling: env.CHOKIDAR_USEPOLLING === "true" },
    },
    build: {
      outDir: "build",
      emptyOutDir: true,
      manifest: true,
      sourcemap: env.GENERATE_SOURCEMAP === "true",
      target: ["chrome107", "edge107", "firefox104", "safari16"],
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
    },
  };
});
