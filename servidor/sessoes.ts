import { createHash, randomBytes } from 'node:crypto'
import { COOKIE_SESSAO, LIMITES } from '../src/api/contrato'
import type { Contexto } from './contexto'
import { ErroHttp, lerCookie, serializarCookie } from './http'

// Sessões: o token fica só no cookie do navegador; o banco guarda o SHA-256 dele,
// então quem ler o banco (um backup vazado, por exemplo) não consegue entrar.

const SEGUNDOS_SESSAO = LIMITES.diasSessao * 24 * 60 * 60

export interface Usuario {
  id: string
  email: string
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Cria a sessão no banco e devolve o Set-Cookie. */
export async function criarSessao(ctx: Contexto, usuarioId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const agora = ctx.agora()
  const expira = new Date(agora.getTime() + SEGUNDOS_SESSAO * 1000)
  await ctx.banco.consultar(
    'INSERT INTO sessoes (token_hash, usuario_id, criada_em, expira_em) VALUES ($1, $2, $3, $4)',
    [hashToken(token), usuarioId, agora.toISOString(), expira.toISOString()],
  )
  return serializarCookie(COOKIE_SESSAO, token, { maxAge: SEGUNDOS_SESSAO, seguro: ctx.seguro })
}

/** Set-Cookie que apaga o cookie da sessão no navegador. */
export function cookieVencido(ctx: Contexto): string {
  return serializarCookie(COOKIE_SESSAO, '', { maxAge: 0, seguro: ctx.seguro })
}

/**
 * Quem é o dono do cookie, ou null. Sem cookie, nem consulta o banco. Sessão vencida
 * conta como sem sessão e já é apagada.
 */
export async function lerSessao(req: Request, ctx: Contexto): Promise<Usuario | null> {
  const token = lerCookie(req, COOKIE_SESSAO)
  if (!token) return null
  const tokenHash = hashToken(token)
  const [linha] = await ctx.banco.consultar(
    `SELECT u.id, u.email, s.expira_em > $2::timestamptz AS valida
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = $1`,
    [tokenHash, ctx.agora().toISOString()],
  )
  if (!linha) return null
  if (!linha.valida) {
    await ctx.banco.consultar('DELETE FROM sessoes WHERE token_hash = $1', [tokenHash])
    return null
  }
  return { id: String(linha.id), email: String(linha.email) }
}

export async function exigirSessao(req: Request, ctx: Contexto): Promise<Usuario> {
  const usuario = await lerSessao(req, ctx)
  if (!usuario) throw new ErroHttp(401, 'sem-sessao', 'Sua sessão acabou. Entre de novo na sua conta.')
  return usuario
}

/** Apaga a sessão do cookie (se houver). */
export async function apagarSessao(req: Request, ctx: Contexto): Promise<void> {
  const token = lerCookie(req, COOKIE_SESSAO)
  if (!token) return
  await ctx.banco.consultar('DELETE FROM sessoes WHERE token_hash = $1', [hashToken(token)])
}
