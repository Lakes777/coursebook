import type { RespostaConta } from '../../src/api/contrato'
import {
  chaveEmail,
  conferirEmail,
  credenciaisErradas,
  limitarSenha,
  limparEmail,
  limparTentativas,
  reservarTentativa,
  senhaConfere,
} from '../contas'
import { json, lerObjeto, rota, texto } from '../http'
import { apagarSessao, criarSessao } from '../sessoes'

/** POST /api/entrar: confere e-mail e senha e abre uma sessão. */
export const entrar = rota({
  async POST(req, ctx) {
    const corpo = await lerObjeto(req)
    const email = limparEmail(texto(corpo, 'email'))
    const senha = texto(corpo, 'senha')
    // Antes do argon2 e de gravar a tentativa: e-mail ou senha enormes só gastariam
    // processamento e encheriam a tabela (e passariam do tamanho do índice).
    conferirEmail(email)
    limitarSenha(senha)

    const chave = chaveEmail(email)
    // A tentativa é reservada antes de conferir: a senha errada já fica contada.
    await reservarTentativa(ctx, chave)
    const [usuario] = await ctx.banco.consultar('SELECT id, email, senha_hash FROM usuarios WHERE lower(email) = $1', [
      chave,
    ])
    if (!(await senhaConfere(senha, usuario ? String(usuario.senha_hash) : null))) throw credenciaisErradas()
    await limparTentativas(ctx, chave)

    // Quem entra de novo neste navegador não precisa da sessão anterior.
    await apagarSessao(req, ctx)
    const resposta: RespostaConta = { email: String(usuario.email) }
    return json(resposta, 200, { 'Set-Cookie': await criarSessao(ctx, String(usuario.id)) })
  },
})
