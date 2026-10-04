import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach } from 'vitest'
import { COOKIE_SESSAO, type RespostaErro } from '../../src/api/contrato'
import { aplicarEsquema } from '../../servidor/banco'
import { bancoPglite } from '../../servidor/banco-pglite'
import type { Banco, Contexto, Rota } from '../../servidor/contexto'
import { cadastro } from '../../servidor/rotas/cadastro'

// O que os testes da API usam: um PGlite em memória por arquivo (limpo entre os
// testes), um contexto com a hora fixa e um jeito curto de chamar as rotas.

export const CONVITE = 'convite-de-teste'
export const INICIO = new Date('2026-09-28T15:30:00.000Z')

export interface Ambiente {
  pg: PGlite
  ctx: Contexto
  /** Anda o relógio do contexto. */
  avancar(minutos: number): void
}

/** Prepara o banco do arquivo de teste. Chame no topo do arquivo. */
export function prepararAmbiente(): Ambiente {
  const pg = new PGlite()
  let agora = INICIO
  const banco: Banco = bancoPglite(pg)
  const ambiente: Ambiente = {
    pg,
    ctx: { banco, agora: () => agora, convite: CONVITE, seguro: true },
    avancar(minutos) {
      agora = new Date(agora.getTime() + minutos * 60_000)
    },
  }
  // Subir o PGlite (compilar o WebAssembly do Postgres) leva alguns segundos, e mais
  // quando os arquivos de teste sobem os seus ao mesmo tempo: daí o prazo maior.
  beforeAll(async () => {
    await aplicarEsquema(banco)
  }, 60_000)
  beforeEach(async () => {
    await pg.exec('TRUNCATE usuarios, sessoes, tentativas_login, paineis, chaves_acesso')
    agora = INICIO
    ambiente.ctx = { banco, agora: () => agora, convite: CONVITE, seguro: true }
  })
  afterAll(async () => {
    await pg.close()
  })
  return ambiente
}

export interface Pedido {
  metodo?: string
  /** Objeto vira JSON (com Content-Type); texto vai como está. */
  corpo?: unknown
  cookie?: string | null
  cabecalhos?: Record<string, string>
}

export function pedido(caminho: string, { metodo = 'GET', corpo, cookie, cabecalhos = {} }: Pedido = {}): Request {
  const headers = new Headers(cabecalhos)
  let body: string | undefined
  if (corpo !== undefined) {
    body = typeof corpo === 'string' ? corpo : JSON.stringify(corpo)
    if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  }
  if (cookie) headers.set('cookie', `${COOKIE_SESSAO}=${cookie}`)
  return new Request('https://painel.exemplo' + caminho, { method: metodo, headers, body })
}

export function chamar(rota: Rota, ctx: Contexto, caminho: string, opcoes?: Pedido): Promise<Response> {
  return rota(pedido(caminho, opcoes), ctx)
}

/** O corpo de uma resposta de erro. */
export async function erroDe(resposta: Response): Promise<RespostaErro> {
  return (await resposta.json()) as RespostaErro
}

/** O Set-Cookie da sessão, separado em valor e atributos. */
export function cookieDe(resposta: Response): { valor: string; atributos: string[] } | null {
  const linha = resposta.headers.getSetCookie().find((c) => c.startsWith(COOKIE_SESSAO + '='))
  if (!linha) return null
  const [par, ...atributos] = linha.split('; ')
  return { valor: decodeURIComponent(par.slice(COOKIE_SESSAO.length + 1)), atributos }
}

/** Cria uma conta e devolve o token da sessão. */
export async function cadastrar(ctx: Contexto, email = 'ana@exemplo.com', senha = 'senha-boa-123'): Promise<string> {
  const resposta = await chamar(cadastro, ctx, '/api/cadastro', {
    metodo: 'POST',
    corpo: { email, senha, convite: CONVITE },
  })
  if (resposta.status !== 201) throw new Error(`cadastro deu ${resposta.status}`)
  return cookieDe(resposta)!.valor
}
