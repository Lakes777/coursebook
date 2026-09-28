import type { Avaliacao, PontoExtra, RegraAprovacao } from './tipos'

export const NOTA_MAXIMA = 10
export const TAMANHO_MAXIMO_COMENTARIO = 200

export type SituacaoNota =
  | { tipo: 'sem-avaliacoes' }
  /** Já passou, mesmo que tire 0 no que falta. */
  | { tipo: 'aprovado'; media: number }
  /** Ainda dá: precisa de `notaNecessaria` em cada avaliação que falta. */
  | { tipo: 'possivel'; media: number | null; notaNecessaria: number }
  /**
   * Nem com 10 em tudo que falta chega na média. Se a regra tem recuperação e ainda
   * dá para alcançá-la, `notaParaRecuperacao` diz quanto precisa para ter direito a ela.
   */
  | {
      tipo: 'impossivel'
      media: number | null
      notaNecessaria: number
      notaParaRecuperacao?: number
    }
  /** Todas as notas saíram; ficou abaixo da média, mas tem direito à recuperação. */
  | { tipo: 'recuperacao'; media: number; teto: number }
  | { tipo: 'reprovado'; media: number }

/**
 * Tira o "lixo" do ponto flutuante antes de arredondar: no JavaScript,
 * (0.1 + 5.8) / 2 dá 2.9499999999999997, e sem isso 2,95 viraria 2,9.
 */
function limpar(n: number): number {
  return Number(n.toPrecision(12))
}

/** Arredonda para 1 casa, do jeito da escola: 2,95 -> 3,0 e 2,94 -> 2,9. */
export function arredondar(n: number): number {
  return Math.round(limpar(n * 10)) / 10
}

/**
 * Arredonda para CIMA com 1 casa. Usado na nota necessária: se precisa de 6,01,
 * mostrar 6,0 faria o aluno tirar 6,0 e não passar.
 */
export function arredondarParaCima(n: number): number {
  return Math.ceil(limpar(n * 10)) / 10
}

/**
 * Menor nota que, arredondada, dá `nota` (6,95 -> 7,0). Como a média final é
 * arredondada, é essa a meta de verdade: mirar em 7,0 exato pediria mais que o necessário.
 */
function menorQueArredondaPara(nota: number): number {
  return nota - 0.05
}

/** Diz o que está errado numa avaliação, ou null se ela está certa. */
export function erroAvaliacao(avaliacao: Pick<Avaliacao, 'peso' | 'nota'>): string | null {
  const { peso, nota } = avaliacao
  if (!Number.isFinite(peso) || peso < 0) return 'O peso precisa ser um número maior ou igual a 0.'
  if (nota !== null && (!Number.isFinite(nota) || nota < 0 || nota > NOTA_MAXIMA)) {
    return `A nota precisa estar entre 0 e ${NOTA_MAXIMA}.`
  }
  return null
}

/**
 * Diz o que está errado num ponto extra, ou null se ele está certo.
 * O limite do comentário vale para o texto sem espaços nas pontas: quem salva
 * deve guardar `comentario.trim()`.
 */
export function erroPontoExtra(extra: Pick<PontoExtra, 'pontos' | 'comentario'>): string | null {
  const { pontos, comentario } = extra
  if (!Number.isFinite(pontos) || pontos <= 0 || pontos > NOTA_MAXIMA) {
    return `Os pontos extras precisam ser maiores que 0 e no máximo ${NOTA_MAXIMA}.`
  }
  const texto = comentario.trim()
  if (texto === '') return 'Escreva de onde vieram os pontos extras.'
  if (texto.length > TAMANHO_MAXIMO_COMENTARIO) {
    return `O comentário pode ter no máximo ${TAMANHO_MAXIMO_COMENTARIO} caracteres.`
  }
  return null
}

/** Soma dos pontos extras da matéria. */
export function totalPontosExtras(extras: PontoExtra[]): number {
  return limpar(extras.reduce((soma, e) => soma + e.pontos, 0))
}

/**
 * Média ponderada das avaliações com nota, SEM arredondar (null se nenhuma tem).
 * Contas que ainda vão somar algo (como os pontos extras) partem dela: arredondar
 * duas vezes erra (6,66 -> 6,7, + 0,25 = 6,95 -> 7,0, quando o certo é 6,91 -> 6,9).
 */
function mediaExata(avaliacoes: Avaliacao[]): number | null {
  const comNota = avaliacoes.filter((a) => a.nota !== null)
  const somaPesos = comNota.reduce((soma, a) => soma + a.peso, 0)
  if (somaPesos <= 0) return null
  const pontos = comNota.reduce((soma, a) => soma + a.nota! * a.peso, 0)
  return pontos / somaPesos
}

/** Média ponderada das avaliações que já têm nota, com 1 casa (null se nenhuma tem). */
export function mediaPonderada(avaliacoes: Avaliacao[]): number | null {
  const media = mediaExata(avaliacoes)
  return media === null ? null : arredondar(media)
}

/**
 * Situação da matéria pelas notas. `extras` é a soma dos pontos extras, que entra
 * na média final (com teto de 10); `media` já vem com eles somados.
 * Avaliações inválidas (veja `erroAvaliacao`) devem ser barradas antes, no
 * formulário e ao carregar os dados.
 */
export function situacaoNota(
  avaliacoes: Avaliacao[],
  regra: RegraAprovacao,
  extras = 0,
): SituacaoNota {
  const somaPesos = avaliacoes.reduce((soma, a) => soma + a.peso, 0)
  if (avaliacoes.length === 0 || somaPesos <= 0) return { tipo: 'sem-avaliacoes' }

  // Avaliação de peso 0 não muda a média, então não conta como "falta fazer".
  const pendentes = avaliacoes.filter((a) => a.nota === null && a.peso > 0)
  const pesoPendente = pendentes.reduce((soma, a) => soma + a.peso, 0)
  const pontos = avaliacoes.reduce((soma, a) => soma + (a.nota ?? 0) * a.peso, 0)
  const comExtras = (nota: number) => Math.min(NOTA_MAXIMA, limpar(nota + extras))
  const exata = mediaExata(avaliacoes)
  const media = exata === null ? null : arredondar(comExtras(exata))

  // Nota final contando 0 no que falta: se já alcança a média, está garantido.
  const garantida = arredondar(comExtras(pontos / somaPesos))
  const rec = regra.recuperacao

  if (pendentes.length === 0) {
    if (garantida >= regra.mediaMinima) return { tipo: 'aprovado', media: garantida }
    if (rec && garantida >= rec.notaMinima) {
      return { tipo: 'recuperacao', media: garantida, teto: rec.teto }
    }
    return { tipo: 'reprovado', media: garantida }
  }

  if (garantida >= regra.mediaMinima) return { tipo: 'aprovado', media: media ?? garantida }

  /** Quanto precisa em cada avaliação pendente para a média final chegar em `alvo`. */
  const precisaPara = (alvo: number) =>
    arredondarParaCima(
      ((menorQueArredondaPara(alvo) - extras) * somaPesos - pontos) / pesoPendente,
    )

  const notaNecessaria = precisaPara(regra.mediaMinima)
  if (notaNecessaria <= NOTA_MAXIMA) return { tipo: 'possivel', media, notaNecessaria }

  if (rec) {
    const notaParaRecuperacao = Math.max(0, precisaPara(rec.notaMinima))
    if (notaParaRecuperacao <= NOTA_MAXIMA) {
      return { tipo: 'impossivel', media, notaNecessaria, notaParaRecuperacao }
    }
  }
  return { tipo: 'impossivel', media, notaNecessaria }
}
