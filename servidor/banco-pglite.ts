import type { PGlite } from '@electric-sql/pglite'
import type { Banco, Linha } from './contexto'

// Postgres dentro do Node, para os testes (em memória) e o `npm run dev` (em .pglite/).
// Recebe a instância pronta: quem cria decide onde ela grava. Só o tipo é importado,
// então o PGlite (dependência de desenvolvimento) não vai para as funções da Vercel.
export function bancoPglite(pg: PGlite): Banco {
  return {
    async consultar(sql, parametros = []) {
      const resultado = await pg.query<Linha>(sql, parametros)
      return resultado.rows
    },
  }
}
