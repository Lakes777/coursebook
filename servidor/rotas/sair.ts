import { rota, semCorpo } from '../http'
import { apagarSessao, cookieVencido } from '../sessoes'

/** POST /api/sair: apaga a sessão e o cookie. Sem sessão, responde igual (204). */
export const sair = rota({
  async POST(req, ctx) {
    await apagarSessao(req, ctx)
    return semCorpo({ 'Set-Cookie': cookieVencido(ctx) })
  },
})
