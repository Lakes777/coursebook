import type { RespostaConflito, RespostaDados, RespostaSalvar } from '../../src/api/contrato'
import { migrar } from '../../src/logica/armazenamento'
import type { Dados } from '../../src/logica/tipos'
import { validarDados } from '../../src/logica/validacao'
import type { Contexto } from '../contexto'
import { ErroHttp, json, lerObjeto, rota } from '../http'
import { exigirSessao } from '../sessoes'

async function painelDe(ctx: Contexto, usuarioId: string): Promise<RespostaDados> {
  const [linha] = await ctx.banco.consultar('SELECT dados, revisao FROM paineis WHERE usuario_id = $1', [usuarioId])
  if (!linha) return { dados: null, revisao: 0 }
  return { dados: linha.dados as Dados, revisao: Number(linha.revisao) }
}

/** GET e PUT /api/dados: o painel da conta, com a revisão para não sobrescrever o de outro aparelho. */
export const dados = rota({
  async GET(req, ctx) {
    const usuario = await exigirSessao(req, ctx)
    return json(await painelDe(ctx, usuario.id))
  },

  async PUT(req, ctx) {
    const usuario = await exigirSessao(req, ctx)
    const corpo = await lerObjeto(req)
    const revisao = corpo.revisao
    if (typeof revisao !== 'number' || !Number.isSafeInteger(revisao) || revisao < 0) {
      throw new ErroHttp(400, 'pedido-invalido', 'Falta o campo "revisao" (número inteiro, 0 ou mais).')
    }
    // As mesmas conferências do site ao importar: a nuvem nunca guarda o que o painel não abriria.
    const migrado = migrar(corpo.dados)
    const validado = migrado.ok ? validarDados(migrado.valor) : migrado
    if (!validado.ok) throw new ErroHttp(400, 'dados-invalidos', validado.erro)

    const texto = JSON.stringify(validado.valor)
    const agora = ctx.agora().toISOString()
    // Cada caminho é um comando só, que grava apenas se a revisão ainda for a que o
    // aparelho viu: dois aparelhos salvando ao mesmo tempo não se atropelam.
    const gravado =
      revisao === 0
        ? await ctx.banco.consultar(
            `INSERT INTO paineis (usuario_id, dados, revisao, atualizado_em) VALUES ($1, $2::jsonb, 1, $3)
             ON CONFLICT (usuario_id) DO NOTHING RETURNING revisao`,
            [usuario.id, texto, agora],
          )
        : await ctx.banco.consultar(
            `UPDATE paineis SET dados = $1::jsonb, revisao = revisao + 1, atualizado_em = $2
              WHERE usuario_id = $3 AND revisao = $4 RETURNING revisao`,
            [texto, agora, usuario.id, revisao],
          )
    if (gravado.length === 0) {
      const naNuvem = await painelDe(ctx, usuario.id)
      const conflito: RespostaConflito = {
        codigo: 'conflito',
        erro: 'Outro aparelho salvou mudanças antes deste.',
        ...naNuvem,
      }
      return json(conflito, 409)
    }
    const resposta: RespostaSalvar = { revisao: Number(gravado[0].revisao) }
    return json(resposta)
  },
})
