import { describe, expect, it } from 'vitest'
import { dadosVazios } from '../../src/logica/armazenamento'
import { erroFalta, MAXIMO_AULAS_POR_DIA } from '../../src/logica/faltas'
import { aulasNoDia, erroHorario, faixaHorario, minutos, sugerirAulas } from '../../src/logica/horarios'
import { validarDados } from '../../src/logica/validacao'

describe('horários', () => {
  it('converte a hora em minutos', () => {
    expect(minutos('07:45')).toBe(465)
    expect(minutos('7:45')).toBeNull()
    expect(minutos('24:00')).toBeNull()
  })

  it('sugere as aulas de 45 min que cabem', () => {
    expect(sugerirAulas('19:00', '22:30')).toBe(4)
    expect(sugerirAulas('07:45', '09:15')).toBe(2)
    // Menos de uma aula inteira ainda é 1.
    expect(sugerirAulas('19:00', '19:30')).toBe(1)
    expect(sugerirAulas('19:00', '19:00')).toBeNull()
    expect(sugerirAulas('19:00', '')).toBeNull()
  })

  it('confere o fim e as aulas', () => {
    expect(erroHorario({ inicio: '19:00' })).toBeNull()
    expect(erroHorario({ inicio: '19:00', fim: '22:30', aulas: 4 })).toBeNull()
    expect(erroHorario({ inicio: '19:00', fim: '18:00' })).toContain('terminar depois')
    expect(erroHorario({ inicio: '19:00', fim: '25:00' })).toContain('HH:MM')
    expect(erroHorario({ inicio: '19:00', aulas: 0 })).toContain('de 1 a 12')
    expect(erroHorario({ inicio: '19:00', aulas: 2.5 })).toContain('inteiro')
  })

  it('soma as aulas do dia, contando 1 para horário antigo sem o número', () => {
    const horarios = [
      { dia: 2 as const, inicio: '07:45', fim: '09:15', aulas: 2 },
      { dia: 2 as const, inicio: '19:00', fim: '22:30', aulas: 4 },
      { dia: 4 as const, inicio: '19:00' },
    ]
    expect(aulasNoDia(horarios, 2)).toBe(6)
    expect(aulasNoDia(horarios, 4)).toBe(1)
    expect(aulasNoDia(horarios, 5)).toBe(0)
  })

  it('não passa do máximo de aulas que uma falta aceita', () => {
    const cheio = [
      { dia: 2 as const, inicio: '07:00', fim: '13:00', aulas: 8 },
      { dia: 2 as const, inicio: '18:00', fim: '23:00', aulas: 6 },
    ]
    expect(aulasNoDia(cheio, 2)).toBe(MAXIMO_AULAS_POR_DIA)
    expect(erroFalta({ data: '2026-10-06', quantidade: aulasNoDia(cheio, 2) })).toBeNull()
  })

  it('escreve a faixa', () => {
    expect(faixaHorario({ inicio: '19:00', fim: '22:30', aulas: 4 })).toBe('19:00 às 22:30 (4 aulas)')
    expect(faixaHorario({ inicio: '19:00', fim: '20:00', aulas: 1 })).toBe('19:00 às 20:00 (1 aula)')
    expect(faixaHorario({ inicio: '19:00' })).toBe('19:00')
  })

  it('o carregamento aceita horário antigo e confere o novo', () => {
    const com = (horario: object) => ({ ...dadosVazios(), materias: [{ nome: 'POO', horarios: [horario] }] })
    expect(validarDados(com({ dia: 2, inicio: '19:00' })).ok).toBe(true)
    const novo = validarDados(com({ dia: 2, inicio: '19:00', fim: '22:30', aulas: 4 }))
    expect(novo.ok && novo.valor.materias[0].horarios[0]).toEqual({ dia: 2, inicio: '19:00', fim: '22:30', aulas: 4 })
    expect(validarDados(com({ dia: 2, inicio: '19:00', fim: '18:00' }))).toMatchObject({
      ok: false,
      erro: expect.stringContaining('Horário 1'),
    })
  })
})
