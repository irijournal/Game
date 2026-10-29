import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Every current browser reads woff2; dropping the woff fallbacks halves the
// inlined font payload of the single-file build.
const woff2Only: Plugin = {
  name: 'woff2-only',
  enforce: 'pre',
  transform(code, id) {
    if (id.includes('@fontsource') && id.endsWith('.css')) return code.replace(/,\s*url\([^)]*\.woff\) format\('woff'\)/g, '');
    return null;
  },
};

// Single self-contained HTML file (scripts, styles and fonts inlined): it
// can be opened straight from disk or shared as one file. `npm run build:single`
export default defineConfig({
  base: './',
  plugins: [react(), woff2Only, viteSingleFile()],
  build: {
    outDir: 'dist-single',
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
  },
});
