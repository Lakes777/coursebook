import type { RespostaConta } from '../../src/api/contrato'
import {
  chaveEmail,
  conferirBloqueio,
  credenciaisErradas,
  limitarSenha,
  limparTentativas,
  registrarTentativa,
  senhaConfere,
} from '../contas'
import { json, lerObjeto, rota, texto } from '../http'
import { criarSessao } from '../sessoes'

/** POST /api/entrar: confere e-mail e senha e abre uma sessão. */
export const entrar = rota({
  async POST(req, ctx) {
    const corpo = await lerObjeto(req)
    const email = texto(corpo, 'email')
    const senha = texto(corpo, 'senha')
    limitarSenha(senha)

    const chave = chaveEmail(email)
    await conferirBloqueio(ctx, chave)
    const [usuario] = await ctx.banco.consultar('SELECT id, email, senha_hash FROM usuarios WHERE lower(email) = $1', [
      chave,
    ])
    if (!(await senhaConfere(senha, usuario ? String(usuario.senha_hash) : null))) {
      await registrarTentativa(ctx, chave)
      throw credenciaisErradas()
    }
    await limparTentativas(ctx, chave)

    const resposta: RespostaConta = { email: String(usuario.email) }
    return json(resposta, 200, { 'Set-Cookie': await criarSessao(ctx, String(usuario.id)) })
  },
})
