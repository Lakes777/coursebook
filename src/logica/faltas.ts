import { dataValida } from './datas'
import { limpar } from './numeros'
import type { Falta } from './tipos'

/** Mais aulas que isso num dia só é quase certamente erro de digitação. */
export const MAXIMO_AULAS_POR_DIA = 12

/** A partir de quanto do limite o painel começa a avisar (0.75 = 75% do limite usado). */
export const ALERTA_A_PARTIR_DE = 0.75

export type NivelFaltas =
  /** A matéria não tem carga horária, então não dá para calcular o limite. */
  | 'sem-carga-horaria'
  | 'ok'
  /** Perto do limite (ou exatamente nele: não pode faltar mais nenhuma aula). */
  | 'atencao'
  /** Passou do limite: frequência abaixo da mínima. */
  | 'reprovado'

export interface SituacaoFaltas {
  total: number
  /** Quantas faltas pode ter no semestre sem reprovar. */
  limite: number
  /** Quantas aulas ainda pode faltar (negativo se já passou). */
  restantes: number
  /** Fração de 0 a 1 das aulas assistidas; null sem carga horária. */
  frequencia: number | null
  nivel: NivelFaltas
}

/**
 * Quantas aulas pode faltar: 25% da carga horária com frequência mínima de 75%.
 * Arredonda para baixo, porque faltar uma aula a mais já deixa abaixo do mínimo.
 */
export function limiteFaltas(cargaHoraria: number, frequenciaMinima: number): number {
  if (cargaHoraria <= 0) return 0
  return Math.floor(limpar(cargaHoraria * (1 - frequenciaMinima)))
}

export function totalFaltas(faltas: Falta[]): number {
  return faltas.reduce((soma, f) => soma + f.quantidade, 0)
}

export function situacaoFaltas(
  faltas: Falta[],
  cargaHoraria: number,
  frequenciaMinima: number,
): SituacaoFaltas {
  const total = totalFaltas(faltas)
  if (cargaHoraria <= 0) {
    return { total, limite: 0, restantes: 0, frequencia: null, nivel: 'sem-carga-horaria' }
  }
  const limite = limiteFaltas(cargaHoraria, frequenciaMinima)
  const restantes = limite - total
  const frequencia = Math.max(0, (cargaHoraria - total) / cargaHoraria)

  let nivel: NivelFaltas = 'ok'
  if (total > limite) nivel = 'reprovado'
  // Inclui o limite exato (e o limite 0 de matérias curtas): não pode faltar mais.
  else if (total >= limite * ALERTA_A_PARTIR_DE) nivel = 'atencao'

  return { total, limite, restantes, frequencia, nivel }
}

/** Diz o que está errado numa falta, ou null se ela está certa. */
export function erroFalta(falta: Pick<Falta, 'data' | 'quantidade'>): string | null {
  if (!dataValida(falta.data)) return 'Informe uma data válida.'
  const { quantidade } = falta
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAXIMO_AULAS_POR_DIA) {
    return `A quantidade de aulas precisa ser um número inteiro de 1 a ${MAXIMO_AULAS_POR_DIA}.`
  }
  return null
}

/** Diz o que está errado na carga horária de uma matéria, ou null. */
export function erroCargaHoraria(cargaHoraria: number): string | null {
  if (!Number.isInteger(cargaHoraria) || cargaHoraria < 0) {
    return 'A carga horária precisa ser um número inteiro de aulas (0 se não souber).'
  }
  return null
}
