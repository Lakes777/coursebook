/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Os testes rodam sempre no fuso de Brasília, seja no meu PC ou no GitHub
// Actions (que usa UTC). Assim "hoje" e "amanhã" dão o mesmo resultado em todo lugar.
process.env.TZ = 'America/Sao_Paulo'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    // Só a pasta tests/: os worktrees dos subagentes (.claude/worktrees) têm cópias dos testes.
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
