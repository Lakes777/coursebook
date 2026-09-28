import { describe, expect, it } from 'vitest'
import { formatarNota, formatarPorcentagem, lerNumero, limpar } from '../../src/logica/numeros'

describe('limpar', () => {
  it('tira o lixo do ponto flutuante', () => {
    expect(limpar((0.1 + 5.8) / 2)).toBe(2.95)
  })
})

describe('formatarNota', () => {
  it('usa vírgula e pelo menos 1 casa', () => {
    expect(formatarNota(7)).toBe('7,0')
    expect(formatarNota(6.99)).toBe('6,99')
    expect(formatarNota(10)).toBe('10,0')
    expect(formatarNota(0.3)).toBe('0,3')
  })
})

describe('formatarPorcentagem', () => {
  it('mostra a fração como porcentagem', () => {
    expect(formatarPorcentagem(0.75)).toBe('75%')
    expect(formatarPorcentagem(0.925)).toBe('92,5%')
    expect(formatarPorcentagem((80 - 3) / 80)).toBe('96,2%') // 96,25%: corta, não arredonda
  })

  it('nunca mostra o mínimo para quem ficou abaixo dele', () => {
    expect(formatarPorcentagem(0.7496)).toBe('74,9%')
    expect(formatarPorcentagem(0.9995)).toBe('99,9%')
    expect(formatarPorcentagem(1)).toBe('100%')
  })
})

describe('lerNumero', () => {
  it('aceita vírgula ou ponto', () => {
    expect(lerNumero('7,5')).toBe(7.5)
    expect(lerNumero('7.5')).toBe(7.5)
    expect(lerNumero(' 10 ')).toBe(10)
    expect(lerNumero('0')).toBe(0)
  })

  it('recusa o que não é um número simples', () => {
    for (const texto of ['', ' ', 'abc', '7,5,1', '1.000,5', '-1', '7,', ',5', '1e3', 'Infinity']) {
      expect(lerNumero(texto), texto).toBeNull()
    }
  })
})
