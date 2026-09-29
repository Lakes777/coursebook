import type { RespostaConta } from '../../src/api/contrato'
import { json, rota } from '../http'
import { exigirSessao } from '../sessoes'

/** GET /api/eu: de quem é a sessão deste navegador. */
export const eu = rota({
  async GET(req, ctx) {
    const usuario = await exigirSessao(req, ctx)
    const resposta: RespostaConta = { email: usuario.email }
    return json(resposta)
  },
})
