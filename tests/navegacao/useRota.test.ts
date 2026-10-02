import { act, renderHook } from '@testing-library/react'
import { vi } from 'vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { navegar, useBloquearSaida, useRota } from '../../src/navegacao/useRota'

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
    expect(result.current).toEqual({ tela: 'lobby' })
    act(() => {
      navegar({ tela: 'agenda' })
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(result.current).toEqual({ tela: 'agenda' })
  })

  describe('useBloquearSaida', () => {
    /** Uma tela em #/nova-materia, com o bloqueio ligado ou não. */
    function montar(ativo = true) {
      window.location.hash = '#/nova-materia'
      const aoTentarSair = vi.fn()
      const rota = renderHook(() => useRota())
      renderHook(() => useBloquearSaida(ativo, aoTentarSair))
      return { aoTentarSair, rota }
    }

    function clicar(href: string, init: MouseEventInit = {}, target?: string) {
      const link = document.createElement('a')
      link.href = href
      link.setAttribute('href', href)
      if (target) link.target = target
      document.body.append(link)
      const evento = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
      link.dispatchEvent(evento)
      link.remove()
      return evento
    }

    it('segura o clique num link do painel e diz para onde a pessoa ia (normalizado)', () => {
      const { aoTentarSair } = montar()
      expect(clicar('#/agenda').defaultPrevented).toBe(true)
      expect(aoTentarSair).toHaveBeenCalledWith('#/agenda')
      clicar('#/materias/')
      expect(aoTentarSair).toHaveBeenLastCalledWith('#/materias')
      // "#" é o lobby (o nome do painel no topo leva para lá).
      clicar('#')
      expect(aoTentarSair).toHaveBeenLastCalledWith('#/')
    })

    it('deixa passar: link para a mesma tela, com target, Ctrl+clique e bloqueio desligado', () => {
      const { aoTentarSair } = montar()
      expect(clicar('#/nova-materia').defaultPrevented).toBe(false)
      expect(clicar('#/agenda', {}, '_blank').defaultPrevented).toBe(false)
      expect(clicar('#/agenda', { ctrlKey: true }).defaultPrevented).toBe(false)
      expect(aoTentarSair).not.toHaveBeenCalled()
    })

    it('desligado, não segura nada', () => {
      const { aoTentarSair } = montar(false)
      expect(clicar('#/agenda').defaultPrevented).toBe(false)
      expect(aoTentarSair).not.toHaveBeenCalled()
    })

    it('navegar() passa por cima do bloqueio (é o painel que pede, ex.: depois de salvar)', () => {
      const { aoTentarSair, rota } = montar()
      act(() => {
        navegar({ tela: 'agenda' })
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      })
      expect(rota.result.current).toEqual({ tela: 'agenda' })
      expect(aoTentarSair).not.toHaveBeenCalled()
    })
  })
})
