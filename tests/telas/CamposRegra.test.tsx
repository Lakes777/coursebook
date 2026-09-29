import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { REGRA_PUCPR } from '../../src/logica/tipos'
import { CamposRegra } from '../../src/telas/CamposRegra'
import { idsRegra, regraParaForm, type ErroCampo, type RegraForm } from '../../src/telas/novaMateriaUtil'

const IDS = idsRegra('teste')

/** Guarda o estado como o formulário faz; `mudar` registra cada chamada. */
function montar(erro: ErroCampo | null = null) {
  const mudar = vi.fn<(campos: Partial<RegraForm>, campo?: string) => void>()
  function Casca() {
    const [regra, setRegra] = useState(regraParaForm(REGRA_PUCPR))
    return (
      <CamposRegra
        legenda="Regra de teste"
        regra={regra}
        ids={IDS}
        erro={erro}
        mudar={(campos, campo) => {
          mudar(campos, campo)
          setRegra((r) => ({ ...r, ...campos }))
        }}
      />
    )
  }
  render(<Casca />)
  return mudar
}

describe('CamposRegra', () => {
  it('mostra a regra preenchida, com os ids pedidos', () => {
    montar()
    expect(screen.getByRole('group', { name: 'Regra de teste' })).toBeInTheDocument()
    expect(screen.getByLabelText('Média mínima')).toHaveValue('7')
    expect(screen.getByLabelText('Média mínima')).toHaveAttribute('id', IDS.media)
    expect(screen.getByLabelText('Frequência mínima (%)')).toHaveValue('75')
    expect(screen.getByLabelText('Tem recuperação no fim do semestre')).toBeChecked()
    expect(screen.getByLabelText('Nota final mínima para a recuperação')).toHaveValue('4')
    expect(screen.getByLabelText('Nota máxima da recuperação')).toHaveValue('7')
    expect(screen.getByLabelText('Arredondar a nota final para 1 casa (6,95 vira 7,0)')).not.toBeChecked()
  })

  it('manda cada mudança com o id do campo, e esconde a recuperação ao desmarcar', async () => {
    const mudar = montar()
    const media = screen.getByLabelText('Média mínima')
    await userEvent.clear(media)
    await userEvent.type(media, '6,5')
    await userEvent.click(screen.getByLabelText('Tem recuperação no fim do semestre'))
    expect(media).toHaveValue('6,5')
    expect(mudar).toHaveBeenLastCalledWith({ temRecuperacao: false }, undefined)
    expect(mudar).toHaveBeenCalledWith({ mediaMinima: '6,5' }, IDS.media)
    expect(screen.queryByLabelText('Nota máxima da recuperação')).not.toBeInTheDocument()
  })

  it('liga o erro ao campo dele', () => {
    montar({ campo: IDS.teto, mensagem: 'Teto errado.' })
    const teto = screen.getByLabelText('Nota máxima da recuperação')
    expect(teto).toHaveAttribute('aria-invalid', 'true')
    expect(teto).toHaveAccessibleDescription(/Teto errado\./)
    expect(screen.getByLabelText('Média mínima')).not.toHaveAttribute('aria-invalid')
  })
})
