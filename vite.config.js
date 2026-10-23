import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      p5: resolve(process.cwd(), 'node_modules/p5/lib/p5.esm.min.js'),
    },
  },
  base: './',
});

