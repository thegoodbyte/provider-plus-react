/** The shared public build contract. Plugin creation remains in the consuming app. */
export function frontendConfig(env, reactPlugin, nodeEnv = process.env.NODE_ENV) {
  const base = (env.PUBLIC_URL || '/').replace(/\/?$/, '/');
  const browserEnv = Object.fromEntries(Object.entries(env).filter(([key]) => key.startsWith('REACT_APP_')));
  const publicUrl = base === '/' ? '' : base.replace(/\/$/, '');
  return {
    plugins: [reactPlugin], base,
    envPrefix: ['VITE_', 'REACT_APP_'],
    define: { 'process.env': JSON.stringify({ ...browserEnv, NODE_ENV: nodeEnv || 'development', PUBLIC_URL: publicUrl }) },
    server: { port: Number(env.PORT || 3000), strictPort: true, watch: { usePolling: env.CHOKIDAR_USEPOLLING === 'true' } },
    build: { outDir: 'build', emptyOutDir: true, manifest: true, sourcemap: env.GENERATE_SOURCEMAP === 'true', target: ['chrome107', 'edge107', 'firefox104', 'safari16'] },
  };
}
