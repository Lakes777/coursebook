import { limpar } from './numeros'
import type { Avaliacao, PontoExtra, RegraAprovacao, ResultadoAprendizagem } from './tipos'

/** As notas de RA, a nota final e a "nota necessária" ficam sempre de 0 a 10. */
export const NOTA_MAXIMA = 10
export const TAMANHO_MAXIMO_COMENTARIO = 200

export type SituacaoNota =
  /** A matéria ainda não tem nenhum RA com peso. */
  | { tipo: 'sem-avaliacoes' }
  /**
   * Já passou, mesmo que tire 0 no que falta. `media` é a média do que já saiu;
   * `garantida` é a nota final contando 0 no que falta (a que ninguém tira dele);
   * `fechada` diz se todas as notas saíram (aí as duas são iguais).
   */
  | { tipo: 'aprovado'; media: number; garantida: number; fechada: boolean }
  /** Ainda dá: precisa de `notaNecessaria` (de 0 a 10) em cada avaliação que falta. */
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
  /**
   * Todas as notas saíram; ficou abaixo da média, mas tem direito à recuperação.
   * `ras` são os ids dos RAs abaixo da média que ainda não foram recuperados.
   */
  | { tipo: 'recuperacao'; media: number; teto: number; ras: string[] }
  | { tipo: 'reprovado'; media: number }

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
 * Corta (sem arredondar) em 2 casas: 6,996 -> 6,99. Quando a matéria não arredonda,
 * a nota aparece assim, para nunca mostrar "7,00" a quem ainda não chegou em 7.
 */
export function truncar(n: number): number {
  return Math.floor(limpar(n * 100)) / 100
}

/** Como a nota aparece na tela, de acordo com a regra da matéria. */
function paraExibir(n: number, regra: RegraAprovacao): number {
  return regra.arredondarUmaCasa ? arredondar(n) : truncar(n)
}

/** Se a nota alcança `minimo`, arredondando ou não conforme a regra. */
function alcanca(nota: number, minimo: number, regra: RegraAprovacao): boolean {
  return (regra.arredondarUmaCasa ? arredondar(nota) : limpar(nota)) >= minimo
}

/**
 * Menor nota exata que alcança `minimo`. Com arredondamento, 6,95 já vira 7,0;
 * mirar em 7,0 exato pediria mais que o necessário.
 */
function meta(minimo: number, regra: RegraAprovacao): number {
  return regra.arredondarUmaCasa ? minimo - 0.05 : minimo
}

/** Diz o que está errado numa avaliação, ou null se ela está certa. */
export function erroAvaliacao(
  avaliacao: Pick<Avaliacao, 'peso' | 'valorMaximo' | 'nota'>,
): string | null {
  const { peso, valorMaximo, nota } = avaliacao
  if (!Number.isFinite(peso) || peso < 0) return 'O peso precisa ser um número maior ou igual a 0.'
  if (!Number.isFinite(valorMaximo) || valorMaximo <= 0) {
    return 'O valor da avaliação precisa ser maior que 0.'
  }
  if (nota !== null && (!Number.isFinite(nota) || nota < 0 || nota > valorMaximo)) {
    return `A nota precisa estar entre 0 e ${valorMaximo}.`
  }
  return null
}

/** Diz o que está errado num RA (sem olhar as avaliações dele), ou null. */
export function erroRA(ra: Pick<ResultadoAprendizagem, 'peso' | 'notaRecuperacao'>): string | null {
  if (!Number.isFinite(ra.peso) || ra.peso < 0) return 'O peso do RA precisa ser maior ou igual a 0.'
  const rec = ra.notaRecuperacao
  if (rec !== null && (!Number.isFinite(rec) || rec < 0 || rec > NOTA_MAXIMA)) {
    return `A nota da recuperação precisa estar entre 0 e ${NOTA_MAXIMA}.`
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

/** Nota de 0 a 10 de uma avaliação: 2,4 de 3,0 vira 8,0. */
export function notaDe0a10(avaliacao: Pick<Avaliacao, 'nota' | 'valorMaximo'>): number | null {
  if (avaliacao.nota === null) return null
  return limpar((avaliacao.nota / avaliacao.valorMaximo) * NOTA_MAXIMA)
}

/** Nota de 0 a 10 levada para a escala da avaliação: 7,0 numa prova de 3,0 vira 2,1. */
export function naEscala(nota: number, valorMaximo: number): number {
  return limpar((nota * valorMaximo) / NOTA_MAXIMA)
}

/**
 * Média exata (sem arredondar) do RA, de 0 a 10. Com `pendentesComoZero`, as
 * avaliações sem nota contam 0; sem, só as com nota contam. Null se não há o que contar.
 */
function mediaDoRA(ra: ResultadoAprendizagem, pendentesComoZero: boolean): number | null {
  const contam = ra.avaliacoes.filter((a) => a.peso > 0 && (pendentesComoZero || a.nota !== null))
  const somaPesos = contam.reduce((soma, a) => soma + a.peso, 0)
  if (somaPesos <= 0) return null
  const pontos = contam.reduce((soma, a) => soma + (notaDe0a10(a) ?? 0) * a.peso, 0)
  return pontos / somaPesos
}

/** Se o RA já teve a recuperação lançada (e a regra tem recuperação). */
function foiRecuperado(ra: ResultadoAprendizagem, regra: RegraAprovacao): boolean {
  return ra.notaRecuperacao !== null && regra.recuperacao !== undefined
}

/** Aplica a recuperação: vale a maior entre a nota e a recuperação (com teto). */
function comRecuperacao(
  nota: number | null,
  ra: ResultadoAprendizagem,
  regra: RegraAprovacao,
): number | null {
  if (ra.notaRecuperacao === null || !regra.recuperacao) return nota
  const recuperada = Math.min(ra.notaRecuperacao, regra.recuperacao.teto)
  return Math.max(nota ?? 0, recuperada)
}

/**
 * Nota do RA de 0 a 10, como aparece na tela: média ponderada das avaliações com
 * nota, e com a recuperação aplicada. Null se nenhuma nota saiu. Um RA recuperado
 * está fechado: avaliação dele que ficou sem nota conta 0, igual na nota final.
 */
export function notaRA(ra: ResultadoAprendizagem, regra: RegraAprovacao): number | null {
  const nota = comRecuperacao(mediaDoRA(ra, foiRecuperado(ra, regra)), ra, regra)
  return nota === null ? null : paraExibir(nota, regra)
}

/**
 * Uma fatia da nota final. `peso` é a fração da nota final (todas somam 1) e `nota`
 * vai de 0 a 10 (null se ainda não saiu). A prova de peso 30% dentro de um RA que
 * vale 50% vira uma fatia de peso 0,15.
 */
interface Fatia {
  peso: number
  nota: number | null
}

function fatias(ras: ResultadoAprendizagem[], regra: RegraAprovacao): Fatia[] {
  const comPeso = ras.filter((ra) => ra.peso > 0)
  const somaRAs = comPeso.reduce((soma, ra) => soma + ra.peso, 0)
  const resultado: Fatia[] = []
  for (const ra of comPeso) {
    const fracao = ra.peso / somaRAs
    const avaliacoes = ra.avaliacoes.filter((a) => a.peso > 0)
    if (foiRecuperado(ra, regra)) {
      // RA recuperado está fechado: a nota dele é uma só.
      resultado.push({ peso: fracao, nota: comRecuperacao(mediaDoRA(ra, true), ra, regra) })
    } else if (avaliacoes.length === 0) {
      // RA sem avaliações cadastradas ainda: conta como uma avaliação pendente.
      resultado.push({ peso: fracao, nota: null })
    } else {
      const somaAvaliacoes = avaliacoes.reduce((soma, a) => soma + a.peso, 0)
      for (const a of avaliacoes) {
        resultado.push({ peso: (fracao * a.peso) / somaAvaliacoes, nota: notaDe0a10(a) })
      }
    }
  }
  return resultado
}

/**
 * Situação da matéria pelas notas. `extras` é a soma dos pontos extras, que entra
 * na nota final (com teto de 10). Avaliações e RAs inválidos (veja `erroAvaliacao`
 * e `erroRA`) devem ser barrados antes, no formulário e ao carregar os dados.
 */
export function situacaoNota(
  ras: ResultadoAprendizagem[],
  regra: RegraAprovacao,
  extras = 0,
): SituacaoNota {
  const todas = fatias(ras, regra)
  if (todas.length === 0) return { tipo: 'sem-avaliacoes' }

  const comExtras = (nota: number) => Math.min(NOTA_MAXIMA, nota + extras)
  const feitas = todas.filter((f) => f.nota !== null)
  const pontos = feitas.reduce((soma, f) => soma + f.peso * f.nota!, 0)
  const pesoFeito = feitas.reduce((soma, f) => soma + f.peso, 0)
  const pesoPendente = 1 - pesoFeito

  // Média do que já saiu (a nota "de agora"), só para mostrar.
  const media = pesoFeito > 0 ? paraExibir(comExtras(pontos / pesoFeito), regra) : null
  // Nota final contando 0 no que falta: se já alcança a média, está garantido.
  const garantida = comExtras(pontos)
  const rec = regra.recuperacao

  if (feitas.length === todas.length) {
    const final = paraExibir(garantida, regra)
    if (alcanca(garantida, regra.mediaMinima, regra)) {
      return { tipo: 'aprovado', media: final, garantida: final, fechada: true }
    }
    // Os RAs que ainda dá para recuperar: abaixo da média e sem recuperação feita.
    // Se todos os que estão abaixo já foram recuperados, não sobrou nada: reprovou.
    const paraRecuperar = ras.filter(
      (ra) =>
        ra.peso > 0 &&
        !foiRecuperado(ra, regra) &&
        !alcanca(mediaDoRA(ra, true) ?? 0, regra.mediaMinima, regra),
    )
    if (rec && alcanca(garantida, rec.notaMinima, regra) && paraRecuperar.length > 0) {
      return {
        tipo: 'recuperacao',
        media: final,
        teto: rec.teto,
        ras: paraRecuperar.map((ra) => ra.id),
      }
    }
    return { tipo: 'reprovado', media: final }
  }

  if (alcanca(garantida, regra.mediaMinima, regra)) {
    const nota = paraExibir(garantida, regra)
    return { tipo: 'aprovado', media: media ?? nota, garantida: nota, fechada: false }
  }

  /** Quanto precisa (de 0 a 10) em cada avaliação pendente para a nota final chegar em `minimo`. */
  const precisaPara = (minimo: number) =>
    arredondarParaCima((meta(minimo, regra) - extras - pontos) / pesoPendente)

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
