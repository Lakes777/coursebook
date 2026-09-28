import { describe, expect, it } from 'vitest'
import { INICIO, lerRota, paraHash, type Rota } from '../../src/navegacao/rota'

describe('lerRota', () => {
  it('lê cada tela', () => {
    expect(lerRota('#/materias')).toEqual({ tela: 'materias' })
    expect(lerRota('#/agenda')).toEqual({ tela: 'agenda' })
    expect(lerRota('#/nova-materia')).toEqual({ tela: 'nova-materia' })
    expect(lerRota('#/materia/abc-123')).toEqual({ tela: 'materia', id: 'abc-123' })
  })

  it('aceita barra no fim e falta da barra do começo', () => {
    expect(lerRota('#/agenda/')).toEqual({ tela: 'agenda' })
    expect(lerRota('#agenda')).toEqual({ tela: 'agenda' })
  })

  it('manda o que não conhece para o início', () => {
    for (const hash of ['', '#', '#/', '#/nada', '#/materia', '#/materia/a/b', '#/agenda/x', '#/materia/%E0']) {
      expect(lerRota(hash), hash).toEqual(INICIO)
    }
  })
})

describe('paraHash', () => {
  it('volta a dar a mesma rota', () => {
    const rotas: Rota[] = [
      { tela: 'materias' },
      { tela: 'agenda' },
      { tela: 'nova-materia' },
      { tela: 'materia', id: 'abc' },
      { tela: 'materia', id: 'com espaço/e barra' },
    ]
    for (const rota of rotas) expect(lerRota(paraHash(rota))).toEqual(rota)
  })
})
