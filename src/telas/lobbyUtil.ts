import type { DiaSemana } from '../logica/tipos'
import type { Grade } from './semanaUtil'

// Lógica do fundo do lobby (a grade da semana), sem React.

/** Posição na semana que começa na segunda, como a grade: seg = 0 ... dom = 6. */
const posicao = (dia: DiaSemana) => (dia + 6) % 7

/**
 * Os dois dias que aparecem no celular: hoje (ou o próximo dia com coluna na grade)
 * e o seguinte, dando a volta no fim da semana.
 */
export function diasPerto(grade: Grade, hoje: DiaSemana): Set<DiaSemana> {
  const ordem = grade.dias.map((d) => d.dia)
  const daqui = ordem.findIndex((d) => posicao(d) >= posicao(hoje))
  const primeiro = daqui === -1 ? 0 : daqui
  return new Set([ordem[primeiro], ordem[(primeiro + 1) % ordem.length]])
}

/**
 * O lado em que ficam o nome e a tarja: o oposto ao da coluna de hoje (onde fica a aula
 * acesa), para o texto não cobrir justo o que a grade quer mostrar. Hoje sem coluna
 * (fim de semana sem aulas): à esquerda, como de costume.
 */
export function ladoDoTexto(grade: Grade, hoje: DiaSemana): 'esquerda' | 'direita' {
  const coluna = grade.dias.findIndex((d) => d.dia === hoje)
  if (coluna === -1) return 'esquerda'
  return coluna < grade.dias.length / 2 ? 'direita' : 'esquerda'
}
