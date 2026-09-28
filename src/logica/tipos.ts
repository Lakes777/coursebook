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
 * nota >= 7,0 e frequência >= 75%; quem fica entre 4,0 e 6,9 pode fazer recuperação
 * dos RAs abaixo de 7,0, e a nota de recuperação vale no máximo 7,0.
 */
export interface RegraAprovacao {
  mediaMinima: number
  /** Fração de 0 a 1 (0.75 = 75%). */
  frequenciaMinima: number
  /** Sem este campo, a matéria não tem recuperação. */
  recuperacao?: {
    /** Nota final mínima para ter direito à recuperação. */
    notaMinima: number
    /** Maior nota que a recuperação pode dar a um RA. */
    teto: number
  }
  /**
   * Arredonda a nota final para 1 casa antes de comparar (6,95 -> 7,0 e passa).
   * Os planos de ensino não falam disso, então o padrão é não arredondar.
   */
  arredondarUmaCasa: boolean
}

/** Uma avaliação que dá nota (prova, projeto, apresentação...). */
export interface Avaliacao {
  id: string
  nome: string
  /** Peso dentro do RA. Planos que não dizem: pesos iguais. */
  peso: number
  /** Quanto a avaliação vale: 10 na maioria; 3,0 numa prova "que vale 3 pontos". */
  valorMaximo: number
  /** Na mesma escala do valorMaximo; null enquanto a nota não saiu. */
  nota: number | null
  data?: DataISO
}

/**
 * Resultado de Aprendizagem. Na PUC-PR a nota de cada RA sai das avaliações dele,
 * e a nota final é a média ponderada dos RAs (ex.: RA1 20%, RA2 30%, RA3 50%).
 */
export interface ResultadoAprendizagem {
  id: string
  nome: string
  /** Peso do RA na nota final. */
  peso: number
  avaliacoes: Avaliacao[]
  /**
   * Se o plano de ensino prevê recuperação deste RA DURANTE o semestre (em geral só
   * um RA tem). Só informa a tela: a recuperação estendida, no fim, vale para todo RA
   * abaixo da média, então a conta não depende deste campo.
   */
  recuperacaoNoSemestre: boolean
  /** Nota da recuperação (0 a 10), quando feita. Vale a maior entre ela e a do RA. */
  notaRecuperacao: number | null
}

/**
 * Pontos extras dados pelo professor fora das avaliações oficiais (ex.: 0,3 por
 * uma lista de exercícios). Somam na média final, e o comentário diz de onde vieram.
 */
export interface PontoExtra {
  id: string
  pontos: number
  comentario: string
  data?: DataISO
}

export interface Falta {
  id: string
  data: DataISO
  /** Quantas aulas de 45 min foram perdidas no dia (manhã com 3 aulas = 3). */
  quantidade: number
}

export interface Materia {
  id: string
  nome: string
  professor: string
  horarios: Horario[]
  /**
   * Carga horária do plano de ensino em horas-aula (aulas de 45 min). Cada aula
   * perdida é uma falta, então este é o total de aulas e a base do limite de faltas.
   */
  cargaHoraria: number
  ras: ResultadoAprendizagem[]
  pontosExtras: PontoExtra[]
  faltas: Falta[]
  /** Sem este campo, vale a regra padrão do painel. */
  regra?: RegraAprovacao
}

export type TipoEvento = 'prova' | 'trabalho' | 'apresentacao'

export interface Evento {
  id: string
  materiaId?: string
  titulo: string
  tipo: TipoEvento
  data: DataISO
  concluido: boolean
}

/** Versão do formato de Dados. Ao mudar o formato, aumentar e escrever a migração em armazenamento.ts. */
export const VERSAO_ATUAL = 1

export interface Dados {
  versao: typeof VERSAO_ATUAL
  materias: Materia[]
  eventos: Evento[]
  regraPadrao: RegraAprovacao
}

export const REGRA_PUCPR: RegraAprovacao = {
  mediaMinima: 7,
  frequenciaMinima: 0.75,
  recuperacao: { notaMinima: 4, teto: 7 },
  arredondarUmaCasa: false,
}
