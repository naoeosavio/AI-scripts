import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['server.ts'],
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
  // node-pty (nativo), ws e vite (loader nativo do rollup) não podem ir
  // para dentro do bundle ESM — são resolvidos do node_modules em runtime.
  external: ['node-pty', 'ws', 'vite'],
  minify: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
