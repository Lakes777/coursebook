import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { ProvedorPainel } from '../src/estado/ProvedorPainel'
import { dadosVazios } from '../src/logica/armazenamento'
import { dadosDeExemplo } from '../src/logica/exemplo'

/** Monta o App no endereço dado; o padrão é a lista de matérias (a raiz é o Início). */
function montar(hash = '#/materias') {
  window.location.hash = hash
  render(
    <ProvedorPainel inicial={{ dados: dadosVazios(), aviso: null, podeSalvar: false }}>
      <App />
    </ProvedorPainel>,
  )
}

/** Troca o endereço como o navegador faz (o jsdom também dispara o hashchange). */
function irPara(hash: string) {
  act(() => {
    window.location.hash = hash
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

afterEach(() => {
  window.location.hash = ''
})

describe('App', () => {
  it('mostra o título do painel', () => {
    montar()
    const titulo = screen.getByRole('heading', { level: 1 })
    expect(titulo).toHaveTextContent('Coursebook')
    // O logo (a grade) não entra no nome do título.
    expect(titulo.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('começa na tela de matérias, com a aba marcada', () => {
    montar()
    expect(screen.getByRole('heading', { level: 2, name: 'Matérias' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Matérias' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Agenda' })).not.toHaveAttribute('aria-current')
  })

  it('troca de tela pelas abas', async () => {
    montar()
    await userEvent.click(screen.getByRole('link', { name: 'Agenda' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Agenda' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page')
  })

  it('tem a aba da semana entre Matérias e Agenda', async () => {
    montar()
    const nav = screen.getByRole('navigation', { name: 'Seções' })
    const abas = within(nav).getAllByRole('link').map((a) => a.textContent)
    expect(abas).toEqual(['Início', 'Matérias', 'Semana', 'Agenda', 'Dados'])
    await userEvent.click(screen.getByRole('link', { name: 'Semana' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Semana' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Semana' })).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe('Semana · Coursebook')
  })

  it('segue o endereço (botão voltar, link colado)', () => {
    montar()
    irPara('#/nova-materia')
    expect(screen.getByRole('heading', { level: 2, name: 'Nova matéria' })).toBeInTheDocument()
    // A nova matéria fica dentro da aba "Matérias".
    expect(screen.getByRole('link', { name: 'Matérias' })).toHaveAttribute('aria-current', 'page')
    irPara('#/materias')
    expect(screen.getByRole('heading', { level: 2, name: 'Matérias' })).toBeInTheDocument()
  })

  it('põe o foco no título da tela nova, mas não ao abrir a página', () => {
    montar()
    const titulo = screen.getByRole('heading', { level: 2, name: 'Matérias' })
    expect(titulo).not.toHaveFocus()
    irPara('#/agenda')
    expect(screen.getByRole('heading', { level: 2, name: 'Agenda' })).toHaveFocus()
  })

  it('muda o título da aba do navegador', () => {
    montar()
    expect(document.title).toBe('Matérias · Coursebook')
    irPara('#/agenda')
    expect(document.title).toBe('Agenda · Coursebook')
  })

  it('avisa quando a matéria do endereço não existe', () => {
    montar()
    irPara('#/materia/nao-existe')
    expect(screen.getByRole('heading', { level: 2, name: 'Matéria não encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para as matérias' })).toHaveAttribute('href', '#/materias')
  })

  it('o nome na barra lateral leva de volta ao Início', async () => {
    montar()
    const nome = screen.getByRole('link', { name: 'Coursebook' })
    expect(nome).toHaveAttribute('href', '#/')
    await userEvent.click(nome)
    expect(screen.getByRole('heading', { level: 1, name: /Notas, faltas e prazos/ })).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
  })

  it('a aba "Início" leva ao Início', async () => {
    montar('#/agenda')
    const inicio = screen.getByRole('link', { name: 'Início' })
    expect(inicio).toHaveAttribute('href', '#/')
    await userEvent.click(inicio)
    expect(screen.getByRole('link', { name: /Cadastrar a primeira matéria/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: /Notas, faltas e prazos/ })).toHaveFocus()
  })

  it('endereço desconhecido continua indo para a lista de matérias', () => {
    montar('#/nada')
    expect(screen.getByRole('heading', { level: 2, name: 'Matérias' })).toBeInTheDocument()
  })

  it('roda no fuso de Brasília', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(180)
  })
})

/** Monta o App com os dados de exemplo, num momento fixo. */
function montarComExemplo(hash: string, agora: Date) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(agora)
  window.location.hash = hash
  render(
    <ProvedorPainel inicial={{ dados: dadosDeExemplo(agora), aviso: null, podeSalvar: true }}>
      <App />
    </ProvedorPainel>,
  )
}

describe('Início', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each(['', '#', '#/'])('aparece no endereço raiz (%j), com a barra e a aba "Início" marcada', (hash) => {
    montar(hash)
    // Um h1 só: a frase do Início (o nome na barra vira texto comum aqui).
    const titulos = screen.getAllByRole('heading', { level: 1 })
    expect(titulos).toHaveLength(1)
    expect(titulos[0]).toHaveClass('inicio__frase')
    expect(screen.getByRole('banner')).toHaveTextContent('Coursebook')
    const nav = screen.getByRole('navigation', { name: 'Seções' })
    expect(within(nav).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Matérias' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('heading', { level: 2, name: 'Matérias' })).not.toBeInTheDocument()
    expect(document.title).toBe('Coursebook')
  })

  it('vazio: mostra os destaques, os dois jeitos de começar e o link para o código', () => {
    montar('')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByRole('link', { name: /Cadastrar a primeira matéria/ })).toHaveAttribute('href', '#/nova-materia')
    expect(screen.getByRole('button', { name: /Ver com dados de exemplo/ })).toBeInTheDocument()
    const codigo = screen.getByRole('link', { name: 'Ver o código no GitHub' })
    expect(codigo).toHaveAttribute('href', 'https://github.com/Lakes777/coursebook')
    expect(codigo).toHaveAttribute('target', '_blank')
  })

  it('mostra os avisos do armazenamento acima da frase', () => {
    // montar() usa podeSalvar: false, como um navegador que não deixa gravar.
    montar('')
    const aviso = screen.getByText(/Nada está sendo salvo neste navegador/)
    const titulo = screen.getByRole('heading', { level: 1 })
    expect(aviso.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('com dados: a frase do dia, o semestre, a régua de hoje, o atrasado e os próximos prazos', () => {
    // Quinta, 19:40: no exemplo, POO tem aula das 19:00 às 22:15.
    montarComExemplo('#/', new Date(2026, 9, 29, 19, 40))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Quinta, 29 de outubro. Programação Orientada a Objetos agora, Entrega do relatório final hoje e uma matéria pedindo atenção.',
    )
    const semestre = screen.getByRole('region', { name: 'Semestre' })
    expect(semestre).toHaveTextContent('1 de 3')
    expect(semestre).toHaveTextContent('Faltas · Cálculo Numérico12 de 15')
    expect(semestre).toHaveTextContent('Próxima prova5 dias')
    const hoje = screen.getByRole('region', { name: /^Hoje/ })
    const aula = within(hoje).getByRole('listitem')
    expect(aula).toHaveAttribute('aria-current', 'time')
    expect(aula).toHaveTextContent('19:00 – 22:15 · 4 aulas')
    expect(within(aula).getByRole('link', { name: 'Programação Orientada a Objetos' })).toHaveAttribute(
      'href',
      '#/materia/exemplo-poo',
    )
    expect(hoje).toHaveTextContent('Para hoje: Entrega do relatório final · Estruturas de Dados')
    expect(screen.getByRole('region', { name: 'Atrasado' })).toHaveTextContent('Lista de exercícios 5')
    const prazos = screen.getByRole('region', { name: 'Próximos prazos' })
    expect(within(prazos).getAllByRole('listitem')).toHaveLength(3)
    expect(prazos).toHaveTextContent('em 5 diasProva: Prova do RA2 · Programação Orientada a Objetos')
  })

  it('num dia sem aulas, a régua some', () => {
    // Sábado: o exemplo não tem aula.
    montarComExemplo('#/', new Date(2026, 9, 31, 10, 0))
    expect(screen.getByRole('region', { name: /^Hoje/ })).toHaveTextContent('Sem aulas hoje.')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sem aulas hoje')
  })

  it('as rotas de antes continuam abrindo as mesmas telas', () => {
    const telas: [string, string][] = [
      ['#/materias', 'Matérias'],
      ['#/semana', 'Semana'],
      ['#/agenda', 'Agenda'],
      ['#/dados', 'Dados'],
      ['#/nova-materia', 'Nova matéria'],
      ['#/materia/nao-existe', 'Matéria não encontrada'],
    ]
    montar('')
    for (const [hash, titulo] of telas) {
      irPara(hash)
      expect(screen.getByRole('heading', { level: 2, name: titulo }), hash).toBeInTheDocument()
    }
    irPara('#/')
    expect(screen.getByRole('link', { name: /Cadastrar a primeira matéria/ })).toBeInTheDocument()
  })
})
