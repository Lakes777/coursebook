import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SituacaoFaltas } from '../../src/logica/faltas'
import { BarraFaltas } from '../../src/telas/materia/BarraFaltas'

function largura(situacao: SituacaoFaltas) {
  const { container } = render(<BarraFaltas situacao={situacao} />)
  return (container.querySelector('.barra-faltas > span') as HTMLElement | null)?.style.width ?? null
}

describe('BarraFaltas', () => {
  it('enche na fração das faltas usadas, sem passar de 100%', () => {
    expect(largura({ total: 6, limite: 30, restantes: 24, frequencia: 0.95, nivel: 'ok' })).toBe('20%')
    expect(largura({ total: 40, limite: 30, restantes: -10, frequencia: 0.6, nivel: 'reprovado' })).toBe('100%')
  })

  it('limite 0 com falta é barra cheia; sem carga horária não há barra', () => {
    expect(largura({ total: 1, limite: 0, restantes: -1, frequencia: 0.7, nivel: 'reprovado' })).toBe('100%')
    expect(largura({ total: 2, limite: 0, restantes: 0, frequencia: null, nivel: 'sem-carga-horaria' })).toBeNull()
  })

  it('é só desenho: fica escondida do leitor de tela', () => {
    const { container } = render(
      <BarraFaltas situacao={{ total: 3, limite: 15, restantes: 12, frequencia: 0.9, nivel: 'ok' }} />,
    )
    expect(container.querySelector('.barra-faltas')).toHaveAttribute('aria-hidden', 'true')
  })
})
