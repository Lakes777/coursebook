import { LIMITES, type RespostaPrazos } from '../../src/api/contrato'
import { migrar } from '../../src/logica/armazenamento'
import { hojeNoFuso, prazos as calcularPrazos, somarDias } from '../../src/logica/prazos'
import { validarDados } from '../../src/logica/validacao'
import { exigirChave } from '../chaves'
import type { Contexto } from '../contexto'
import { ErroHttp, json, rota } from '../http'

/** O ?dias= do pedido: inteiro de LIMITES.diasPrazosMinimo a diasPrazosMaximo; sem ele, o padrão. */
function lerDias(req: Request): number {
  const bruto = new URL(req.url).searchParams.get('dias')
  if (bruto === null || bruto === '') return LIMITES.diasPrazosPadrao
  const dias = /^\d{1,3}$/.test(bruto) ? Number(bruto) : NaN
  if (!(dias >= LIMITES.diasPrazosMinimo && dias <= LIMITES.diasPrazosMaximo)) {
    throw new ErroHttp(
      400,
      'pedido-invalido',
      `O parâmetro "dias" tem que ser um número inteiro de ${LIMITES.diasPrazosMinimo} a ${LIMITES.diasPrazosMaximo}.`,
    )
  }
  return dias
}

async function painelDe(ctx: Contexto, usuarioId: string) {
  const [linha] = await ctx.banco.consultar('SELECT dados FROM paineis WHERE usuario_id = $1', [usuarioId])
  if (!linha) return null
  // O que está no banco já passou pela validação ao salvar; passa de novo para uma
  // versão antiga dos dados chegar migrada às contas.
  const migrado = migrar(linha.dados)
  const validado = migrado.ok ? validarDados(migrado.valor) : migrado
  if (!validado.ok) throw new Error(`Painel salvo que não abre: ${validado.erro}`)
  return validado.valor
}

/**
 * GET /api/prazos?dias=7: provas, trabalhos, apresentações e avaliações sem nota de
 * hoje (fuso de Brasília) até daqui a `dias` dias. A única rota que aceita chave de
 * acesso, e só a chave: só lê, e não tem nenhum outro método.
 */
export const prazos = rota(
  {
    async GET(req, ctx) {
      const usuarioId = await exigirChave(req, ctx)
      const dias = lerDias(req)
      const hoje = hojeNoFuso(ctx.agora())
      const dados = await painelDe(ctx, usuarioId)
      const resposta: RespostaPrazos = {
        hoje,
        ate: somarDias(hoje, dias),
        dias,
        prazos: dados ? calcularPrazos(dados, hoje, dias) : [],
      }
      return json(resposta)
    },
  },
  { aceitaChave: true },
)
