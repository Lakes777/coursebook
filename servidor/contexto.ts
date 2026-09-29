// O que as rotas recebem além do pedido. Nada de process.env aqui dentro: quem monta
// o contexto é a produção (producao.ts), o `npm run dev` (vite.config.mts) ou o teste.

/** Uma linha de resultado do SQL, com as colunas pelo nome. */
export type Linha = Record<string, unknown>

export interface Banco {
  /** Roda um comando SQL (com $1, $2... nos parâmetros) e devolve as linhas. */
  consultar(sql: string, parametros?: unknown[]): Promise<Linha[]>
}

export interface Contexto {
  banco: Banco
  /** A hora atual; os testes fixam. */
  agora: () => Date
  /** O CODIGO_CONVITE; sem ele, o cadastro fica fechado. */
  convite: string | undefined
  /** Se o cookie da sessão leva Secure (false só em http://localhost). */
  seguro: boolean
}

export type Rota = (req: Request, ctx: Contexto) => Promise<Response>
