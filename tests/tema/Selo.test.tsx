import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Selo } from '../../src/componentes/Selo'

describe('Selo', () => {
  it('mostra o texto com a classe do tom', () => {
    render(<Selo tom="atencao">Recuperação</Selo>)
    const selo = screen.getByText('Recuperação')
    expect(selo).toHaveClass('selo', 'selo--atencao')
  })

  it('o ícone fica escondido do leitor de tela (o texto já diz tudo)', () => {
    const { container } = render(<Selo tom="perigo">Reprovado</Selo>)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
