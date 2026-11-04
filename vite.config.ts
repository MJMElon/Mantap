import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Published at https://mjmelon.github.io/Mantap/
export default defineConfig({
  base: '/Mantap/',
  plugins: [react()],
  build: { sourcemap: false },
});
