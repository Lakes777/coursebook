import { describe, expect, it } from 'vitest'
import type { DiaSemana, Materia } from '../../src/logica/tipos'
import { dadosDeExemplo } from '../../src/logica/exemplo'
import { diasPerto, ladoDoTexto } from '../../src/telas/lobbyUtil'
import { gradeDaSemana } from '../../src/telas/semanaUtil'

/** Uma matéria do exemplo com os horários trocados (só os dias importam aqui). */
function comAulasEm(...dias: DiaSemana[]): Materia {
  const base = dadosDeExemplo().materias[0]
  return { ...base, horarios: dias.map((dia) => ({ dia, inicio: '19:00', fim: '19:45', aulas: 1 })) }
}

const perto = (dias: DiaSemana[], hoje: DiaSemana) => [...diasPerto(gradeDaSemana([comAulasEm(...dias)]), hoje)]

describe('diasPerto (os dois dias do celular)', () => {
  it('num dia de semana: hoje e amanhã', () => {
    expect(perto([1], 3)).toEqual([3, 4])
  })

  it('na sexta, dá a volta para a segunda', () => {
    expect(perto([1], 5)).toEqual([5, 1])
  })

  it('no domingo com coluna de domingo: domingo e segunda (o domingo vem no fim da grade)', () => {
    expect(perto([0], 0)).toEqual([0, 1])
  })

  it('no sábado sem coluna de sábado, mas com a de domingo: domingo e segunda', () => {
    expect(perto([0], 6)).toEqual([0, 1])
  })

  it('no sábado sem fim de semana na grade: segunda e terça', () => {
    expect(perto([1], 6)).toEqual([1, 2])
  })
})

describe('ladoDoTexto (o lado oposto ao da coluna de hoje)', () => {
  const grade = gradeDaSemana([comAulasEm(1)])

  it('segunda e terça (metade esquerda): texto à direita', () => {
    expect(ladoDoTexto(grade, 1)).toBe('direita')
    expect(ladoDoTexto(grade, 2)).toBe('direita')
  })

  it('quarta, no meio de 5 colunas, ainda conta como esquerda: texto à direita', () => {
    expect(ladoDoTexto(grade, 3)).toBe('direita')
  })

  it('quinta e sexta: texto à esquerda', () => {
    expect(ladoDoTexto(grade, 4)).toBe('esquerda')
    expect(ladoDoTexto(grade, 5)).toBe('esquerda')
  })

  it('hoje sem coluna (domingo sem aulas): à esquerda', () => {
    expect(ladoDoTexto(grade, 0)).toBe('esquerda')
  })
})
