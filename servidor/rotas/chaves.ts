import type { RespostaChaveCriada, RespostaChaves } from '../../src/api/contrato'
import { apagarChave, conferirNomeChave, criarChave, listarChaves } from '../chaves'
import { ErroHttp, json, lerObjeto, rota, semCorpo, texto } from '../http'
import { exigirSessao } from '../sessoes'

/**
 * GET, POST e DELETE /api/chaves: as chaves de acesso da conta. Só com a sessão do
 * site (cookie, com a conferência de Origin da rota()): quem tem uma chave não cria
 * outras nem apaga, porque a rota() recusa todo pedido com Authorization.
 */
export const chaves = rota({
  async GET(req, ctx) {
    const usuario = await exigirSessao(req, ctx)
    const resposta: RespostaChaves = { chaves: await listarChaves(ctx, usuario.id) }
    return json(resposta)
  },

  async POST(req, ctx) {
    const usuario = await exigirSessao(req, ctx)
    const nome = conferirNomeChave(texto(await lerObjeto(req), 'nome'))
    const resposta: RespostaChaveCriada = await criarChave(ctx, usuario.id, nome)
    return json(resposta, 201)
  },

  async DELETE(req, ctx) {
    const usuario = await exigirSessao(req, ctx)
    const id = new URL(req.url).searchParams.get('id')
    if (!id) throw new ErroHttp(400, 'pedido-invalido', 'Diga qual chave apagar (?id=...).')
    await apagarChave(ctx, usuario.id, id)
    return semCorpo()
  },
})
