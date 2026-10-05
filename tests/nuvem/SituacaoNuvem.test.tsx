import { render, screen, waitFor } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { dadosVazios } from '../../src/logica/armazenamento'
import type { Dados } from '../../src/logica/tipos'
import { CHAVE_NUVEM, type ContaGuardada } from '../../src/nuvem/conta'
import { ProvedorNuvem } from '../../src/nuvem/ProvedorNuvem'
import { comMaterias, navegador, NuvemFalsa } from './apoio'
import { criarUsuario } from '../usuario'

function montar(nuvem: NuvemFalsa, conta?: ContaGuardada, dados: Dados = dadosVazios()) {
  const nav = navegador(conta ? { [CHAVE_NUVEM]: JSON.stringify(conta) } : {})
  // A situação fica no topo do painel; o lobby (endereço raiz) não tem topo.
  if (!window.location.hash) window.location.hash = '#/materias'
  render(
    <ProvedorPainel inicial={{ dados, aviso: null, podeSalvar: true }} armazenamento={nav}>
      <ProvedorNuvem cliente={nuvem} armazenamento={nav}>
        <App />
      </ProvedorNuvem>
    </ProvedorPainel>,
  )
}

const topo = () => screen.getByRole('banner')
const conta = (campos: Partial<ContaGuardada> = {}): ContaGuardada => ({
  email: 'andre@exemplo.com',
  revisao: 1,
  pendente: false,
  ...campos,
})

function nuvemCom(dados: Dados | null, revisao: number) {
  const nuvem = new NuvemFalsa()
  nuvem.dados = dados
  nuvem.revisao = revisao
  return nuvem
}

afterEach(() => {
  window.location.hash = ''
})

let user: UserEvent
beforeEach(() => {
  user = criarUsuario()
})

describe('situação da nuvem no topo', () => {
  it('sem conta, não aparece', () => {
    montar(new NuvemFalsa())
    expect(topo()).not.toHaveTextContent(/Sincroniz|Salvando|conexão/)
  })

  it('com conta em dia: "Sincronizado", em texto', async () => {
    montar(nuvemCom(dadosVazios(), 1), conta())
    expect(topo()).toHaveTextContent('Sincronizando...')
    await waitFor(() => expect(topo()).toHaveTextContent('Sincronizado'))
  })

  it('sem internet: "Sem conexão: salvo neste aparelho", anunciado ao leitor de tela', async () => {
    const nuvem = nuvemCom(dadosVazios(), 1)
    nuvem.online = false
    montar(nuvem, conta())
    await waitFor(() => expect(topo()).toHaveTextContent('Sem conexão: salvo neste aparelho'))
    expect(screen.getAllByRole('status').some((s) => s.textContent === 'Sem conexão: salvo neste aparelho')).toBe(true)
  })

  it('sessão acabada: "Entre de novo para sincronizar"', async () => {
    const nuvem = nuvemCom(dadosVazios(), 1)
    nuvem.logado = false
    montar(nuvem, conta())
    const link = await screen.findByRole('link', { name: 'Entre de novo para sincronizar' })
    expect(link).toHaveAttribute('href', '#/dados')
  })

  it('conflito: link que leva à pergunta na tela Dados', async () => {
    window.location.hash = '#/dados'
    montar(nuvemCom(comMaterias('Cálculo'), 5), conta({ pendente: true }), comMaterias('POO'))
    const link = await screen.findByRole('link', { name: 'Conflito: escolha qual versão manter' })
    expect(link).toHaveAttribute('href', '#/dados')
    // Já na tela Dados, o clique leva o foco até a seção da conta, onde está a pergunta.
    await user.click(link)
    expect(screen.getByRole('heading', { name: 'Conta e nuvem' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Usar a da nuvem' })).toBeInTheDocument()
  })
})
