import { randomBytes } from 'node:crypto'
import { LIMITES, PREFIXO_CHAVE, type ChaveAcesso } from '../src/api/contrato'
import type { Contexto, Linha } from './contexto'
import { ErroHttp } from './http'
import { hashToken } from './sessoes'

// Chaves de acesso: um token "cb_..." que um programa da própria pessoa (o bot do
// Telegram) manda no cabeçalho Authorization para LER os prazos, sem guardar a senha.
// Como nas sessões, o banco guarda só o SHA-256: o token aparece uma vez, ao criar.

/** "cb_" + 32 bytes aleatórios em base64url (43 caracteres). */
const FORMATO_TOKEN = new RegExp(`^${PREFIXO_CHAVE}[A-Za-z0-9_-]{43}$`)

export function gerarToken(): string {
  return PREFIXO_CHAVE + randomBytes(32).toString('base64url')
}

/** O Neon e o PGlite devolvem TIMESTAMPTZ como Date; texto também serve. */
function isoOuNull(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null
  return new Date(valor as string | Date).toISOString()
}

function paraChave(linha: Linha): ChaveAcesso {
  return {
    id: String(linha.id),
    nome: String(linha.nome),
    criadaEm: isoOuNull(linha.criada_em)!,
    usadaEm: isoOuNull(linha.usada_em),
  }
}

/** Nome da chave sem espaços nas pontas, entre 1 e LIMITES.nomeChaveMaximo caracteres. */
export function conferirNomeChave(nome: string): string {
  const limpo = nome.trim()
  if (limpo === '') throw new ErroHttp(400, 'pedido-invalido', 'Dê um nome à chave (ex.: "Bot do Telegram").')
  // Quebra de linha, tab, \u0000 (que o Postgres nem aceita num TEXT)...: um nome não tem isso.
  // oxlint-disable-next-line no-control-regex -- os caracteres de controle são justamente o que se procura.
  if (/[\u0000-\u001f\u007f]/.test(limpo)) {
    throw new ErroHttp(400, 'pedido-invalido', 'O nome não pode ter quebras de linha nem caracteres de controle.')
  }
  if (limpo.length > LIMITES.nomeChaveMaximo) {
    throw new ErroHttp(400, 'pedido-invalido', `O nome pode ter no máximo ${LIMITES.nomeChaveMaximo} caracteres.`)
  }
  return limpo
}

export async function listarChaves(ctx: Contexto, usuarioId: string): Promise<ChaveAcesso[]> {
  const linhas = await ctx.banco.consultar(
    'SELECT id, nome, criada_em, usada_em FROM chaves_acesso WHERE usuario_id = $1 ORDER BY criada_em, id',
    [usuarioId],
  )
  return linhas.map(paraChave)
}

/** Cria a chave e devolve os dados dela e o token, que só existe aqui. */
export async function criarChave(
  ctx: Contexto,
  usuarioId: string,
  nome: string,
): Promise<{ chave: ChaveAcesso; token: string }> {
  const token = gerarToken()
  const id = 'k_' + randomBytes(16).toString('hex')
  // Conta e grava no mesmo comando: não há uma volta ao servidor entre conferir o
  // limite e inserir. (Dois pedidos no mesmo instante ainda podem passar juntos; para
  // chaves que a própria pessoa cria pelo site, isso não vale um bloqueio.)
  const criadas = await ctx.banco.consultar(
    `INSERT INTO chaves_acesso (id, usuario_id, nome, token_hash, criada_em)
     SELECT $1, $2, $3, $4, $5
      WHERE (SELECT count(*) FROM chaves_acesso WHERE usuario_id = $2) < $6
     RETURNING id, nome, criada_em, usada_em`,
    [id, usuarioId, nome, hashToken(token), ctx.agora().toISOString(), LIMITES.chavesPorConta],
  )
  if (criadas.length === 0) {
    throw new ErroHttp(
      409,
      'limite-chaves',
      `Cada conta pode ter no máximo ${LIMITES.chavesPorConta} chaves. Apague uma que não usa mais.`,
    )
  }
  return { chave: paraChave(criadas[0]), token }
}

/** Apaga a chave da conta. A de outra conta conta como inexistente (404), sem dizer que existe. */
export async function apagarChave(ctx: Contexto, usuarioId: string, id: string): Promise<void> {
  const apagadas = await ctx.banco.consultar(
    'DELETE FROM chaves_acesso WHERE id = $1 AND usuario_id = $2 RETURNING id',
    [id, usuarioId],
  )
  if (apagadas.length === 0) throw new ErroHttp(404, 'nao-encontrada', 'Essa chave não existe mais.')
}

const chaveInvalida = (mensagem: string) =>
  new ErroHttp(401, 'chave-invalida', mensagem, { 'WWW-Authenticate': 'Bearer' })

/**
 * O dono da chave do cabeçalho "Authorization: Bearer cb_...". Só a chave vale: errada
 * ou apagada é 401, sem cair no cookie. Aproveita o mesmo comando para anotar o uso.
 */
export async function exigirChave(req: Request, ctx: Contexto): Promise<string> {
  const cabecalho = req.headers.get('authorization')
  if (cabecalho === null) {
    throw chaveInvalida('Falta a chave de acesso: use o cabeçalho "Authorization: Bearer cb_...".')
  }
  const [tipo, token = '', ...resto] = cabecalho.trim().split(/\s+/)
  if (tipo.toLowerCase() !== 'bearer' || resto.length > 0 || !FORMATO_TOKEN.test(token)) {
    throw chaveInvalida('Chave de acesso fora do formato: use "Authorization: Bearer cb_...".')
  }
  const [linha] = await ctx.banco.consultar(
    'UPDATE chaves_acesso SET usada_em = $2 WHERE token_hash = $1 RETURNING usuario_id',
    [hashToken(token), ctx.agora().toISOString()],
  )
  if (!linha) throw chaveInvalida('Chave de acesso inválida ou apagada.')
  return String(linha.usuario_id)
}
