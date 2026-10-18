/** Framework-independent build configuration: the consumer supplies its plugin. */
export declare function frontendConfig<T>(env: Record<string, string>, reactPlugin: T, nodeEnv?: string): {
  plugins: T[];
  base: string;
  envPrefix: string[];
  define: Record<string, string>;
  server: { port: number; strictPort: boolean; watch: { usePolling: boolean } };
  build: { outDir: string; emptyOutDir: boolean; manifest: boolean; sourcemap: boolean; target: string[] };
};
