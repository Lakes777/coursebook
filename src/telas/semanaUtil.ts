import { AULAS_PUC, aulasDoHorario, type AulaPUC } from '../logica/aulasPUC'
import { faixaHorario, minutos } from '../logica/horarios'
import type { DiaSemana, Horario, Materia } from '../logica/tipos'
import { DIAS_SEMANA } from './novaMateriaUtil'

// Lógica da grade da semana, sem React: põe os horários das matérias nas aulas da
// tabela da PUC-PR (1ª a 20ª), como a grade do portal do aluno.

export interface AulaNaGrade {
  materiaId: string
  materia: string
  professor: string
  horario: Horario
}

export interface DiaNaGrade {
  dia: DiaSemana
  nome: string
}

/** Uma linha da grade: uma aula da tabela e, para cada dia (na ordem de `dias`), as matérias nela. */
export interface LinhaDaGrade {
  tipo: 'aula'
  aula: AulaPUC
  celulas: AulaNaGrade[][]
}

/** Duas ou mais aulas seguidas sem nada em nenhum dia (manhã e noite): viram uma linha só. */
export interface LinhaVazia {
  tipo: 'vazio'
  /** Do fim da última aula ocupada ao começo da próxima: "Sem aulas das 11:10 às 19:00". */
  de: string
  ate: string
}

export interface Grade {
  dias: DiaNaGrade[]
  /**
   * Da primeira à última aula ocupada na semana. Uma aula vazia no meio aparece
   * (como no portal); duas ou mais seguidas viram uma LinhaVazia.
   */
  linhas: (LinhaDaGrade | LinhaVazia)[]
  /** Horários que não batem com nenhuma aula da tabela: aparecem numa lista à parte, para não sumirem. */
  foraDaGrade: (AulaNaGrade & { nomeDia: string })[]
}

const porNome = (a: AulaNaGrade, b: AulaNaGrade) => a.materia.localeCompare(b.materia, 'pt-BR')

/**
 * Monta a grade. Segunda a sexta aparecem sempre; sábado e domingo, só se alguma
 * matéria tiver aula neles. Cada aula da tabela ocupada por uma matéria mostra o
 * nome dela, então uma matéria de 4 aulas aparece em 4 linhas, como no portal.
 */
export function gradeDaSemana(materias: Materia[]): Grade {
  const usados = new Set(materias.flatMap((m) => m.horarios.map((h) => h.dia)))
  const dias = DIAS_SEMANA.filter(({ dia }) => (dia >= 1 && dia <= 5) || usados.has(dia))

  // "dia-posição da aula" -> matérias nessa aula.
  const ocupadas = new Map<string, AulaNaGrade[]>()
  const foraDaGrade: Grade['foraDaGrade'] = []
  let primeira = Infinity
  let ultima = -Infinity
  for (const m of materias) {
    for (const horario of m.horarios) {
      const aula: AulaNaGrade = { materiaId: m.id, materia: m.nome, professor: m.professor, horario }
      const posicoes = aulasDoHorario(horario)
      if (posicoes.length === 0) {
        foraDaGrade.push({ ...aula, nomeDia: DIAS_SEMANA.find((d) => d.dia === horario.dia)?.nome ?? '' })
        continue
      }
      for (const i of posicoes) {
        const chave = `${horario.dia}-${i}`
        ocupadas.set(chave, [...(ocupadas.get(chave) ?? []), aula])
        primeira = Math.min(primeira, i)
        ultima = Math.max(ultima, i)
      }
    }
  }

  const cheias: LinhaDaGrade[] = []
  for (let i = primeira; i <= ultima; i++) {
    cheias.push({
      tipo: 'aula',
      aula: AULAS_PUC[i],
      celulas: dias.map(({ dia }) => [...(ocupadas.get(`${dia}-${i}`) ?? [])].sort(porNome)),
    })
  }
  const vazia = (l: LinhaDaGrade) => l.celulas.every((c) => c.length === 0)
  const linhas: Grade['linhas'] = []
  for (let i = 0; i < cheias.length; ) {
    let fim = i
    while (fim < cheias.length && vazia(cheias[fim])) fim++
    if (fim - i >= 2) {
      // A primeira e a última linha nunca são vazias, então sempre há vizinhas.
      linhas.push({ tipo: 'vazio', de: cheias[i - 1].aula.fim, ate: cheias[fim].aula.inicio })
      i = fim
    } else {
      linhas.push(cheias[i])
      i++
    }
  }

  const ordemDia = (dia: DiaSemana) => DIAS_SEMANA.findIndex((d) => d.dia === dia)
  foraDaGrade.sort(
    (a, b) =>
      ordemDia(a.horario.dia) - ordemDia(b.horario.dia) ||
      (minutos(a.horario.inicio) ?? 0) - (minutos(b.horario.inicio) ?? 0) ||
      porNome(a, b),
  )
  return { dias, linhas, foraDaGrade }
}

/** "2ª aula" */
export const nomeAula = (aula: AulaPUC) => `${aula.numero}ª aula`

/** "07:50 às 08:35" */
export const faixaAula = (aula: AulaPUC) => faixaHorario({ inicio: aula.inicio, fim: aula.fim })

/** "19:00 às 22:30", ou só "19:00" em horário salvo antes de existir o fim. */
export function textoFaixa(horario: Horario): string {
  return faixaHorario({ inicio: horario.inicio, fim: horario.fim })
}

/**
 * A aula da tabela que está acontecendo no momento `agora` (do início, inclusive, ao
 * fim, exclusive), ou null no intervalo e fora do horário de aulas.
 */
export function aulaDeAgora(agora: Date): AulaPUC | null {
  const minuto = agora.getHours() * 60 + agora.getMinutes()
  return AULAS_PUC.find((a) => minutos(a.inicio)! <= minuto && minuto < minutos(a.fim)!) ?? null
}
