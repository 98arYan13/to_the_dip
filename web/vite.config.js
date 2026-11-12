import { rigSavePlugin } from './vite/rigSavePlugin.js';

export default {
  base: './',
  plugins: [rigSavePlugin()],
  server: { port: 5273, strictPort: true }, // 5173 is used by another project
  build: { target: 'es2022', outDir: 'dist', assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
};
