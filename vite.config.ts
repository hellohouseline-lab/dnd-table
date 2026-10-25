/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the site from /dnd-table/. Change `base` to '/' if a custom domain is set up.
export default defineConfig({
  base: '/dnd-table/',
  plugins: [react()],
  // Its own port, so it can run next to other local projects. Supabase allows login redirects to it.
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
  test: {
    // Playwright tests in e2e/ run separately, so Vitest only looks in src/.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
