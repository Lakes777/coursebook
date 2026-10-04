import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { dadosVazios } from '../../src/logica/armazenamento'
import { CHAVE_NUVEM, type ContaGuardada } from '../../src/nuvem/conta'
import { ProvedorNuvem } from '../../src/nuvem/ProvedorNuvem'
import { TelaDados } from '../../src/telas/TelaDados'
import { navegador, NuvemFalsa } from '../nuvem/apoio'

const CONTA: ContaGuardada = { email: 'andre@exemplo.com', revisao: 0, pendente: false }

function montar({ nuvem = new NuvemFalsa(), conta = CONTA as ContaGuardada | null } = {}) {
  const nav = navegador(conta ? { [CHAVE_NUVEM]: JSON.stringify(conta) } : {})
  render(
    <ProvedorPainel inicial={{ dados: dadosVazios(), aviso: null, podeSalvar: true }} armazenamento={nav}>
      <ProvedorNuvem cliente={nuvem} armazenamento={nav}>
        <TelaDados />
      </ProvedorNuvem>
    </ProvedorPainel>,
  )
  return { nuvem, user: userEvent.setup() }
}

const secao = () => screen.getByRole('region', { name: 'Chaves de acesso' })
const naSecao = () => within(secao())

describe('SecaoChaves', () => {
  it('sem conta, não aparece', () => {
    montar({ conta: null })
    expect(screen.queryByRole('region', { name: 'Chaves de acesso' })).not.toBeInTheDocument()
  })

  it('com conta, lista as chaves sem o token, com quando foram criadas e usadas', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.chaves = [
      { id: 'k_1', nome: 'Bot do Telegram', criadaEm: '2026-10-01T15:00:00.000Z', usadaEm: '2026-10-04T11:30:00.000Z' },
      { id: 'k_2', nome: 'Planilha', criadaEm: '2026-10-02T15:00:00.000Z', usadaEm: null },
    ]
    montar({ nuvem })
    const itens = await naSecao().findAllByRole('listitem')
    expect(itens.map((i) => i.textContent)).toEqual([
      expect.stringContaining('Bot do Telegram'),
      expect.stringContaining('Planilha'),
    ])
    // Testes no fuso de Brasília: 11h30 UTC = 08h30.
    expect(itens[0]).toHaveTextContent('Criada em 01/10/2026 às 12:00 · usada pela última vez em 04/10/2026 às 08:30')
    expect(itens[1]).toHaveTextContent('nunca usada')
  })

  it('cria a chave, mostra o token uma vez com o aviso e copia', async () => {
    const { user, nuvem } = montar()
    await naSecao().findByText('Nenhuma chave criada.')
    await user.type(naSecao().getByLabelText('Nome da chave'), '  Bot do Telegram ')
    await user.click(naSecao().getByRole('button', { name: 'Criar chave' }))

    const nova = naSecao().getByRole('group', { name: 'Chave "Bot do Telegram" criada' })
    expect(nova).toHaveFocus()
    expect(within(nova).getByText('cb_token-falso-1')).toBeInTheDocument()
    expect(within(nova).getByText(/Copie agora: ela não aparece de novo/)).toBeInTheDocument()
    expect(nuvem.chaves.map((c) => c.nome)).toEqual(['Bot do Telegram'])
    expect(naSecao().getByLabelText('Nome da chave')).toHaveValue('')

    await user.click(within(nova).getByRole('button', { name: 'Copiar chave' }))
    expect(await navigator.clipboard.readText()).toBe('cb_token-falso-1')
    expect(naSecao().getByText('Chave copiada.')).toBeInTheDocument()

    // Fechou, o token some de vez: a lista só tem o nome.
    await user.click(within(nova).getByRole('button', { name: 'Pronto, já guardei' }))
    expect(naSecao().queryByText('cb_token-falso-1')).not.toBeInTheDocument()
    expect(naSecao().getByRole('listitem')).toHaveTextContent('Bot do Telegram')
    expect(naSecao().getByLabelText('Nome da chave')).toHaveFocus()
  })

  it('sem acesso à área de transferência, pede para copiar à mão', async () => {
    const { user } = montar()
    await naSecao().findByText('Nenhuma chave criada.')
    await user.type(naSecao().getByLabelText('Nome da chave'), 'Bot')
    await user.click(naSecao().getByRole('button', { name: 'Criar chave' }))
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('bloqueado'))
    await user.click(naSecao().getByRole('button', { name: 'Copiar chave' }))
    expect(naSecao().getByText('Não deu para copiar sozinho: selecione a chave e copie.')).toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('nome vazio não chama a API', async () => {
    const { user, nuvem } = montar()
    await naSecao().findByText('Nenhuma chave criada.')
    await user.click(naSecao().getByRole('button', { name: 'Criar chave' }))
    expect(naSecao().getByLabelText('Nome da chave')).toHaveAccessibleDescription(
      expect.stringContaining('Dê um nome à chave'),
    )
    expect(nuvem.chamadas).not.toContain('criarChave')
  })

  it('apaga em 2 passos', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.chaves = [{ id: 'k_1', nome: 'Bot', criadaEm: '2026-10-01T15:00:00.000Z', usadaEm: null }]
    const { user } = montar({ nuvem })
    await user.click(await naSecao().findByRole('button', { name: 'Apagar a chave Bot' }))
    await user.click(naSecao().getByRole('button', { name: 'Confirmar remoção de a chave Bot' }))
    expect(await naSecao().findByText('Nenhuma chave criada.')).toBeInTheDocument()
    expect(naSecao().getByText('Chave "Bot" apagada. Ela não abre mais os prazos.')).toBeInTheDocument()
    expect(nuvem.chaves).toEqual([])
  })

  it('no limite de 5, o formulário fica desativado e explica', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.chaves = [1, 2, 3, 4, 5].map((n) => ({
      id: `k_${n}`,
      nome: `Chave ${n}`,
      criadaEm: '2026-10-01T15:00:00.000Z',
      usadaEm: null,
    }))
    montar({ nuvem })
    expect(await naSecao().findAllByRole('listitem')).toHaveLength(5)
    expect(naSecao().getByLabelText('Nome da chave')).toBeDisabled()
    expect(naSecao().getByRole('button', { name: 'Criar chave' })).toBeDisabled()
    expect(naSecao().getByText(/Cada conta pode ter até 5 chaves/)).toBeInTheDocument()
  })

  it('erro da API ao criar aparece na seção', async () => {
    const { user, nuvem } = montar()
    await naSecao().findByText('Nenhuma chave criada.')
    nuvem.online = false
    await user.type(naSecao().getByLabelText('Nome da chave'), 'Bot')
    await user.click(naSecao().getByRole('button', { name: 'Criar chave' }))
    expect(await naSecao().findByRole('alert')).toHaveTextContent('Sem conexão com a internet.')
    expect(naSecao().getByRole('alert')).toHaveFocus()
  })
})
