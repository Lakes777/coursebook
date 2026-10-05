/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, type Plugin } from 'vite'

// Os testes rodam sempre no fuso de Brasília, seja no meu PC ou no GitHub
// Actions (que usa UTC). Assim "hoje" e "amanhã" dão o mesmo resultado em todo lugar.
process.env.TZ = 'America/Sao_Paulo'

/** O que servidor/dev.ts exporta (tipado aqui para o config não puxar os tipos do servidor). */
interface ApiLocal {
  tratarApi(req: IncomingMessage, res: ServerResponse, opcoes: { pg: unknown; convite: string }): Promise<boolean>
}

/**
 * Só no `npm run dev`: serve /api/* com as rotas de servidor/, como a Vercel faz em
 * produção, com um PGlite gravado em .pglite/. O código do servidor é carregado pelo
 * próprio Vite (ssrLoadModule), então não entra no bundle do site e recarrega quando
 * é editado.
 */
function apiLocal(): Plugin {
  return {
    name: 'painel-api-local',
    apply: 'serve',
    configureServer(server) {
      let pg: Promise<unknown> | null = null
      const convite = process.env.CODIGO_CONVITE || 'convite-local'
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        try {
          pg ??= import('@electric-sql/pglite').then(({ PGlite }) => new PGlite('.pglite'))
          const api = (await server.ssrLoadModule('/servidor/dev.ts')) as ApiLocal
          if (!(await api.tratarApi(req, res, { pg: await pg, convite }))) next()
        } catch (erro) {
          next(erro)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiLocal()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    // Só a pasta tests/: os worktrees dos subagentes (.claude/worktrees) têm cópias dos testes.
    include: ['tests/**/*.test.{ts,tsx}'],
    // Folga para máquina ocupada (CI, duas suítes juntas): os testes de tela mais
    // pesados levam ~1 s sozinhos, mas chegaram a 4 s com a CPU disputada, e o
    // primeiro teste de cada arquivo ainda paga o aquecimento do jsdom. 5 s (o padrão)
    // dava falhas aleatórias; 15 s só pega teste travado de verdade.
    testTimeout: 15_000,
  },
})
