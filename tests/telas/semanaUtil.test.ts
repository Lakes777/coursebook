import { describe, expect, it } from 'vitest'
import { AULAS_PUC } from '../../src/logica/aulasPUC'
import type { Horario, Materia } from '../../src/logica/tipos'
import { faixaAula, gradeDaSemana, nomeAula, textoFaixa } from '../../src/telas/semanaUtil'

function materia(id: string, nome: string, horarios: Horario[]): Materia {
  return { id, nome, professor: '', horarios, cargaHoraria: 80, ras: [], pontosExtras: [], faltas: [] }
}

/** "16ª: Cálculo | - | ..." de cada linha, para comparar fácil. */
function resumo(materias: Materia[]) {
  return gradeDaSemana(materias).linhas.map((l) =>
    l.tipo === 'vazio'
      ? `sem aulas ${l.de}-${l.ate}`
      : `${l.aula.numero}ª: ${l.celulas.map((c) => c.map((a) => a.materia).join(' + ') || '-').join(' | ')}`,
  )
}

describe('gradeDaSemana', () => {
  it('segunda a sexta sempre; sábado e domingo só quando há aula', () => {
    expect(gradeDaSemana([]).dias.map((d) => d.dia)).toEqual([1, 2, 3, 4, 5])
    const comFds = gradeDaSemana([materia('a', 'A', [{ dia: 0, inicio: '08:35', fim: '09:20' }, { dia: 6, inicio: '07:05' }])])
    expect(comFds.dias.map((d) => d.dia)).toEqual([1, 2, 3, 4, 5, 6, 0])
  })

  it('a matéria aparece em cada aula que ocupa, e as linhas vão da primeira à última aula ocupada', () => {
    const materias = [
      materia('c', 'Cálculo', [{ dia: 1, inicio: '07:50', fim: '09:20' }]),
      materia('f', 'Filosofia', [{ dia: 3, inicio: '09:40', fim: '11:10' }]),
    ]
    expect(resumo(materias)).toEqual([
      '2ª: Cálculo | - | - | - | -',
      '3ª: Cálculo | - | - | - | -',
      '4ª: - | - | Filosofia | - | -',
      '5ª: - | - | Filosofia | - | -',
    ])
  })

  it('uma aula vazia no meio aparece; duas ou mais seguidas viram uma linha só', () => {
    const umaVazia = [
      materia('c', 'Cálculo', [{ dia: 1, inicio: '07:05', fim: '07:50' }, { dia: 1, inicio: '08:35', fim: '09:20' }]),
    ]
    expect(resumo(umaVazia)).toEqual(['1ª: Cálculo | - | - | - | -', '2ª: - | - | - | - | -', '3ª: Cálculo | - | - | - | -'])
    const manhaENoite = [
      materia('c', 'Cálculo', [{ dia: 5, inicio: '10:25', fim: '11:10' }]),
      materia('p', 'POO', [{ dia: 2, inicio: '19:00', fim: '19:45' }]),
    ]
    expect(resumo(manhaENoite)).toEqual([
      '5ª: - | - | - | - | Cálculo',
      'sem aulas 11:10-19:00',
      '16ª: - | POO | - | - | -',
    ])
  })

  it('duas matérias na mesma aula ficam juntas, em ordem de nome', () => {
    const materias = [
      materia('f', 'Física', [{ dia: 2, inicio: '19:00', fim: '19:45' }]),
      materia('e', 'estatística', [{ dia: 2, inicio: '19:00', fim: '19:45' }]),
    ]
    expect(resumo(materias)).toEqual(['16ª: - | estatística + Física | - | - | -'])
  })

  it('horários fora da tabela vão para foraDaGrade, na ordem da semana', () => {
    const grade = gradeDaSemana([
      materia('a', 'A', [{ dia: 5, inicio: '13:30', fim: '13:40' }, { dia: 1, inicio: '06:00', fim: '06:30' }]),
    ])
    expect(grade.linhas).toEqual([])
    expect(grade.foraDaGrade.map((a) => `${a.nomeDia} ${a.horario.inicio}`)).toEqual(['Segunda-feira 06:00', 'Sexta-feira 13:30'])
  })
})

describe('textos', () => {
  it('nome e faixa da aula da tabela', () => {
    expect(nomeAula(AULAS_PUC[1])).toBe('2ª aula')
    expect(faixaAula(AULAS_PUC[1])).toBe('07:50 às 08:35')
  })

  it('faixa de um horário com e sem fim', () => {
    expect(textoFaixa({ dia: 1, inicio: '19:00', fim: '22:30', aulas: 4 })).toBe('19:00 às 22:30')
    expect(textoFaixa({ dia: 1, inicio: '19:00' })).toBe('19:00')
  })
})
