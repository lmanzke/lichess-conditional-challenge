// Builds the extension into dist/. The content script has to be a single classic script
// (content scripts cannot be ES modules), the options page is a regular Vite html app.
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const dev = process.argv.includes('--dev');
const watch = process.argv.includes('--watch');
const mode = dev ? 'development' : 'production';

const shared = {
  configFile: root + 'vite.config.ts',
  root,
  mode,
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': JSON.stringify(mode), __VUE_OPTIONS_API__: false, __VUE_PROD_DEVTOOLS__: false },
  build: { outDir: 'dist', emptyOutDir: false, minify: !dev, sourcemap: dev, watch: watch ? {} : null },
};

await rm(root + 'dist', { recursive: true, force: true });

await build({
  ...shared,
  build: {
    ...shared.build,
    lib: {
      entry: 'src/challenge/challenge.ts',
      name: 'lichessConditionalChallenge',
      formats: ['iife'],
      fileName: () => 'challenge/challenge.js',
      cssFileName: 'challenge/challenge',
    },
  },
});

await build({
  ...shared,
  build: {
    ...shared.build,
    lib: { entry: 'src/background.ts', name: 'lichessConditionalChallengeBackground', formats: ['iife'], fileName: () => 'background.js' },
  },
});

await build({
  ...shared,
  root: root + 'src',
  base: './',
  build: {
    ...shared.build,
    outDir: root + 'dist',
    rollupOptions: { input: { 'options/options': root + 'src/options/options.html' } },
  },
});

const { version } = JSON.parse(await readFile(root + 'package.json', 'utf8'));
const manifest = JSON.parse(await readFile(root + 'src/manifest.json', 'utf8'));
await mkdir(root + 'dist', { recursive: true });
await writeFile(root + 'dist/manifest.json', JSON.stringify({ ...manifest, version }, null, 2));
await cp(root + 'src/icons', root + 'dist/icons', { recursive: true, filter: source => !source.endsWith('.xcf') });
