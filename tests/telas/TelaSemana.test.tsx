import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { dadosVazios } from '../../src/logica/armazenamento'
import type { Horario, Materia } from '../../src/logica/tipos'
import { TelaSemana } from '../../src/telas/TelaSemana'

function materia(id: string, nome: string, horarios: Horario[]): Materia {
  return { id, nome, professor: '', horarios, cargaHoraria: 80, ras: [], pontosExtras: [], faltas: [] }
}

const MATERIAS = [
  materia('alg', 'Algoritmos', [
    { dia: 2, inicio: '19:00', fim: '22:30', aulas: 4 },
    { dia: 4, inicio: '19:00' },
  ]),
  materia('bd', 'Banco de Dados', [{ dia: 4, inicio: '20:40', fim: '22:20', aulas: 2 }]),
]

function montar(materias: Materia[] = MATERIAS, podeSalvar = false) {
  const nav = new Map<string, string>()
  render(
    <ProvedorPainel
      inicial={{ dados: { ...dadosVazios(), materias }, aviso: null, podeSalvar }}
      armazenamento={{ getItem: (c) => nav.get(c) ?? null, setItem: (c, v) => void nav.set(c, v) }}
    >
      <TelaSemana />
    </ProvedorPainel>,
  )
}

const dia = (nome: string | RegExp) => screen.getByRole('region', { name: nome })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  // Quinta-feira, 01/10/2026, meio-dia.
  vi.setSystemTime(new Date(2026, 9, 1, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TelaSemana', () => {
  it('mostra um título para cada dia, de segunda a sábado', () => {
    montar()
    expect(screen.getByRole('heading', { level: 2, name: 'Semana' })).toBeInTheDocument()
    const titulos = screen.getAllByRole('heading', { level: 3 })
    const esperados = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira, hoje', 'Sexta-feira', 'Sábado']
    expect(titulos).toHaveLength(esperados.length)
    esperados.forEach((nome, i) => expect(titulos[i]).toHaveAccessibleName(nome))
    expect(screen.queryByRole('heading', { name: 'Domingo' })).not.toBeInTheDocument()
  })

  it('lista as aulas do dia com o link da matéria, o horário e as aulas', () => {
    montar()
    const terca = dia('Terça-feira')
    const aulas = within(terca).getAllByRole('listitem')
    expect(aulas).toHaveLength(1)
    expect(within(aulas[0]).getByRole('link', { name: 'Algoritmos' })).toHaveAttribute('href', '#/materia/alg')
    expect(aulas[0]).toHaveTextContent('19:00 às 22:30')
    expect(aulas[0]).toHaveTextContent('4 aulas')
  })

  it('na ordem do início, e horário antigo mostra só o início, sem número de aulas', () => {
    montar()
    const lista = within(dia(/Quinta-feira/)).getByRole('list')
    const [primeira, segunda] = within(lista).getAllByRole('listitem')
    expect(primeira).toHaveTextContent(/^19:00Algoritmos$/)
    expect(segunda).toHaveTextContent('20:40 às 22:20')
    expect(segunda).toHaveTextContent('Banco de Dados')
    expect(segunda).toHaveTextContent('2 aulas')
  })

  it('diz quando o dia não tem aula', () => {
    montar()
    expect(within(dia('Segunda-feira')).getByText('Sem aulas')).toBeInTheDocument()
    expect(within(dia('Segunda-feira')).queryByRole('list')).not.toBeInTheDocument()
  })

  it('marca o dia de hoje com texto, não só com a borda', () => {
    montar()
    const hoje = dia('Quinta-feira, hoje')
    expect(hoje).toHaveAttribute('aria-current', 'date')
    expect(hoje).toHaveClass('semana__dia--hoje')
    expect(within(hoje).getByText('Hoje')).toBeVisible()
    expect(dia('Terça-feira')).not.toHaveAttribute('aria-current')
    expect(screen.getAllByText('Hoje')).toHaveLength(1)
  })

  it('troca o dia de hoje quando a aba volta a ficar visível no dia seguinte', () => {
    montar()
    vi.setSystemTime(new Date(2026, 9, 2, 8))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(dia('Sexta-feira, hoje')).toHaveAttribute('aria-current', 'date')
    expect(dia('Quinta-feira')).not.toHaveAttribute('aria-current')
  })

  it('mostra o domingo quando há aula nele', () => {
    montar([materia('ead', 'Estágio', [{ dia: 0, inicio: '08:00' }])])
    expect(within(dia('Domingo')).getByRole('link', { name: 'Estágio' })).toBeInTheDocument()
  })

  it('sem matérias, leva para o cadastro e mostra o exemplo', async () => {
    montar([], true)
    expect(screen.getByRole('link', { name: 'Cadastrar a primeira matéria' })).toHaveAttribute('href', '#/nova-materia')
    await userEvent.click(screen.getByRole('button', { name: 'Ver com dados de exemplo' }))
    // O exemplo tem horários: a grade aparece, com o foco no título da tela.
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThanOrEqual(6)
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0)
  })

  it('sem salvar, não oferece o exemplo', () => {
    montar([], false)
    expect(screen.getByRole('button', { name: 'Ver com dados de exemplo' })).toBeDisabled()
  })

  it('com matérias sem horário, diz para adicionar ao editar', () => {
    montar([materia('alg', 'Algoritmos', [])])
    expect(screen.getByText(/adicione os dias e horários das aulas ao editar/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editar Algoritmos' })).toHaveAttribute('href', '#/materia/alg/editar')
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
  })
})
