import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Minimal, standalone Vitest config — deliberately not merged with
// vite.config.ts, which does extra work at load time (reading installed
// package versions to cross-check @mediapipe/tasks-vision, copying WASM
// assets, etc.) that the test suite doesn't need and shouldn't depend on.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
