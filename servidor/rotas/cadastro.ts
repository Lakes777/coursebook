import { randomBytes } from 'node:crypto'
import type { RespostaConta } from '../../src/api/contrato'
import { conferirConvite, conferirFormato, gerarHash, limparEmail } from '../contas'
import { ErroHttp, json, lerObjeto, rota, texto } from '../http'
import { criarSessao } from '../sessoes'

/** POST /api/cadastro: cria a conta e já entra nela. */
export const cadastro = rota({
  async POST(req, ctx) {
    const corpo = await lerObjeto(req)
    const email = limparEmail(texto(corpo, 'email'))
    const senha = texto(corpo, 'senha')
    // O convite vem antes do resto: sem ele, a API não diz nada sobre e-mails ou contas.
    conferirConvite(texto(corpo, 'convite'), ctx.convite)
    conferirFormato(email, senha)

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

    const resposta: RespostaConta = { email }
    return json(resposta, 201, { 'Set-Cookie': await criarSessao(ctx, id) })
  },
})
