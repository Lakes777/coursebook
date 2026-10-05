import { textoPrazo, type EventoNaAgenda } from '../logica/eventos'
import type { SituacaoFaltas } from '../logica/faltas'
import { situacaoFaltas } from '../logica/faltas'
import type { SituacaoNota } from '../logica/notas'
import { extrasDaNotaFinal, extrasPorRA, situacaoNota, totalPontosExtras } from '../logica/notas'
import { formatarNota } from '../logica/numeros'
import type { Materia, RegraAprovacao } from '../logica/tipos'
import { tomFaltas, tomNota } from './tons'

// Frases curtas das situações, iguais em todas as telas (lista, detalhe).

export interface Resumo {
  regra: RegraAprovacao
  nota: SituacaoNota
  faltas: SituacaoFaltas
}

/** Tudo o que a tela precisa saber de uma matéria, com a regra dela ou a padrão. */
export function resumoMateria(materia: Materia, regraPadrao: RegraAprovacao): Resumo {
  const regra = materia.regra ?? regraPadrao
  return {
    regra,
    nota: situacaoNota(
      materia.ras,
      regra,
      totalPontosExtras(extrasDaNotaFinal(materia.pontosExtras)),
      extrasPorRA(materia.ras, materia.pontosExtras),
    ),
    faltas: situacaoFaltas(materia.faltas, materia.cargaHoraria, regra.frequenciaMinima),
  }
}

export function textoNota(situacao: SituacaoNota): string {
  switch (situacao.tipo) {
    case 'sem-avaliacoes':
      return 'Sem avaliações'
    case 'aprovado':
      // Com avaliação pendente, a média de agora pode cair; o que vale é a garantida.
      return situacao.fechada
        ? `Aprovado com ${formatarNota(situacao.media)}`
        : `Já passou: garante ${formatarNota(situacao.garantida)}`
    case 'possivel':
      // "(de 10)": numa prova que vale 3,0, "6,6" seria lido como pontos da prova.
      return `Precisa de ${formatarNota(situacao.notaNecessaria)} (de 10) no que falta`
    case 'impossivel':
      return situacao.notaParaRecuperacao === undefined
        ? 'Não alcança a média'
        : situacao.notaParaRecuperacao === 0
          ? 'Vai para a recuperação'
          : `Precisa de ${formatarNota(situacao.notaParaRecuperacao)} (de 10) para a recuperação`
    case 'recuperacao':
      return 'Em recuperação'
    case 'reprovado':
      return `Reprovado com ${formatarNota(situacao.media)}`
  }
}

/** "3 de 20 faltas". Aulas, não dias: um dia com 3 aulas são 3 faltas. */
export function textoFaltas(situacao: SituacaoFaltas): string {
  if (situacao.nivel === 'sem-carga-horaria') {
    return situacao.total === 0 ? 'Sem carga horária' : `${situacao.total} ${plural(situacao.total, 'falta', 'faltas')}`
  }
  if (situacao.nivel === 'reprovado') return `Reprovado por faltas (${situacao.total} de ${situacao.limite})`
  return `${situacao.total} de ${situacao.limite} ${plural(situacao.limite, 'falta', 'faltas')}`
}

/** As matérias que pedem atenção: nota ou faltas em amarelo ou vermelho. */
function pedeAtencao({ nota, faltas }: Resumo): boolean {
  const tons = [tomNota(nota), tomFaltas(faltas.nivel)]
  return tons.includes('atencao') || tons.includes('perigo')
}

/**
 * As partes da linha de resumo da lista: ["3 matérias", "1 aprovada", "1 em andamento",
 * "1 pede atenção"] (a tela junta com " · ", sem quebrar a linha no meio de uma parte).
 * Cada matéria conta uma vez só; a que pede atenção (pela nota ou pelas faltas) não
 * conta como aprovada nem em andamento. Grupos sem matéria ficam de fora.
 */
export function resumoSemestre(resumos: Resumo[]): string[] {
  let aprovadas = 0
  let andamento = 0
  let atencao = 0
  for (const resumo of resumos) {
    if (pedeAtencao(resumo)) atencao++
    else if (tomNota(resumo.nota) === 'ok') aprovadas++
    else andamento++
  }
  const partes = [`${resumos.length} ${plural(resumos.length, 'matéria', 'matérias')}`]
  if (aprovadas > 0) partes.push(`${aprovadas} ${plural(aprovadas, 'aprovada', 'aprovadas')}`)
  if (andamento > 0) partes.push(`${andamento} em andamento`)
  if (atencao > 0) partes.push(`${atencao} ${plural(atencao, 'pede', 'pedem')} atenção`)
  return partes
}

export function plural(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios
}

/**
 * Texto do selo de cada item. O que está longe (futuro) não ganha selo: a data e o
 * "em 20 dias" ao lado já dizem tudo, e um selo em cada linha tiraria a força dos outros.
 * Anda junto com textoPrazoAoLado: se o selo de hoje/próximo deixar de dizer o prazo,
 * o texto ao lado tem de voltar.
 */
export function textoSelo(item: Pick<EventoNaAgenda, 'destaque' | 'dias'>): string | null {
  switch (item.destaque) {
    case 'atrasado':
      return 'Atrasado'
    case 'hoje':
      return 'Hoje'
    case 'proximo':
      return item.dias === 1 ? 'Amanhã' : `Em ${item.dias} dias`
    case 'concluido':
      return 'Concluído'
    case 'futuro':
      return null
  }
}

/**
 * O prazo escrito depois da data ("em 20 dias", "há 3 dias"), ou null quando o selo
 * do item já diz o mesmo (hoje, amanhã, em 5 dias): sem isso o prazo aparecia duas
 * vezes no mesmo item, na Agenda e em Próximos prazos.
 */
export function textoPrazoAoLado(item: Pick<EventoNaAgenda, 'destaque' | 'dias'>): string | null {
  return item.destaque === 'hoje' || item.destaque === 'proximo' ? null : textoPrazo(item.dias)
}
