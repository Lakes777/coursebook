import {
  chaveEmail,
  credenciaisErradas,
  limitarSenha,
  limparTentativas,
  reservarTentativa,
  senhaConfere,
} from '../contas'
import { lerObjeto, rota, semCorpo, texto } from '../http'
import { cookieVencido, exigirSessao } from '../sessoes'

/** DELETE /api/conta: apaga a conta, pedindo a senha de novo. */
export const conta = rota({
  async DELETE(req, ctx) {
    const usuario = await exigirSessao(req, ctx)
    const senha = texto(await lerObjeto(req), 'senha')
    limitarSenha(senha)

    // A senha daqui conta no mesmo bloqueio do entrar: uma sessão roubada não vira
    // um jeito de testar senhas à vontade. O e-mail vem da conta, já conferido no cadastro.
    const chave = chaveEmail(usuario.email)
    await reservarTentativa(ctx, chave)
    const [linha] = await ctx.banco.consultar('SELECT senha_hash FROM usuarios WHERE id = $1', [usuario.id])
    if (!(await senhaConfere(senha, linha ? String(linha.senha_hash) : null))) throw credenciaisErradas()

    // O ON DELETE CASCADE leva as sessões e o painel junto, no mesmo comando.
    await ctx.banco.consultar('DELETE FROM usuarios WHERE id = $1', [usuario.id])
    await limparTentativas(ctx, chave)
    return semCorpo({ 'Set-Cookie': cookieVencido(ctx) })
  },
})
