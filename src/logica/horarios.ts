import { MAXIMO_AULAS_POR_DIA } from './faltas'
import type { DiaSemana, Horario } from './tipos'

/** Duração de uma aula (hora-aula) na PUC-PR, em minutos. */
export const MINUTOS_POR_AULA = 45

/** Hora no formato "HH:MM" (00:00 a 23:59). */
export const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

/** "19:30" -> 1170 (minutos desde a meia-noite), ou null se não for uma hora. */
export function minutos(hora: string): number | null {
  if (!HORA.test(hora)) return null
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/**
 * Quantas aulas de 45 min cabem entre o início e o fim: 19:00 a 22:30 dá 4 (com o
 * intervalo, sobram minutos). É só sugestão: a pessoa corrige se o intervalo for outro.
 * Null se o fim não vem depois do início.
 */
export function sugerirAulas(inicio: string, fim: string): number | null {
  const de = minutos(inicio)
  const ate = minutos(fim)
  if (de === null || ate === null || ate <= de) return null
  return Math.min(MAXIMO_AULAS_POR_DIA, Math.max(1, Math.floor((ate - de) / MINUTOS_POR_AULA)))
}

/**
 * Diz o que está errado no fim e nas aulas de um horário, ou null. Os dois são
 * opcionais nos dados (horários salvos antes de existirem continuam valendo).
 */
export function erroHorario(horario: Pick<Horario, 'inicio' | 'fim' | 'aulas'>): string | null {
  const { inicio, fim, aulas } = horario
  if (fim !== undefined) {
    const de = minutos(inicio)
    const ate = minutos(fim)
    if (ate === null) return 'O fim precisa estar no formato HH:MM (ex.: 22:30).'
    if (de !== null && ate <= de) return 'A aula precisa terminar depois de começar.'
  }
  if (aulas !== undefined && (!Number.isInteger(aulas) || aulas < 1 || aulas > MAXIMO_AULAS_POR_DIA)) {
    return `O número de aulas precisa ser um inteiro de 1 a ${MAXIMO_AULAS_POR_DIA}.`
  }
  return null
}

/** "19:00 às 22:30 (4 aulas)", ou só "19:00" em horário salvo antes de existir o fim. */
export function faixaHorario(h: Pick<Horario, 'inicio' | 'fim' | 'aulas'>): string {
  const faixa = h.fim ? `${h.inicio} às ${h.fim}` : h.inicio
  if (h.aulas === undefined) return faixa
  return `${faixa} (${h.aulas} ${h.aulas === 1 ? 'aula' : 'aulas'})`
}

/**
 * Quantas aulas a matéria tem nesse dia da semana (somando se houver dois horários
 * no mesmo dia). Horário sem o número de aulas conta 1. Zero se não tem aula no dia.
 */
export function aulasNoDia(horarios: Horario[], dia: DiaSemana): number {
  return horarios.filter((h) => h.dia === dia).reduce((soma, h) => soma + (h.aulas ?? 1), 0)
}
