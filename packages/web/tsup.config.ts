import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {server:'src/server/server.ts'},
  format: ['esm'],
  dts: false,
  sourcemap: false,
  // clean:true — safe because `npm run build` runs tsup FIRST and then
  // `vite build --emptyOutDir false` appends the frontend assets into the
  // same dist/ (server.js + index.html/assets coexist; __dirname serve).
  clean: true,
  splitting: false,
  target: 'es2020',
  outDir: 'dist',
  // node-pty (native), ws and vite (rollup's native loader) cannot be bundled
  // into the ESM bundle — they are resolved from node_modules at runtime.
  external: ['node-pty', 'ws', 'vite'],
  minify: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
