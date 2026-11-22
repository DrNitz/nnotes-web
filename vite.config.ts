import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves the app at https://drnitz.github.io/nnotes-web/
  base: '/nnotes-web/',
  plugins: [react()],
  server: { port: 5173, host: true },
});
