import { neon } from '@neondatabase/serverless'
import type { Banco, Linha } from './contexto'

// Postgres do Neon pelo driver HTTP: cada consulta é um fetch, sem conexão aberta
// entre uma chamada e outra (combina com as funções da Vercel, que dormem e acordam).
export function bancoNeon(url: string): Banco {
  const sql = neon(url)
  return {
    async consultar(texto, parametros = []) {
      return (await sql.query(texto, parametros)) as Linha[]
    },
  }
}
