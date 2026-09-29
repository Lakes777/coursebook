import type { PGlite } from '@electric-sql/pglite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { ROTAS } from '../src/api/contrato'
import { comEsquema } from './banco'
import { bancoPglite } from './banco-pglite'
import type { Banco, Contexto, Rota } from './contexto'
import { cadastro } from './rotas/cadastro'
import { conta } from './rotas/conta'
import { dados } from './rotas/dados'
import { entrar } from './rotas/entrar'
import { eu } from './rotas/eu'
import { sair } from './rotas/sair'

// A API no `npm run dev`: o plugin do vite.config.mts manda para cá os pedidos de
// /api/*, que passam do formato do Node (IncomingMessage/ServerResponse) para o
// Web (Request/Response) das rotas, como na Vercel. O banco é um PGlite em .pglite/.

const ROTAS_DEV: Record<string, Rota> = {
  [ROTAS.cadastro]: cadastro,
  [ROTAS.entrar]: entrar,
  [ROTAS.sair]: sair,
  [ROTAS.eu]: eu,
  [ROTAS.conta]: conta,
  [ROTAS.dados]: dados,
}

// Um banco (com o esquema aplicado) por instância do PGlite, que o plugin mantém
// viva mesmo quando o Vite recarrega este arquivo depois de uma edição.
const bancos = new WeakMap<PGlite, Banco>()

export interface OpcoesDev {
  pg: PGlite
  convite: string
}

/** Atende o pedido se for de uma rota da API; devolve false para o Vite seguir. */
export async function tratarApi(
  req: IncomingMessage,
  res: ServerResponse,
  { pg, convite }: OpcoesDev,
): Promise<boolean> {
  const caminho = new URL(req.url ?? '/', 'http://localhost').pathname
  const rota = ROTAS_DEV[caminho]
  if (!rota) return false

  let banco = bancos.get(pg)
  if (!banco) {
    banco = comEsquema(bancoPglite(pg))
    bancos.set(pg, banco)
  }
  const ctx: Contexto = { banco, agora: () => new Date(), convite, seguro: false }
  await enviar(await rota(paraRequest(req), ctx), res)
  return true
}

function paraRequest(req: IncomingMessage): Request {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const cabecalhos = new Headers()
  for (const [nome, valor] of Object.entries(req.headers)) {
    for (const v of Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]) cabecalhos.append(nome, v)
  }
  const temCorpo = req.method !== 'GET' && req.method !== 'HEAD'
  return new Request(url, {
    method: req.method,
    headers: cabecalhos,
    body: temCorpo ? (Readable.toWeb(req) as ReadableStream<Uint8Array>) : undefined,
    duplex: 'half',
  })
}

async function enviar(resposta: Response, res: ServerResponse): Promise<void> {
  res.statusCode = resposta.status
  resposta.headers.forEach((valor, nome) => {
    if (nome !== 'set-cookie') res.setHeader(nome, valor)
  })
  // O forEach junta vários Set-Cookie numa linha só, o que o navegador não entende.
  const cookies = resposta.headers.getSetCookie()
  if (cookies.length > 0) res.setHeader('Set-Cookie', cookies)
  res.end(Buffer.from(await resposta.arrayBuffer()))
}
