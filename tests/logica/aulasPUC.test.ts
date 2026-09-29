import { describe, expect, it } from 'vitest'
import { AULAS_PUC, aulasDaTabela, aulasDoHorario } from '../../src/logica/aulasPUC'

/** Números das aulas ("2ª" = 2) em vez das posições, para ler fácil. */
const numeros = (h: Parameters<typeof aulasDoHorario>[0]) => aulasDoHorario(h).map((i) => AULAS_PUC[i].numero)

describe('AULAS_PUC', () => {
  it('tem as 20 aulas do portal, de 45 min, com os três intervalos', () => {
    expect(AULAS_PUC).toHaveLength(20)
    expect(AULAS_PUC[0]).toEqual({ numero: 1, inicio: '07:05', fim: '07:50' })
    expect(AULAS_PUC[19]).toEqual({ numero: 20, inicio: '22:15', fim: '23:00' })
    const intervalos = AULAS_PUC.slice(1).flatMap((aula, i) => (aula.inicio !== AULAS_PUC[i].fim ? [aula.numero] : []))
    expect(intervalos).toEqual([4, 11, 18])
  })
})

describe('aulasDoHorario', () => {
  it('pega as aulas que começam dentro do horário, pulando o intervalo', () => {
    expect(numeros({ inicio: '07:50', fim: '11:10' })).toEqual([2, 3, 4, 5])
    expect(numeros({ inicio: '19:00', fim: '22:15' })).toEqual([16, 17, 18, 19])
    expect(numeros({ inicio: '07:05', fim: '12:40' })).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('horário antigo, sem fim: as aulas a partir do início (ou uma só)', () => {
    expect(numeros({ inicio: '19:00', aulas: 2 })).toEqual([16, 17])
    expect(numeros({ inicio: '19:00' })).toEqual([16])
    // Perto do início da aula (até 15 min antes) ainda vale.
    expect(numeros({ inicio: '07:00', aulas: 1 })).toEqual([1])
    // Não passa da 20ª.
    expect(numeros({ inicio: '22:15', aulas: 3 })).toEqual([20])
  })

  it('horário que não bate com nenhuma aula da tabela fica vazio', () => {
    expect(numeros({ inicio: '13:30', fim: '13:40' })).toEqual([])
    expect(numeros({ inicio: '13:30' })).toEqual([])
    expect(numeros({ inicio: '23:10' })).toEqual([])
    expect(numeros({ inicio: 'xx:yy' })).toEqual([])
  })
})

describe('aulasDaTabela', () => {
  it('acha a primeira e a última aula de um horário exato da tabela', () => {
    expect(aulasDaTabela({ inicio: '07:50', fim: '11:10', aulas: 4 })).toEqual({ primeira: 1, ultima: 4 })
    expect(aulasDaTabela({ inicio: '19:00', fim: '19:45' })).toEqual({ primeira: 15, ultima: 15 })
  })

  it('não bate: hora fora da tabela, fim antes do início ou número de aulas diferente', () => {
    expect(aulasDaTabela({ inicio: '19:00', fim: '22:30' })).toBeNull()
    expect(aulasDaTabela({ inicio: '09:40', fim: '08:35' })).toBeNull()
    expect(aulasDaTabela({ inicio: '07:50', fim: '11:10', aulas: 3 })).toBeNull()
    expect(aulasDaTabela({ inicio: '19:00' })).toBeNull()
  })
})
