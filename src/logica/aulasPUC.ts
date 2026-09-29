import { minutos } from './horarios'
import type { Horario } from './tipos'

/** Uma aula da tabela de horários da PUC-PR ("2ª aula, 07:50 às 08:35"). */
export interface AulaPUC {
  numero: number
  inicio: string
  fim: string
}

/**
 * As 20 aulas do dia na PUC-PR, como no portal do aluno. Aulas de 45 min, com
 * intervalos entre a 3ª e a 4ª, a 10ª e a 11ª e a 17ª e a 18ª.
 */
export const AULAS_PUC: readonly AulaPUC[] = [
  ['07:05', '07:50'],
  ['07:50', '08:35'],
  ['08:35', '09:20'],
  ['09:40', '10:25'],
  ['10:25', '11:10'],
  ['11:10', '11:55'],
  ['11:55', '12:40'],
  ['12:40', '13:25'],
  ['13:25', '14:10'],
  ['14:10', '14:55'],
  ['15:15', '16:00'],
  ['16:00', '16:45'],
  ['16:45', '17:30'],
  ['17:30', '18:15'],
  ['18:15', '19:00'],
  ['19:00', '19:45'],
  ['19:45', '20:30'],
  ['20:45', '21:30'],
  ['21:30', '22:15'],
  ['22:15', '23:00'],
].map(([inicio, fim], i) => ({ numero: i + 1, inicio, fim }))

/** Quanto o início pode ficar antes da aula da tabela quando o horário não tem fim. */
const TOLERANCIA_MIN = 15

const inicioDaAula = (aula: AulaPUC) => minutos(aula.inicio)!

/**
 * As aulas da tabela (posições em AULAS_PUC) que um horário ocupa: as que COMEÇAM
 * dentro dele. Assim 07:50 às 11:10 dá a 2ª, 3ª, 4ª e 5ª, pulando o intervalo.
 * Horário sem fim (salvo antes de existir o campo) ocupa `aulas` aulas a partir da
 * primeira que começa nele, ou uma só. Horário que não bate com nenhuma aula da
 * tabela (outra instituição, 13:30 às 13:40...) devolve lista vazia.
 */
export function aulasDoHorario(horario: Pick<Horario, 'inicio' | 'fim' | 'aulas'>): number[] {
  const de = minutos(horario.inicio)
  if (de === null) return []
  const ate = horario.fim === undefined ? null : minutos(horario.fim)
  if (ate !== null) {
    return AULAS_PUC.flatMap((aula, i) => (inicioDaAula(aula) >= de && inicioDaAula(aula) < ate ? [i] : []))
  }
  const primeira = AULAS_PUC.findIndex((aula) => inicioDaAula(aula) >= de)
  // Sem o fim, só vale se a aula começa perto do início informado (13:30 não é a aula das 14:10).
  if (primeira === -1 || inicioDaAula(AULAS_PUC[primeira]) - de > TOLERANCIA_MIN) return []
  const quantas = Math.min(horario.aulas ?? 1, AULAS_PUC.length - primeira)
  return Array.from({ length: quantas }, (_, i) => primeira + i)
}
