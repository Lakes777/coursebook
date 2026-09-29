import { describe, expect, it } from 'vitest'
import { iguais } from '../../src/logica/iguais'

describe('iguais', () => {
  it('ignora a ordem dos campos', () => {
    expect(iguais({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true)
  })

  it('a ordem das listas importa', () => {
    expect(iguais([1, 2], [2, 1])).toBe(false)
  })

  it('acha diferença em qualquer nível, e campo a mais ou a menos', () => {
    expect(iguais({ a: { b: [{ c: 1 }] } }, { a: { b: [{ c: 2 }] } })).toBe(false)
    expect(iguais({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(iguais({ a: null }, { a: 0 })).toBe(false)
    expect(iguais([], {})).toBe(false)
  })

  it('campo undefined conta como ausente, como no JSON', () => {
    expect(iguais({ a: 1, b: undefined }, { a: 1 })).toBe(true)
  })
})
