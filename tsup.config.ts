import { defineConfig } from 'tsup';

/**
 * Runs after `build:data`, which empties `dist/` and writes the two data files; `clean` stays
 * off so they survive. The library (ESM + CJS, with declarations) inlines `dist/registry.json`,
 * so it works without a file read at runtime. The CLI is one ESM file with a shebang.
 */
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    target: 'es2022',
    platform: 'neutral',
    sourcemap: false,
    clean: false,
    treeshake: true,
    external: ['zod', '@noble/hashes'],
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    dts: false,
    target: 'es2022',
    platform: 'node',
    sourcemap: false,
    clean: false,
    banner: { js: '#!/usr/bin/env node' },
  },
]);
