import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the build works at the domain root (card.savankong.com) or under a path.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
