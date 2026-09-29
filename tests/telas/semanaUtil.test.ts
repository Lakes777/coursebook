import { describe, expect, it } from 'vitest'
import type { Horario, Materia } from '../../src/logica/tipos'
import { gradeDaSemana, textoAulas, textoFaixa } from '../../src/telas/semanaUtil'

function materia(id: string, nome: string, horarios: Horario[]): Materia {
  return { id, nome, professor: '', horarios, cargaHoraria: 80, ras: [], pontosExtras: [], faltas: [] }
}

/** "Segunda-feira: 19:00 Banco, 20:40 Algoritmos" de cada dia, para comparar fácil. */
function resumo(materias: Materia[]) {
  return gradeDaSemana(materias).map((d) => `${d.nome}: ${d.aulas.map((a) => `${a.horario.inicio} ${a.materia}`).join(', ')}`)
}

describe('gradeDaSemana', () => {
  it('mostra de segunda a sábado, mesmo nos dias sem aula, e sem domingo', () => {
    const grade = gradeDaSemana([materia('a', 'Algoritmos', [{ dia: 2, inicio: '19:00' }])])
    expect(grade.map((d) => d.dia)).toEqual([1, 2, 3, 4, 5, 6])
    expect(grade.map((d) => d.aulas.length)).toEqual([0, 1, 0, 0, 0, 0])
  })

  it('põe o domingo no fim quando alguma matéria tem aula nele', () => {
    const grade = gradeDaSemana([materia('a', 'Algoritmos', [{ dia: 0, inicio: '08:00' }])])
    expect(grade.map((d) => d.dia)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(grade.at(-1)?.nome).toBe('Domingo')
  })

  it('junta os horários de todas as matérias por dia, pelo início e depois pelo nome', () => {
    const materias = [
      materia('b', 'Banco de Dados', [
        { dia: 1, inicio: '20:40', fim: '22:20' },
        { dia: 3, inicio: '19:00' },
      ]),
      materia('a', 'Álgebra', [{ dia: 1, inicio: '20:40' }]),
      materia('c', 'Cálculo', [{ dia: 1, inicio: '19:00' }]),
      // Com acento e minúscula: o localeCompare em pt-BR põe "estatística" entre "Cálculo" e "Física".
      materia('e', 'estatística', [{ dia: 3, inicio: '19:00' }]),
      materia('f', 'Física', [{ dia: 3, inicio: '19:00' }]),
    ]
    expect(resumo(materias).slice(0, 3)).toEqual([
      'Segunda-feira: 19:00 Cálculo, 20:40 Álgebra, 20:40 Banco de Dados',
      'Terça-feira: ',
      'Quarta-feira: 19:00 Banco de Dados, 19:00 estatística, 19:00 Física',
    ])
  })

  it('ordena pela hora, não pelo texto, e guarda o id da matéria para o link', () => {
    const grade = gradeDaSemana([
      materia('x', 'Noite', [{ dia: 5, inicio: '19:00' }]),
      materia('y', 'Manhã', [{ dia: 5, inicio: '07:30' }]),
    ])
    const sexta = grade.find((d) => d.dia === 5)!
    expect(sexta.aulas.map((a) => a.materiaId)).toEqual(['y', 'x'])
  })

  it('sem matérias, os dias ficam vazios', () => {
    expect(gradeDaSemana([]).every((d) => d.aulas.length === 0)).toBe(true)
  })
})

describe('textoFaixa e textoAulas', () => {
  it('mostra início e fim, ou só o início em horário antigo', () => {
    expect(textoFaixa({ dia: 1, inicio: '19:00', fim: '22:30', aulas: 4 })).toBe('19:00 às 22:30')
    expect(textoFaixa({ dia: 1, inicio: '19:00' })).toBe('19:00')
  })

  it('diz quantas aulas, no singular ou plural, ou nada', () => {
    expect(textoAulas({ dia: 1, inicio: '19:00', aulas: 4 })).toBe('4 aulas')
    expect(textoAulas({ dia: 1, inicio: '19:00', aulas: 1 })).toBe('1 aula')
    expect(textoAulas({ dia: 1, inicio: '19:00' })).toBeNull()
  })
})
