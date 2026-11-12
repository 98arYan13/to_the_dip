import { rigSavePlugin } from './vite/rigSavePlugin.js';

export default {
  base: './',
  plugins: [rigSavePlugin()],
  build: { target: 'es2022', outDir: 'dist', assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
};
