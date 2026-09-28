// Tipos do painel. Ficam aqui, sem React, para a lógica poder ser testada sozinha.

/** Data sem hora, no formato "AAAA-MM-DD" (ex.: "2026-10-05"). */
export type DataISO = string

/** 0 = domingo, 1 = segunda ... 6 = sábado (igual ao Date.getDay()). */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Horario {
  dia: DiaSemana
  /** Hora de início, "HH:MM". */
  inicio: string
}

/**
 * Regra para passar na matéria. O padrão segue a PUC-PR (Resolução 414/2024-CONSUN):
 * nota >= 7,0 e frequência >= 75%; quem fica entre 4,0 e 6,9 pode fazer recuperação,
 * e a nota depois dela vale no máximo 7,0.
 */
export interface RegraAprovacao {
  mediaMinima: number
  /** Fração de 0 a 1 (0.75 = 75%). */
  frequenciaMinima: number
  /** Sem este campo, a matéria não tem recuperação. */
  recuperacao?: {
    /** Nota mínima para ter direito à recuperação. */
    notaMinima: number
    /** Maior nota possível depois da recuperação. */
    teto: number
  }
}

export interface Avaliacao {
  id: string
  nome: string
  peso: number
  /** null enquanto a nota não saiu. */
  nota: number | null
  data?: DataISO
}

export interface Falta {
  id: string
  data: DataISO
  /** Quantas aulas foram perdidas no dia (aula dupla = 2). */
  quantidade: number
}

export interface Materia {
  id: string
  nome: string
  professor: string
  horarios: Horario[]
  /** Total de aulas no semestre; é a base do limite de faltas. */
  totalAulas: number
  avaliacoes: Avaliacao[]
  faltas: Falta[]
  /** Sem este campo, vale a regra padrão do painel. */
  regra?: RegraAprovacao
}

export type TipoEvento = 'prova' | 'trabalho'

export interface Evento {
  id: string
  materiaId?: string
  titulo: string
  tipo: TipoEvento
  data: DataISO
  concluido: boolean
}

export interface Dados {
  versao: 1
  materias: Materia[]
  eventos: Evento[]
  regraPadrao: RegraAprovacao
}

export const REGRA_PUCPR: RegraAprovacao = {
  mediaMinima: 7,
  frequenciaMinima: 0.75,
  recuperacao: { notaMinima: 4, teto: 7 },
}
