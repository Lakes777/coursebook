import { erroFalta } from '../logica/faltas'
import { faixaHorario } from '../logica/horarios'
import { erroPontoExtra, naEscala, type SituacaoNota } from '../logica/notas'
import { formatarNota, formatarPorcentagem, lerNumero, limpar } from '../logica/numeros'
import type { Avaliacao, Falta, Horario, PontoExtra, RegraAprovacao, ResultadoAprendizagem } from '../logica/tipos'

// Contas e textos da tela de uma matéria, sem React, para testar sozinhos.

export type NotaDigitada = { ok: true; nota: number | null } | { ok: false; erro: string }

/**
 * Lê a nota digitada num campo. Campo vazio = nota ainda não saiu (null).
 * `maximo` é o valor da avaliação (3,0 numa prova que vale 3 pontos).
 */
export function lerNotaDigitada(texto: string, maximo: number): NotaDigitada {
  if (texto.trim() === '') return { ok: true, nota: null }
  // Mais de 2 casas não cabe no campo: 2,999 apareceria como "3,0" e seria salvo como 3,0 ao sair.
  if (/[.,]\d{3,}/.test(texto)) return { ok: false, erro: 'Use no máximo 2 casas decimais (ex.: 2,75).' }
  const nota = lerNumero(texto)
  if (nota === null || nota > maximo) {
    return { ok: false, erro: `Digite uma nota de 0 a ${formatarNota(maximo)} (ex.: 7,5), ou deixe vazio.` }
  }
  return { ok: true, nota }
}

/** A nota como aparece no campo: 7 -> "7,0", null -> "". */
export function notaNoCampo(nota: number | null): string {
  return nota === null ? '' : formatarNota(nota)
}

/**
 * Nota necessária (de 0 a 10) levada para a escala da avaliação, arredondada para
 * CIMA em 2 casas: numa prova de 2,5, precisar de 6,1 vira 1,525 -> 1,53. Para baixo
 * (1,52) o aluno tiraria o que a tela disse e não chegaria.
 */
export function necessariaNaEscala(notaNecessaria: number, valorMaximo: number): number {
  return Math.ceil(limpar(naEscala(notaNecessaria, valorMaximo) * 100)) / 100
}

/** Parte da nota final que cada RA vale (0 a 1). RAs de peso 0 ficam de fora. */
export function fracaoDoRA(ra: ResultadoAprendizagem, ras: ResultadoAprendizagem[]): number {
  const soma = ras.reduce((total, r) => total + (r.peso > 0 ? r.peso : 0), 0)
  return soma > 0 && ra.peso > 0 ? ra.peso / soma : 0
}

/** As regras de aprovação em frases curtas, para quem nunca leu a resolução da PUC. */
export function textoRegra(regra: RegraAprovacao): string[] {
  const linhas = [
    `Média mínima ${formatarNota(regra.mediaMinima)}`,
    `Frequência mínima ${formatarPorcentagem(regra.frequenciaMinima)}`,
  ]
  const rec = regra.recuperacao
  if (rec) {
    linhas.push(
      `Recuperação com média final a partir de ${formatarNota(rec.notaMinima)}; a nota do RA recuperado vale até ${formatarNota(rec.teto)}`,
    )
  } else {
    linhas.push('Sem recuperação')
  }
  linhas.push(regra.arredondarUmaCasa ? 'Nota final arredondada para 1 casa' : 'Nota final sem arredondar')
  return linhas
}

/** Faltas da mais recente para a mais antiga (datas "AAAA-MM-DD" ordenam como texto). */
export function faltasOrdenadas(faltas: Falta[]): Falta[] {
  return [...faltas].sort((a, b) => b.data.localeCompare(a.data))
}

export type CampoFalta = 'data' | 'quantidade'
export type CampoPontoExtra = 'pontos' | 'comentario'

export interface ErroCampo<C> {
  campo: C
  mensagem: string
}

/** O erro da falta e o campo dele (confere um campo por vez, como o da agenda). */
export function erroDaFalta(falta: Pick<Falta, 'data' | 'quantidade'>): ErroCampo<CampoFalta> | null {
  const mensagem = erroFalta(falta)
  if (mensagem === null) return null
  const campo: CampoFalta = erroFalta({ data: falta.data, quantidade: 1 }) !== null ? 'data' : 'quantidade'
  return { campo, mensagem }
}

/** O erro do ponto extra e o campo dele. */
export function erroDoPontoExtra(
  extra: Pick<PontoExtra, 'pontos' | 'comentario'>,
  /** Quanto vale o RA que recebe os pontos (10 para a nota final): mais que isso não faz sentido. */
  escala = 10,
): ErroCampo<CampoPontoExtra> | null {
  const mensagem = erroPontoExtra(extra)
  if (mensagem === null) {
    if (extra.pontos > escala) {
      return { campo: 'pontos', mensagem: `Aqui os pontos extras vão até ${formatarNota(escala)}, que é quanto o RA vale.` }
    }
    return null
  }
  const campo: CampoPontoExtra =
    erroPontoExtra({ pontos: extra.pontos, comentario: 'x' }) !== null ? 'pontos' : 'comentario'
  return { campo, mensagem }
}

/** Número digitado, ou NaN se não for número; os erro* recusam o NaN com a mensagem certa. */
export function lerCampoNumero(texto: string): number {
  return lerNumero(texto) ?? Number.NaN
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** "Ter 19:00 às 22:30 (4 aulas), Qui 19:00 às 20:30 (2 aulas)", na ordem da semana. */
export function textoHorarios(horarios: Horario[]): string {
  return [...horarios]
    .sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio))
    .map((h) => `${DIAS[h.dia]} ${faixaHorario(h)}`)
    .join(', ')
}

/**
 * A frase que explica a situação da nota, embaixo do selo. O selo diz o resultado
 * ("Precisa de 6,6 (de 10) no que falta"); aqui vai o porquê. Null quando o selo basta.
 */
export function explicacaoNota(situacao: SituacaoNota, regra: RegraAprovacao): string | null {
  const minima = formatarNota(regra.mediaMinima)
  switch (situacao.tipo) {
    case 'sem-avaliacoes':
      return 'Esta matéria ainda não tem RAs com peso, então não dá para calcular a nota.'
    case 'aprovado':
      return situacao.fechada
        ? null
        : `Média do que já saiu: ${formatarNota(situacao.media)}. Mesmo tirando 0 no que falta, a nota final fica em ${formatarNota(situacao.garantida)}.`
    case 'possivel':
      return situacao.media === null
        ? `Para chegar em ${minima}, precisa dessa nota em cada avaliação (o valor na escala de cada uma aparece ao lado dela).`
        : `Média do que já saiu: ${formatarNota(situacao.media)}. A nota que falta aparece na escala de cada avaliação.`
    case 'impossivel':
      return `Nem com a nota máxima em tudo o que falta a média chega em ${minima}.`
    case 'recuperacao':
      return `Média final ${formatarNota(situacao.media)}. Os RAs marcados podem ser recuperados; a nota da recuperação vale até ${formatarNota(situacao.teto)}.`
    case 'reprovado':
      return null
  }
}

/**
 * Dica embaixo de uma avaliação sem nota: quanto tirar nela, na escala dela
 * ("Precisa de 1,98 de 3,0"). Só para as que contam e só quando dá para dizer.
 */
export function dicaAvaliacao(
  avaliacao: Pick<Avaliacao, 'nota' | 'peso' | 'valorMaximo'>,
  situacao: SituacaoNota,
): string | undefined {
  if (avaliacao.nota !== null || avaliacao.peso <= 0) return undefined
  const escala = (nota: number) =>
    `${formatarNota(necessariaNaEscala(nota, avaliacao.valorMaximo))} de ${formatarNota(avaliacao.valorMaximo)}`
  if (situacao.tipo === 'possivel') return `Precisa de ${escala(situacao.notaNecessaria)}`
  if (situacao.tipo === 'impossivel' && situacao.notaParaRecuperacao) {
    return `Precisa de ${escala(situacao.notaParaRecuperacao)} para ter a recuperação`
  }
  return undefined
}
