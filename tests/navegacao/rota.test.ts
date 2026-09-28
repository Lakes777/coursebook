import { describe, expect, it } from 'vitest'
import { INICIO, lerRota, paraHash, type Rota } from '../../src/navegacao/rota'

describe('lerRota', () => {
  it('lê cada tela', () => {
    expect(lerRota('#/materias')).toEqual({ tela: 'materias' })
    expect(lerRota('#/agenda')).toEqual({ tela: 'agenda' })
    expect(lerRota('#/dados')).toEqual({ tela: 'dados' })
    expect(lerRota('#/nova-materia')).toEqual({ tela: 'nova-materia' })
    expect(lerRota('#/materia/abc-123')).toEqual({ tela: 'materia', id: 'abc-123' })
    expect(lerRota('#/materia/abc-123/editar')).toEqual({ tela: 'editar-materia', id: 'abc-123' })
  })

  it('aceita barra no fim e falta da barra do começo', () => {
    expect(lerRota('#/agenda/')).toEqual({ tela: 'agenda' })
    expect(lerRota('#agenda')).toEqual({ tela: 'agenda' })
  })

  it('manda o que não conhece para o início', () => {
    const desconhecidos = ['', '#', '#/', '#/nada', '#/materia', '#/materia/a/b', '#/materia/a/editar/x', '#/agenda/x']
    for (const hash of [...desconhecidos, '#/materia/%E0', '#/materia/%E0/editar']) {
      expect(lerRota(hash), hash).toEqual(INICIO)
    }
  })
})

describe('paraHash', () => {
  it('volta a dar a mesma rota', () => {
    const rotas: Rota[] = [
      { tela: 'materias' },
      { tela: 'agenda' },
      { tela: 'dados' },
      { tela: 'nova-materia' },
      { tela: 'materia', id: 'abc' },
      { tela: 'materia', id: 'com espaço/e barra' },
      { tela: 'editar-materia', id: 'com espaço/e barra' },
    ]
    for (const rota of rotas) expect(lerRota(paraHash(rota))).toEqual(rota)
  })
})
