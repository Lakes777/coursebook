import { randomBytes } from 'node:crypto'
import type { RespostaConta } from '../../src/api/contrato'
import type { Contexto } from '../contexto'
import {
  CHAVE_CONVITE,
  conferirEmail,
  conferirSenhaNova,
  conviteConfere,
  gerarHash,
  liberarTentativa,
  limparEmail,
  reservarTentativa,
} from '../contas'
import { ErroHttp, json, lerObjeto, rota, texto } from '../http'
import { apagarSessao, criarSessao } from '../sessoes'

/**
 * Confere o convite. Os chutes errados contam no mesmo bloqueio das senhas (com uma
 * chave só para o convite), reservados antes de comparar, como no entrar.
 */
async function conferirConvite(ctx: Contexto, recebido: string): Promise<void> {
  if (!ctx.convite) throw new ErroHttp(403, 'convite-invalido', 'O cadastro de contas está fechado.')
  const reserva = await reservarTentativa(ctx, CHAVE_CONVITE, 'com o código de convite')
  if (!conviteConfere(recebido, ctx.convite)) {
    throw new ErroHttp(403, 'convite-invalido', 'Código de convite incorreto.')
  }
  // Convite certo não é chute: só a própria reserva sai (as dos chutes de outros ficam).
  await liberarTentativa(ctx, reserva)
}

/** POST /api/cadastro: cria a conta e já entra nela. */
export const cadastro = rota({
  async POST(req, ctx) {
    const corpo = await lerObjeto(req)
    const email = limparEmail(texto(corpo, 'email'))
    const senha = texto(corpo, 'senha')
    const convite = texto(corpo, 'convite')
    // O convite vem antes do resto: sem ele, a API não diz nada sobre e-mails ou contas.
    await conferirConvite(ctx, convite)
    conferirEmail(email)
    conferirSenhaNova(senha)

    const id = 'u_' + randomBytes(16).toString('hex')
    // Um comando só: se duas pessoas cadastrarem o mesmo e-mail ao mesmo tempo, o
    // índice único decide, sem janela entre "conferir se existe" e "inserir".
    const criados = await ctx.banco.consultar(
      `INSERT INTO usuarios (id, email, senha_hash, criado_em) VALUES ($1, $2, $3, $4)
       ON CONFLICT (lower(email)) DO NOTHING RETURNING id`,
      [id, email, await gerarHash(senha), ctx.agora().toISOString()],
    )
    if (criados.length === 0) {
      throw new ErroHttp(409, 'email-em-uso', 'Já existe uma conta com esse e-mail. Tente entrar nela.')
    }

    // A sessão de outra conta que estivesse neste navegador fica sem uso: sai do banco.
    await apagarSessao(req, ctx)
    const resposta: RespostaConta = { email }
    return json(resposta, 201, { 'Set-Cookie': await criarSessao(ctx, id) })
  },
})
