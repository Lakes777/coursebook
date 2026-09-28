import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { ProvedorPainel } from '../src/estado/ProvedorPainel'
import { dadosVazios } from '../src/logica/armazenamento'

describe('App', () => {
  it('mostra o título do painel', () => {
    render(
      <ProvedorPainel inicial={{ dados: dadosVazios(), aviso: null, podeSalvar: false }}>
        <App />
      </ProvedorPainel>,
    )
    expect(screen.getByRole('heading', { name: 'Painel de estudos' })).toBeInTheDocument()
  })

  it('roda no fuso de Brasília', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(180)
  })
})
