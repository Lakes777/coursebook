import { describe, expect, it } from 'vitest'
import { agenda } from '../../src/logica/eventos'
import { dadosDeExemplo } from '../../src/logica/exemplo'
import { validarDados } from '../../src/logica/validacao'
import { resumoMateria } from '../../src/tema/textos'

// Alguns "hojes", inclusive virada de mês e de ano, para as datas relativas.
const DIAS = [new Date(2026, 9, 1, 10), new Date(2026, 11, 31, 23, 59), new Date(2027, 1, 28, 8)]

describe('dadosDeExemplo', () => {
  it.each(DIAS)('passa na mesma conferência dos dados salvos (%s)', (hoje) => {
    const dados = dadosDeExemplo(hoje)
    expect(validarDados(dados)).toEqual({ ok: true, valor: dados })
  })

  it('mostra uma situação diferente em cada matéria', () => {
    const dados = dadosDeExemplo(DIAS[0])
    const [estruturas, poo, calculo] = dados.materias.map((m) => resumoMateria(m, dados.regraPadrao))
    expect(estruturas.nota).toMatchObject({ tipo: 'aprovado', fechada: true })
    expect(estruturas.faltas.nivel).toBe('ok')
    // 1,8 de 3,0 no RA1 (0,3 da nota): (7 − 1,8) / 0,7 = 7,43 -> 7,5 no que falta.
    expect(poo.nota).toEqual({ tipo: 'possivel', media: 6, notaNecessaria: 7.5 })
    expect(calculo.nota).toMatchObject({ tipo: 'recuperacao', ras: ['ra1', 'ra2'] })
    expect(calculo.faltas.nivel).toBe('atencao')
  })

  it.each(DIAS)('a agenda tem de tudo em qualquer dia (%s)', (hoje) => {
    const destaques = new Set(agenda(dadosDeExemplo(hoje).eventos, hoje).map((e) => e.destaque))
    expect([...destaques].sort()).toEqual(['atrasado', 'concluido', 'futuro', 'hoje', 'proximo'])
  })
})
