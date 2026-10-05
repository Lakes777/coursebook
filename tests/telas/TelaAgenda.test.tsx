import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { dadosVazios } from '../../src/logica/armazenamento'
import type { Evento, Materia } from '../../src/logica/tipos'
import { TelaAgenda } from '../../src/telas/TelaAgenda'

/** localStorage falso: os testes não mexem no do jsdom. */
function navegador() {
  const itens = new Map<string, string>()
  return {
    itens,
    getItem: (chave: string) => itens.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void itens.set(chave, valor),
  }
}

const ALGORITMOS: Materia = {
  id: 'alg',
  nome: 'Algoritmos',
  professor: '',
  horarios: [],
  cargaHoraria: 80,
  ras: [],
  pontosExtras: [],
  faltas: [],
}

// "Hoje" nos testes é 01/10/2026.
const EVENTOS: Evento[] = [
  { id: 'futuro', titulo: 'Seminário final', tipo: 'apresentacao', data: '2026-11-20', concluido: false },
  { id: 'hoje', titulo: 'Lista de exercícios', tipo: 'trabalho', data: '2026-10-01', concluido: false },
  { id: 'atrasado', titulo: 'Relatório', tipo: 'trabalho', data: '2026-09-28', concluido: false },
  { id: 'proximo', titulo: 'Prova do RA2', tipo: 'prova', data: '2026-10-04', concluido: false, materiaId: 'alg' },
  { id: 'amanha', titulo: 'Quiz', tipo: 'prova', data: '2026-10-02', concluido: false },
  { id: 'feito', titulo: 'Prova do RA1', tipo: 'prova', data: '2026-09-10', concluido: true },
]

function montar(eventos: Evento[] = EVENTOS, materias: Materia[] = [ALGORITMOS]) {
  const nav = navegador()
  render(
    <ProvedorPainel
      inicial={{ dados: { ...dadosVazios(), eventos, materias }, aviso: null, podeSalvar: true }}
      armazenamento={nav}
    >
      <TelaAgenda />
    </ProvedorPainel>,
  )
  return nav
}

const lista = (nome: string) => screen.getByRole('list', { name: nome })
const item = (titulo: string) => screen.getByText(titulo).closest('li')!

/** Títulos dos itens de uma lista, na ordem da tela. */
function titulos(nome: string) {
  return within(lista(nome))
    .getAllByRole('listitem')
    .map((li) => li.querySelector('.item-agenda__titulo')?.textContent)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 1, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TelaAgenda', () => {
  it('mostra o título da tela', () => {
    montar()
    expect(screen.getByRole('heading', { level: 2, name: 'Agenda' })).toBeInTheDocument()
  })

  it('separa o que falta fazer dos concluídos, em ordem de prazo', () => {
    montar()
    expect(screen.getByRole('heading', { level: 3, name: 'A fazer' })).toBeInTheDocument()
    expect(titulos('A fazer')).toEqual(['Relatório', 'Lista de exercícios', 'Quiz', 'Prova do RA2', 'Seminário final'])
    expect(titulos('Concluídos')).toEqual(['Prova do RA1'])
  })

  it('só mostra "Concluídos" quando há algum', () => {
    montar(EVENTOS.filter((e) => !e.concluido))
    expect(screen.queryByRole('heading', { name: 'Concluídos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Concluídos' })).not.toBeInTheDocument()
  })

  it('mostra um selo com texto para cada situação', () => {
    montar()
    expect(within(item('Relatório')).getByText('Atrasado')).toHaveClass('selo--perigo')
    expect(within(item('Lista de exercícios')).getByText('Hoje')).toHaveClass('selo--atencao')
    expect(within(item('Quiz')).getByText('Amanhã')).toHaveClass('selo--destaque')
    expect(within(item('Prova do RA2')).getByText('Em 3 dias')).toHaveClass('selo--destaque')
    expect(within(item('Prova do RA1')).getByText('Concluído')).toHaveClass('selo--ok')
    // O que está longe não ganha selo: a data já diz.
    expect(item('Seminário final').querySelector('.selo')).toBeNull()
  })

  it('mostra tipo, data, prazo e o nome da matéria', () => {
    montar()
    const prova = item('Prova do RA2')
    // Só o trecho do tipo: o título "Prova do RA2" já tem a palavra "Prova".
    expect(prova.querySelector('.item-agenda__tipo')).toHaveTextContent('Prova')
    expect(item('Relatório').querySelector('.item-agenda__tipo')).toHaveTextContent('Trabalho')
    expect(within(prova).getByText('Algoritmos')).toBeInTheDocument()
    // O prazo vem depois da data só quando o selo não diz o mesmo (atrasado, concluído, longe).
    const data = (titulo: string) => item(titulo).querySelector('.item-agenda__data')
    expect(data('Relatório')).toHaveTextContent(/^28\/09\/2026 · há 3 dias$/)
    expect(data('Prova do RA1')).toHaveTextContent(/^10\/09\/2026 · há 21 dias$/)
    expect(data('Seminário final')).toHaveTextContent(/^20\/11\/2026 · em 50 dias$/)
    expect(item('Seminário final')).toHaveTextContent('Apresentação')
    // O ícone é enfeite: o nome do tipo está escrito ao lado.
    expect(prova.querySelector('.item-agenda__tipo svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('não repete no mesmo item o prazo que o selo já diz', () => {
    montar()
    const data = (titulo: string) => item(titulo).querySelector('.item-agenda__data')
    expect(data('Lista de exercícios')).toHaveTextContent(/^01\/10\/2026$/)
    expect(data('Quiz')).toHaveTextContent(/^02\/10\/2026$/)
    expect(data('Prova do RA2')).toHaveTextContent(/^04\/10\/2026$/)
    expect(within(item('Prova do RA2')).getAllByText(/em 3 dias/i)).toHaveLength(1)
    expect(within(item('Quiz')).getAllByText(/amanhã/i)).toHaveLength(1)
    expect(within(item('Lista de exercícios')).getAllByText(/hoje/i)).toHaveLength(1)
  })

  it('marcar como feito leva o item para os concluídos e salva', async () => {
    const nav = montar()
    const caixa = screen.getByRole('checkbox', { name: 'Marcar Prova do RA2 como feito' })
    expect(caixa).not.toBeChecked()
    await userEvent.click(caixa)
    expect(titulos('A fazer')).not.toContain('Prova do RA2')
    expect(titulos('Concluídos')).toEqual(['Prova do RA2', 'Prova do RA1'])
    const marcada = screen.getByRole('checkbox', { name: 'Marcar Prova do RA2 como feito' })
    expect(marcada).toBeChecked()
    // O foco segue o item na lista nova.
    expect(marcada).toHaveFocus()
    const salvo = JSON.parse([...nav.itens.values()][0])
    expect(salvo.eventos.find((e: Evento) => e.id === 'proximo').concluido).toBe(true)
  })

  it('desmarcar devolve o item para "A fazer"', async () => {
    montar()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar Prova do RA1 como feito' }))
    expect(titulos('A fazer')[0]).toBe('Prova do RA1')
    expect(screen.queryByRole('list', { name: 'Concluídos' })).not.toBeInTheDocument()
  })

  it('remove em dois passos, e dá para desistir', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Remover Quiz' }))
    // Primeiro passo: nada saiu ainda, e o foco vai para o "Cancelar".
    expect(screen.getByText('Quiz')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover Quiz' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar remoção de Quiz' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar remoção de Quiz' }))
    expect(screen.getByRole('button', { name: 'Remover Quiz' })).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Remover Quiz' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar remoção de Quiz' }))
    expect(screen.queryByText('Quiz')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'A fazer' })).toHaveFocus()
  })

  it('remover um concluído deixa o foco em "Concluídos", se ainda houver algum', async () => {
    const outroFeito: Evento = { id: 'feito2', titulo: 'Resumo', tipo: 'trabalho', data: '2026-09-05', concluido: true }
    montar([...EVENTOS, outroFeito])
    await userEvent.click(screen.getByRole('button', { name: 'Remover Prova do RA1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar remoção de Prova do RA1' }))
    expect(screen.getByRole('heading', { level: 3, name: 'Concluídos' })).toHaveFocus()
    // Sem mais concluídos, a parte some e o foco vai para "A fazer".
    await userEvent.click(screen.getByRole('button', { name: 'Remover Resumo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar remoção de Resumo' }))
    expect(screen.queryByRole('heading', { name: 'Concluídos' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'A fazer' })).toHaveFocus()
  })

  it('remover o último evento leva o foco para o título da tela', async () => {
    montar([EVENTOS[0]])
    await userEvent.click(screen.getByRole('button', { name: 'Remover Seminário final' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar remoção de Seminário final' }))
    expect(screen.getByText(/Nada na agenda ainda/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Agenda' })).toHaveFocus()
  })

  it('com tudo feito, "A fazer" diz isso', () => {
    montar([EVENTOS[5]])
    expect(screen.getByText('Tudo feito por enquanto.')).toBeInTheDocument()
    expect(titulos('Concluídos')).toEqual(['Prova do RA1'])
  })

  it('relê o dia quando a aba volta a ficar visível', () => {
    montar()
    expect(within(item('Quiz')).getByText('Amanhã')).toBeInTheDocument()
    // A aba ficou esquecida aberta até o dia seguinte.
    vi.setSystemTime(new Date(2026, 9, 2, 8))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(within(item('Quiz')).getByText('Hoje')).toBeInTheDocument()
  })

  it('não adiciona sem título e mostra o erro ligado ao campo', async () => {
    const nav = montar()
    const titulo = screen.getByLabelText('Título')
    await userEvent.type(titulo, '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(titulo).toHaveAttribute('aria-invalid', 'true')
    expect(titulo).toHaveAccessibleDescription('Dê um título (ex.: "Prova do RA1").')
    expect(titulo).toHaveFocus()
    expect(nav.itens.size).toBe(0)
    // Ao corrigir o campo, a mensagem sai.
    await userEvent.type(titulo, 'A')
    expect(titulo).not.toHaveAttribute('aria-invalid')
  })

  it('não adiciona sem data', async () => {
    const nav = montar()
    await userEvent.type(screen.getByLabelText('Título'), 'Prova do RA3')
    const data = screen.getByLabelText('Data')
    fireEvent.change(data, { target: { value: '' } })
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(data).toHaveAttribute('aria-invalid', 'true')
    expect(data).toHaveAccessibleDescription('Informe uma data válida.')
    expect(screen.getByLabelText('Título')).not.toHaveAttribute('aria-invalid')
    expect(nav.itens.size).toBe(0)
  })

  it('adiciona o evento, limpa o título e volta o foco para ele', async () => {
    const nav = montar()
    const titulo = screen.getByLabelText('Título')
    // A data começa em hoje.
    expect(screen.getByLabelText('Data')).toHaveValue('2026-10-01')
    await userEvent.type(titulo, '  Apresentação do projeto  ')
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'Apresentação')
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-10-06' } })
    await userEvent.selectOptions(screen.getByLabelText('Matéria'), 'Algoritmos')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    const novo = item('Apresentação do projeto')
    expect(novo.querySelector('.item-agenda__data')).toHaveTextContent(/^06\/10\/2026$/)
    expect(within(novo).getByText('Algoritmos')).toBeInTheDocument()
    // O prazo aparece uma vez só, no selo.
    expect(within(novo).getAllByText(/em 5 dias/i)).toHaveLength(1)
    expect(within(novo).getByText('Em 5 dias')).toHaveClass('selo')
    expect(titulo).toHaveValue('')
    expect(titulo).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Adicionado à agenda: Apresentação do projeto.')
    // Ao digitar o próximo, o aviso antigo sai (e um título igual volta a ser anunciado).
    await userEvent.type(titulo, 'P')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    const salvo = JSON.parse([...nav.itens.values()][0]).eventos.at(-1)
    expect(salvo).toMatchObject({
      titulo: 'Apresentação do projeto',
      tipo: 'apresentacao',
      data: '2026-10-06',
      concluido: false,
      materiaId: 'alg',
    })
    expect(salvo.id).toEqual(expect.any(String))
  })

  it('sem matéria escolhida, o evento fica sem materiaId', async () => {
    const nav = montar([])
    await userEvent.type(screen.getByLabelText('Título'), 'Trabalho em grupo')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    const salvo = JSON.parse([...nav.itens.values()][0]).eventos[0]
    expect(salvo).not.toHaveProperty('materiaId')
    expect(within(lista('A fazer')).getByText('Trabalho em grupo')).toBeInTheDocument()
  })

  it('explica o que dá para cadastrar quando a agenda está vazia', () => {
    montar([], [])
    expect(screen.getByText(/Nada na agenda ainda/)).toHaveTextContent('provas, trabalhos e apresentações')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Sem matéria' })).toBeInTheDocument()
  })
})
