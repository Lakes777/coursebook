import { act, fireEvent, render, screen } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'
import { TEMPO_DESFAZER_MS } from '../../src/componentes/AvisoDesfazer'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { CHAVE, dadosVazios } from '../../src/logica/armazenamento'
import type { Evento } from '../../src/logica/tipos'
import { criarUsuario } from '../usuario'

function navegador() {
  const itens = new Map<string, string>()
  return {
    itens,
    getItem: (chave: string) => itens.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void itens.set(chave, valor),
  }
}

const EVENTOS: Evento[] = [
  { id: 'quiz', titulo: 'Quiz', tipo: 'prova', data: '2026-10-02', concluido: false },
  { id: 'lista', titulo: 'Lista', tipo: 'trabalho', data: '2026-10-05', concluido: false },
]

function montar() {
  window.location.hash = '#/agenda'
  const nav = navegador()
  render(
    <ProvedorPainel
      inicial={{ dados: { ...dadosVazios(), eventos: EVENTOS }, aviso: null, podeSalvar: true }}
      armazenamento={nav}
    >
      <App />
    </ProvedorPainel>,
  )
  return nav
}

/** Remove pelo botão de 2 passos da agenda. */
function remover(titulo: string) {
  fireEvent.click(screen.getByRole('button', { name: `Remover ${titulo}` }))
  fireEvent.click(screen.getByRole('button', { name: `Confirmar remoção de ${titulo}` }))
}

const salvos = (nav: ReturnType<typeof navegador>) =>
  (JSON.parse(nav.itens.get(CHAVE)!) as { eventos: Evento[] }).eventos.map((e) => e.titulo)

afterEach(() => {
  vi.useRealTimers()
  window.location.hash = ''
})

let user: UserEvent
beforeEach(() => {
  user = criarUsuario()
})

describe('AvisoDesfazer', () => {
  it('depois de remover, oferece desfazer e volta o item (na tela e no que foi salvo)', async () => {
    const nav = montar()
    remover('Quiz')
    expect(screen.queryByText('Quiz')).not.toBeInTheDocument()
    expect(screen.getByText('"Quiz" removido da agenda.')).toBeInTheDocument()
    expect(salvos(nav)).toEqual(['Lista'])

    await user.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(screen.getByText('Quiz')).toBeInTheDocument()
    expect(salvos(nav)).toEqual(['Quiz', 'Lista'])
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument()
    expect(screen.getByText('Desfeito.')).toBeInTheDocument()
  })

  it('só a última remoção é desfeita', async () => {
    montar()
    remover('Quiz')
    remover('Lista')
    expect(screen.getByText('"Lista" removido da agenda.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(screen.getByText('Lista')).toBeInTheDocument()
    expect(screen.queryByText('Quiz')).not.toBeInTheDocument()
  })

  it('fechar some com o aviso sem voltar nada', async () => {
    montar()
    remover('Quiz')
    await user.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument()
    expect(screen.queryByText('Quiz')).not.toBeInTheDocument()
  })

  it('some sozinho depois de um tempo, mas não enquanto o mouse está em cima', () => {
    vi.useFakeTimers()
    montar()
    remover('Quiz')
    const aviso = document.querySelector('.desfazer')!
    fireEvent.mouseEnter(aviso)
    act(() => vi.advanceTimersByTime(TEMPO_DESFAZER_MS * 2))
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeInTheDocument()
    fireEvent.mouseLeave(aviso)
    act(() => vi.advanceTimersByTime(TEMPO_DESFAZER_MS))
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument()
  })

  it('Ctrl+Z desfaz, menos dentro de um campo (lá é o do próprio campo)', async () => {
    montar()
    remover('Quiz')
    await user.click(screen.getAllByRole('textbox')[0])
    await user.keyboard('{Control>}z{/Control}')
    expect(screen.queryByText('Quiz')).not.toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(screen.getByText('Quiz')).toBeInTheDocument()
  })
})
