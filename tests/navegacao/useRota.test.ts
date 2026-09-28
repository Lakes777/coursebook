import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { navegar, useRota } from '../../src/navegacao/useRota'

afterEach(() => {
  window.location.hash = ''
})

describe('navegar e useRota', () => {
  it('navegar escreve o hash, com o id escapado', () => {
    navegar({ tela: 'materia', id: 'x y' })
    expect(window.location.hash).toBe('#/materia/x%20y')
  })

  it('useRota acompanha as mudanças do endereço', () => {
    const { result } = renderHook(() => useRota())
    expect(result.current).toEqual({ tela: 'materias' })
    act(() => {
      navegar({ tela: 'agenda' })
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(result.current).toEqual({ tela: 'agenda' })
  })
})
