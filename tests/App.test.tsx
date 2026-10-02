import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../src/App'
import { ProvedorPainel } from '../src/estado/ProvedorPainel'
import { dadosVazios } from '../src/logica/armazenamento'

/** Monta o App no endereço dado; o padrão é a lista de matérias (a raiz é o lobby). */
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
    // O ícone do capelo não entra no nome do título.
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

  it('o nome no topo leva de volta ao lobby', async () => {
    montar()
    const nome = screen.getByRole('link', { name: 'Coursebook' })
    expect(nome).toHaveAttribute('href', '#/')
    await userEvent.click(nome)
    expect(screen.getByRole('heading', { level: 1, name: 'Coursebook' })).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
  })

  it('a aba "Início" leva ao lobby', async () => {
    montar('#/agenda')
    const inicio = screen.getByRole('link', { name: 'Início' })
    expect(inicio).toHaveAttribute('href', '#/')
    await userEvent.click(inicio)
    expect(screen.getByRole('link', { name: 'Começar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Coursebook' })).toHaveFocus()
  })

  it('endereço desconhecido continua indo para a lista de matérias', () => {
    montar('#/nada')
    expect(screen.getByRole('heading', { level: 2, name: 'Matérias' })).toBeInTheDocument()
  })

  it('roda no fuso de Brasília', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(180)
  })
})

describe('lobby', () => {
  it.each(['', '#', '#/'])('aparece no endereço raiz (%j), com o topo e a aba "Início" marcada', (hash) => {
    montar(hash)
    // Um h1 só: o título grande do lobby (o nome no topo vira texto comum aqui).
    const titulos = screen.getAllByRole('heading', { level: 1 })
    expect(titulos).toHaveLength(1)
    expect(titulos[0]).toHaveClass('lobby__titulo')
    expect(screen.getByRole('banner')).toHaveTextContent('Coursebook')
    const nav = screen.getByRole('navigation', { name: 'Seções' })
    expect(within(nav).getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Matérias' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('heading', { level: 2, name: 'Matérias' })).not.toBeInTheDocument()
    expect(document.title).toBe('Coursebook')
  })

  it('mostra os destaques e o link para o código', () => {
    montar('')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    const codigo = screen.getByRole('link', { name: 'Ver o código no GitHub' })
    expect(codigo).toHaveAttribute('href', 'https://github.com/Lakes777/painel-estudos')
    expect(codigo).toHaveAttribute('target', '_blank')
  })

  it('mostra os avisos do armazenamento acima do título, e eles continuam depois de "Começar"', async () => {
    // montar() usa podeSalvar: false, como um navegador que não deixa gravar.
    montar('')
    const aviso = screen.getByText(/Nada está sendo salvo neste navegador/)
    const titulo = screen.getByRole('heading', { level: 1, name: 'Coursebook' })
    expect(aviso.closest('.lobby__avisos')).not.toBeNull()
    expect(aviso.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await userEvent.click(screen.getByRole('link', { name: 'Começar' }))
    expect(screen.getByText(/Nada está sendo salvo neste navegador/)).toBeInTheDocument()
  })

  it('em tela muito larga, cada metade do trilho repete as pranchas até passar da largura', () => {
    // O jsdom não mede nada: cada prancha "ocupa" 400 px (360 + o espaço entre elas).
    const larguraAntes = window.innerWidth
    const medida = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth')
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('lobby__trilho') ? this.children.length * 400 : 0
      },
    })
    try {
      window.innerWidth = 5000 // um conjunto (6 x 400 = 2400 px) não cobre: precisa de 3
      montar('')
      const trilhos = document.querySelectorAll('.lobby__trilho')
      for (const trilho of trilhos) expect(trilho.children).toHaveLength(6 * 3 * 2)
      // A velocidade não muda: o caminho ficou 3 vezes maior, e o tempo também.
      expect((trilhos[0] as HTMLElement).style.animationDuration).toBe(`${64 * 3}s`)
    } finally {
      window.innerWidth = larguraAntes
      if (medida) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', medida)
    }
  })

  it('as pranchas do fundo são só decoração', () => {
    montar('')
    const pranchas = document.querySelectorAll('.lobby__prancha')
    // 3 faixas, cada uma com as 6 pranchas duas vezes (para emendar o loop).
    expect(pranchas).toHaveLength(36)
    for (const img of pranchas) {
      expect(img).toHaveAttribute('alt', '')
      expect(img).toHaveAttribute('aria-hidden', 'true')
    }
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })

  it('"Começar" leva para a lista de matérias, com o foco no título dela', async () => {
    montar('')
    await userEvent.click(screen.getByRole('link', { name: 'Começar' }))
    expect(window.location.hash).toBe('#/materias')
    expect(screen.getByRole('heading', { level: 2, name: 'Matérias' })).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Matérias' })).toHaveAttribute('aria-current', 'page')
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
    expect(screen.getByRole('link', { name: 'Começar' })).toBeInTheDocument()
  })
})
