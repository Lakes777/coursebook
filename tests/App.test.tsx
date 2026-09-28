import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'

describe('App', () => {
  it('mostra o título do painel', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Painel de estudos' })).toBeInTheDocument()
  })

  it('roda no fuso de Brasília', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(180)
  })
})
