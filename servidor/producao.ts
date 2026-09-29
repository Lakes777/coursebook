import { comEsquema } from './banco'
import { bancoNeon } from './banco-neon'
import type { Banco, Contexto, Rota } from './contexto'

// O contexto das funções da Vercel, lido das variáveis de ambiente. Fica guardado
// entre chamadas enquanto a instância estiver acordada (o esquema vai uma vez só).

let banco: Banco | null = null

/**
 * O Neon só é criado na primeira consulta: rota que não precisa do banco (o /api/eu
 * sem cookie, por exemplo) responde mesmo sem DATABASE_URL.
 */
const bancoPreguicoso: Banco = {
  async consultar(sql, parametros) {
    if (!banco) {
      const url = process.env.DATABASE_URL
      if (!url) throw new Error('Falta a variável de ambiente DATABASE_URL.')
      banco = comEsquema(bancoNeon(url))
    }
    return banco.consultar(sql, parametros)
  },
}

const contexto: Contexto = {
  banco: bancoPreguicoso,
  agora: () => new Date(),
  convite: process.env.CODIGO_CONVITE || undefined,
  seguro: true,
}

/** A rota pronta para a Vercel, que chama só com o pedido. */
export function emProducao(rota: Rota): (req: Request) => Promise<Response> {
  return (req) => rota(req, contexto)
}
