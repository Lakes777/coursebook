import { faixaHorario, minutos } from '../logica/horarios'
import type { DiaSemana, Horario, Materia } from '../logica/tipos'
import { plural } from '../tema/textos'
import { DIAS_SEMANA } from './novaMateriaUtil'

// Lógica da grade da semana, sem React: junta os horários de todas as matérias por dia.

export interface AulaNaGrade {
  materiaId: string
  materia: string
  horario: Horario
}

export interface DiaNaGrade {
  dia: DiaSemana
  nome: string
  aulas: AulaNaGrade[]
}

/** Hora em minutos para ordenar; hora estragada (não deveria passar da validação) vai para o fim. */
const ordem = (hora: string) => minutos(hora) ?? Number.POSITIVE_INFINITY

/**
 * Os dias da semana com as aulas de cada um, de segunda a sábado (mesmo sem aula,
 * para a grade ter sempre o mesmo formato). O domingo só entra se alguma matéria
 * tiver aula nele. Dentro do dia, pelo início e depois pelo nome da matéria.
 */
export function gradeDaSemana(materias: Materia[]): DiaNaGrade[] {
  const aulas: AulaNaGrade[] = materias.flatMap((m) =>
    m.horarios.map((horario) => ({ materiaId: m.id, materia: m.nome, horario })),
  )
  return DIAS_SEMANA.map(({ dia, nome }) => ({
    dia,
    nome,
    aulas: aulas
      .filter((a) => a.horario.dia === dia)
      .sort(
        (a, b) =>
          ordem(a.horario.inicio) - ordem(b.horario.inicio) || a.materia.localeCompare(b.materia, 'pt-BR'),
      ),
  })).filter((d) => d.dia !== 0 || d.aulas.length > 0)
}

/** "19:00 às 22:30", ou só "19:00" em horário salvo antes de existir o fim. */
export function textoFaixa(horario: Horario): string {
  return faixaHorario({ inicio: horario.inicio, fim: horario.fim })
}

/** "4 aulas", ou null se o horário não diz quantas são. */
export function textoAulas(horario: Horario): string | null {
  return horario.aulas === undefined ? null : `${horario.aulas} ${plural(horario.aulas, 'aula', 'aulas')}`
}
