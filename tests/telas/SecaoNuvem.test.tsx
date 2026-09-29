import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AvisoDesfazer } from '../../src/componentes/AvisoDesfazer'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { CHAVE, dadosVazios } from '../../src/logica/armazenamento'
import type { Dados } from '../../src/logica/tipos'
import { CHAVE_NUVEM, lerConta, type ContaGuardada } from '../../src/nuvem/conta'
import { ProvedorNuvem } from '../../src/nuvem/ProvedorNuvem'
import { TelaDados } from '../../src/telas/TelaDados'
import { comMaterias, navegador, NuvemFalsa } from '../nuvem/apoio'

interface Montagem {
  dados?: Dados
  conta?: ContaGuardada
  nuvem?: NuvemFalsa
}

function montar({ dados = dadosVazios(), conta, nuvem = new NuvemFalsa() }: Montagem = {}) {
  const nav = navegador(conta ? { [CHAVE_NUVEM]: JSON.stringify(conta) } : {})
  render(
    <ProvedorPainel inicial={{ dados, aviso: null, podeSalvar: true }} armazenamento={nav}>
      <ProvedorNuvem cliente={nuvem} armazenamento={nav}>
        <TelaDados />
        <AvisoDesfazer />
      </ProvedorNuvem>
    </ProvedorPainel>,
  )
  return { nav, nuvem, user: userEvent.setup() }
}

const secao = () => screen.getByRole('region', { name: 'Conta e nuvem' })
const naSecao = () => within(secao())
const conta = (campos: Partial<ContaGuardada> = {}): ContaGuardada => ({
  email: 'andre@exemplo.com',
  revisao: 1,
  pendente: false,
  ...campos,
})

/** Nuvem já com dados, como se outro aparelho tivesse salvo. */
function nuvemCom(dados: Dados | null, revisao: number) {
  const nuvem = new NuvemFalsa()
  nuvem.dados = dados
  nuvem.revisao = revisao
  return nuvem
}

async function preencher(user: ReturnType<typeof userEvent.setup>, campos: Record<string, string>) {
  for (const [rotulo, valor] of Object.entries(campos)) {
    const campo = naSecao().getByLabelText(rotulo)
    await user.clear(campo)
    if (valor) await user.type(campo, valor)
  }
}

describe('SecaoNuvem', () => {
  it('sem conta: explica e mostra o formulário de entrar, sem chamar a API', () => {
    const { nuvem } = montar()
    expect(naSecao().getByText(/Guarde seus dados na nuvem para usar em mais de um aparelho\./)).toBeInTheDocument()
    expect(naSecao().getByRole('form', { name: 'Entrar' })).toBeInTheDocument()
    expect(nuvem.chamadas).toEqual([])
  })

  it('confere o formulário antes de chamar a API', async () => {
    const { nuvem, user } = montar()
    await user.click(naSecao().getByRole('button', { name: 'Entrar' }))
    const email = naSecao().getByLabelText('E-mail')
    expect(email).toHaveFocus()
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription('Informe o e-mail.')
    expect(nuvem.chamadas).toEqual([])
  })

  it('e-mail ou senha errados aparecem no campo da senha', async () => {
    const { user } = montar()
    await preencher(user, { 'E-mail': 'andre@exemplo.com', Senha: 'errada' })
    await user.click(naSecao().getByRole('button', { name: 'Entrar' }))
    const senha = await naSecao().findByLabelText('Senha')
    await waitFor(() => expect(senha).toHaveAccessibleDescription('E-mail ou senha errados.'))
    expect(senha).toHaveFocus()
  })

  it('erros sem campo (ex.: bloqueado) aparecem como alerta geral', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.proximoErro = { status: 429, erro: { codigo: 'bloqueado', erro: 'Muitas tentativas. Espere 15 minutos.' } }
    const { user } = montar({ nuvem })
    await preencher(user, { 'E-mail': 'andre@exemplo.com', Senha: 'senha-certa' })
    await user.click(naSecao().getByRole('button', { name: 'Entrar' }))
    const alerta = await naSecao().findByRole('alert')
    expect(alerta).toHaveTextContent('Muitas tentativas. Espere 15 minutos.')
    expect(alerta).toHaveFocus()
  })

  it('desativa o botão enquanto a chamada está em andamento', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.segurar()
    const { user } = montar({ nuvem })
    await preencher(user, { 'E-mail': 'andre@exemplo.com', Senha: 'senha-certa' })
    await user.click(naSecao().getByRole('button', { name: 'Entrar' }))
    expect(naSecao().getByRole('button', { name: 'Entrando...' })).toBeDisabled()
    nuvem.soltar()
    await waitFor(() => expect(naSecao().getByText('Você entrou como andre@exemplo.com.')).toBeInTheDocument())
  })

  it('cria a conta com o convite, e o aparelho com matérias envia os dados para a nuvem vazia', async () => {
    const nuvem = nuvemCom(null, 0)
    const { user, nav } = montar({ nuvem, dados: comMaterias('POO') })
    await user.click(naSecao().getByRole('button', { name: 'Criar conta' }))
    expect(naSecao().getByLabelText('E-mail')).toHaveFocus()
    expect(naSecao().getByLabelText('Senha')).toHaveAccessibleDescription('Pelo menos 8 caracteres.')

    await preencher(user, { 'E-mail': 'novo@exemplo.com', Senha: 'curta', 'Código de convite': 'abc' })
    await user.click(naSecao().getByRole('button', { name: 'Criar conta' }))
    expect(naSecao().getByLabelText('Senha')).toHaveAccessibleDescription(
      'Pelo menos 8 caracteres. A senha precisa ter pelo menos 8 caracteres.',
    )

    await preencher(user, { Senha: 'uma-senha-boa' })
    await user.click(naSecao().getByRole('button', { name: 'Criar conta' }))
    const criada = 'Conta criada. Você entrou como novo@exemplo.com.'
    await waitFor(() => expect(naSecao().getByText(criada)).toBeInTheDocument())
    expect(naSecao().getByRole('heading', { name: 'Conta e nuvem' })).toHaveFocus()
    await waitFor(() => expect(naSecao().getByText('Tudo sincronizado com a nuvem.')).toBeInTheDocument())
    expect(nuvem.dados).toEqual(comMaterias('POO'))
    expect(lerConta(nav)).toEqual({ email: 'novo@exemplo.com', revisao: 1, pendente: false })
  })

  it('convite errado aparece no campo do convite', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.proximoErro = { status: 403, erro: { codigo: 'convite-invalido', erro: 'Código de convite errado.' } }
    const { user } = montar({ nuvem })
    await user.click(naSecao().getByRole('button', { name: 'Criar conta' }))
    await preencher(user, { 'E-mail': 'novo@exemplo.com', Senha: 'uma-senha-boa', 'Código de convite': 'x' })
    await user.click(naSecao().getByRole('button', { name: 'Criar conta' }))
    const convite = naSecao().getByLabelText('Código de convite')
    await waitFor(() => expect(convite).toHaveFocus())
    expect(convite).toHaveAccessibleDescription(/Código de convite errado\./)
  })

  it('primeira vez com dados diferentes: pergunta, e "Usar os da nuvem" dá para desfazer', async () => {
    const nuvem = nuvemCom(comMaterias('Cálculo', 'Física'), 3)
    const { user, nav } = montar({ nuvem, dados: comMaterias('POO') })
    await preencher(user, { 'E-mail': 'andre@exemplo.com', Senha: 'senha-certa' })
    await user.click(naSecao().getByRole('button', { name: 'Entrar' }))

    const pergunta = await naSecao().findByRole('group', { name: 'Esta conta já tem dados na nuvem.' })
    expect(pergunta).toHaveTextContent(
      'Na nuvem: 2 matérias e 0 eventos na agenda. Neste aparelho: 1 matéria e 0 eventos na agenda.',
    )
    await user.click(within(pergunta).getByRole('button', { name: 'Usar os da nuvem' }))
    expect(naSecao().getByText('Pronto: o painel está com os dados da nuvem.')).toBeInTheDocument()
    expect(JSON.parse(nav.itens.get(CHAVE)!)).toEqual(comMaterias('Cálculo', 'Física'))

    await user.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(JSON.parse(nav.itens.get(CHAVE)!)).toEqual(comMaterias('POO'))
  })

  it('"Substituir pelos deste aparelho" manda os dados daqui para a nuvem', async () => {
    const nuvem = nuvemCom(comMaterias('Cálculo'), 3)
    const { user } = montar({ nuvem, dados: comMaterias('POO') })
    await preencher(user, { 'E-mail': 'andre@exemplo.com', Senha: 'senha-certa' })
    await user.click(naSecao().getByRole('button', { name: 'Entrar' }))
    await user.click(await naSecao().findByRole('button', { name: 'Substituir pelos deste aparelho' }))
    await waitFor(() => expect(nuvem.dados).toEqual(comMaterias('POO')))
  })

  it('conflito: pergunta qual versão manter', async () => {
    const nuvem = nuvemCom(comMaterias('Cálculo'), 5)
    const { user } = montar({ nuvem, dados: comMaterias('POO'), conta: conta({ revisao: 2, pendente: true }) })
    const pergunta = await naSecao().findByRole('group', { name: 'Os dados mudaram em outro aparelho e também aqui.' })
    await user.click(within(pergunta).getByRole('button', { name: 'Manter a deste aparelho' }))
    await waitFor(() => expect(nuvem.salvos).toEqual([{ dados: comMaterias('POO'), revisao: 5 }]))
  })

  it('logado: mostra o e-mail e a situação; Sair deixa os dados no aparelho', async () => {
    const nuvem = nuvemCom(comMaterias('POO'), 1)
    const { user, nav } = montar({ nuvem, dados: comMaterias('POO'), conta: conta() })
    expect(naSecao().getByText('andre@exemplo.com')).toBeInTheDocument()
    await waitFor(() => expect(naSecao().getByText('Tudo sincronizado com a nuvem.')).toBeInTheDocument())

    await user.click(naSecao().getByRole('button', { name: 'Sair' }))
    await waitFor(() =>
      expect(naSecao().getByText('Você saiu da conta. Os dados continuam neste aparelho.')).toBeInTheDocument(),
    )
    expect(nav.itens.has(CHAVE_NUVEM)).toBe(false)
    expect(naSecao().getByRole('form', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByText(/Hoje o painel tem 1 matéria/)).toBeInTheDocument()
  })

  it('"Sair e apagar" confirma antes, e avisa quando há mudança não enviada', async () => {
    const nuvem = nuvemCom(comMaterias('POO'), 1)
    nuvem.online = false
    const { user, nav } = montar({ nuvem, dados: comMaterias('POO', 'BD'), conta: conta({ pendente: true }) })
    await user.click(naSecao().getByRole('button', { name: 'Sair e apagar os dados deste aparelho' }))
    expect(naSecao().getByText(/Há mudanças feitas aqui que ainda não foram para a nuvem/)).toBeInTheDocument()
    expect(naSecao().getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.click(naSecao().getByRole('button', { name: 'Cancelar' }))
    expect(naSecao().getByRole('button', { name: 'Sair e apagar os dados deste aparelho' })).toHaveFocus()

    await user.click(naSecao().getByRole('button', { name: 'Sair e apagar os dados deste aparelho' }))
    nuvem.online = true
    await user.click(naSecao().getByRole('button', { name: 'Sair e apagar' }))
    await waitFor(() => expect(nav.itens.has(CHAVE_NUVEM)).toBe(false))
    expect(screen.getByText(/Hoje o painel tem 0 matérias/)).toBeInTheDocument()
  })

  it('excluir conta pede a senha, mostra senha errada no campo e diz que os dados do aparelho ficam', async () => {
    const nuvem = nuvemCom(comMaterias('POO'), 1)
    const { user, nav } = montar({ nuvem, dados: comMaterias('POO'), conta: conta() })
    await user.click(naSecao().getByRole('button', { name: 'Excluir conta' }))
    const senha = naSecao().getByLabelText('Senha')
    expect(senha).toHaveFocus()

    await user.click(naSecao().getByRole('button', { name: 'Excluir conta' }))
    expect(senha).toHaveAccessibleDescription('Informe a senha para excluir a conta.')
    await user.type(senha, 'errada')
    await user.click(naSecao().getByRole('button', { name: 'Excluir conta' }))
    await waitFor(() => expect(naSecao().getByLabelText('Senha')).toHaveAccessibleDescription('Senha errada.'))

    await user.clear(naSecao().getByLabelText('Senha'))
    await user.type(naSecao().getByLabelText('Senha'), 'senha-certa')
    await user.click(naSecao().getByRole('button', { name: 'Excluir conta' }))
    await waitFor(() => expect(naSecao().getByText(/Os dados deste aparelho continuam aqui\./)).toBeInTheDocument())
    expect(nav.itens.has(CHAVE_NUVEM)).toBe(false)
    expect(nuvem.dados).toBeNull()
    expect(screen.getByText(/Hoje o painel tem 1 matéria/)).toBeInTheDocument()
  })

  it('sessão acabada: pede para entrar de novo, com o e-mail já preenchido', async () => {
    const nuvem = nuvemCom(comMaterias('POO'), 1)
    nuvem.logado = false
    const { user } = montar({ nuvem, dados: comMaterias('POO', 'BD'), conta: conta({ pendente: true }) })
    await waitFor(() => expect(naSecao().getByText(/Sua sessão terminou/)).toBeInTheDocument())
    expect(naSecao().getByLabelText('E-mail')).toHaveValue('andre@exemplo.com')
    await user.type(naSecao().getByLabelText('Senha'), 'senha-certa')
    await user.click(naSecao().getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(nuvem.dados).toEqual(comMaterias('POO', 'BD')))
  })
})
