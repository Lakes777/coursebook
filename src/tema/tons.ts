import type { Destaque } from '../logica/eventos'
import type { NivelFaltas } from '../logica/faltas'
import type { SituacaoNota } from '../logica/notas'

/**
 * As cores que a tela usa para dizer como as coisas vão: verde (ok), amarelo
 * (atenção), vermelho (perigo) e cinza (neutro). O destaque, no tom do bordô da
 * PUC, é para o que pede atenção sem ser problema: um prazo chegando.
 */
export const TONS = ['ok', 'destaque', 'atencao', 'perigo', 'neutro'] as const

/** O tipo sai da lista, para as duas nunca ficarem diferentes. */
export type Tom = (typeof TONS)[number]

export function tomNota(situacao: SituacaoNota): Tom {
  switch (situacao.tipo) {
    case 'aprovado':
      return 'ok'
    case 'possivel':
    case 'sem-avaliacoes':
      return 'neutro'
    case 'recuperacao':
      return 'atencao'
    case 'impossivel':
      // Ainda dá para ir para a recuperação: é sério, mas não é o fim.
      return situacao.notaParaRecuperacao === undefined ? 'perigo' : 'atencao'
    case 'reprovado':
      return 'perigo'
  }
}

export function tomFaltas(nivel: NivelFaltas): Tom {
  switch (nivel) {
    case 'ok':
      return 'ok'
    case 'atencao':
      return 'atencao'
    case 'reprovado':
      return 'perigo'
    case 'sem-carga-horaria':
      return 'neutro'
  }
}

export function tomPrazo(destaque: Destaque): Tom {
  switch (destaque) {
    case 'atrasado':
      return 'perigo'
    case 'hoje':
      return 'atencao'
    case 'proximo':
      return 'destaque'
    case 'concluido':
      return 'ok'
    case 'futuro':
      return 'neutro'
  }
}
