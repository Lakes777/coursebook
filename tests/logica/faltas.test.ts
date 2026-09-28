import { describe, expect, it } from 'vitest'
import {
  erroCargaHoraria,
  erroFalta,
  limiteFaltas,
  situacaoFaltas,
  totalFaltas,
} from '../../src/logica/faltas'
import type { Falta } from '../../src/logica/tipos'

let contador = 0
/** Faltas em dias diferentes, cada uma com essa quantidade de aulas. */
function faltas(...quantidades: number[]): Falta[] {
  return quantidades.map((quantidade, i) => {
    contador += 1
    return { id: `f${contador}`, data: `2026-09-${String(i + 1).padStart(2, '0')}`, quantidade }
  })
}

describe('limiteFaltas', () => {
  it('é 25% da carga horária com frequência mínima de 75%', () => {
    expect(limiteFaltas(120, 0.75)).toBe(30) // POO, Experiência Criativa
    expect(limiteFaltas(80, 0.75)).toBe(20) // Filosofia, PSCF, Criação de Modelos
  })

  it('arredonda para baixo', () => {
    expect(limiteFaltas(66, 0.75)).toBe(16) // 16,5: a 17ª falta já passa de 25%
  })

  it('não erra por causa do ponto flutuante', () => {
    expect((1 - 0.9) * 80).not.toBe(8) // o problema existe de verdade
    expect(limiteFaltas(80, 0.9)).toBe(8)
  })

  it('é 0 sem carga horária', () => {
    expect(limiteFaltas(0, 0.75)).toBe(0)
  })
})

describe('totalFaltas', () => {
  it('soma as aulas perdidas de todos os dias', () => {
    expect(totalFaltas(faltas(3, 2, 1))).toBe(6)
    expect(totalFaltas([])).toBe(0)
  })
})

describe('situacaoFaltas', () => {
  it('sem faltas', () => {
    expect(situacaoFaltas([], 80, 0.75)).toEqual({
      total: 0,
      limite: 20,
      restantes: 20,
      frequencia: 1,
      nivel: 'ok',
    })
  })

  it('conta cada aula de 45 min como uma falta', () => {
    // Faltou duas manhãs de 3 aulas em POO (120 aulas)
    expect(situacaoFaltas(faltas(3, 3), 120, 0.75)).toMatchObject({
      total: 6,
      restantes: 24,
      frequencia: 0.95,
      nivel: 'ok',
    })
  })

  it('avisa a partir de 75% do limite', () => {
    expect(situacaoFaltas(faltas(14), 80, 0.75).nivel).toBe('ok') // 14 de 20
    expect(situacaoFaltas(faltas(15), 80, 0.75).nivel).toBe('atencao') // 15 de 20
  })

  it('no limite exato ainda passa, mas é atenção: não pode faltar mais nenhuma', () => {
    expect(situacaoFaltas(faltas(10, 10), 80, 0.75)).toMatchObject({
      restantes: 0,
      frequencia: 0.75,
      nivel: 'atencao',
    })
  })

  it('uma falta além do limite reprova', () => {
    expect(situacaoFaltas(faltas(10, 11), 80, 0.75)).toMatchObject({
      restantes: -1,
      nivel: 'reprovado',
    })
  })

  it('avisa mesmo com limite pequeno', () => {
    // 4 aulas: limite 1; 1 falta já é o limite
    expect(situacaoFaltas(faltas(1), 4, 0.75)).toMatchObject({ limite: 1, nivel: 'atencao' })
  })

  it('matéria tão curta que não pode faltar nenhuma aula já começa em atenção', () => {
    // 3 aulas: 25% é 0,75, que arredonda para 0
    expect(situacaoFaltas([], 3, 0.75)).toMatchObject({ limite: 0, restantes: 0, nivel: 'atencao' })
  })

  it('frequência nunca fica negativa', () => {
    expect(situacaoFaltas(faltas(12, 12), 20, 0.75).frequencia).toBe(0)
  })

  it('sem carga horária não calcula limite nem frequência', () => {
    expect(situacaoFaltas(faltas(2), 0, 0.75)).toEqual({
      total: 2,
      limite: 0,
      restantes: 0,
      frequencia: null,
      nivel: 'sem-carga-horaria',
    })
  })
})

describe('erroFalta', () => {
  it('aceita uma falta válida', () => {
    expect(erroFalta({ data: '2026-09-22', quantidade: 3 })).toBeNull()
  })

  it('recusa data inválida', () => {
    expect(erroFalta({ data: '2026-02-30', quantidade: 1 })).toMatch('data')
  })

  it.each([0, -1, 1.5, 13, NaN])('recusa %s aulas', (quantidade) => {
    expect(erroFalta({ data: '2026-09-22', quantidade })).toMatch('de 1 a 12')
  })
})

describe('erroCargaHoraria', () => {
  it('aceita número inteiro de aulas, inclusive 0', () => {
    expect(erroCargaHoraria(80)).toBeNull()
    expect(erroCargaHoraria(0)).toBeNull()
  })

  it.each([-1, 80.5, NaN])('recusa %s', (carga) => {
    expect(erroCargaHoraria(carga)).toMatch('inteiro')
  })
})
