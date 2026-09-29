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

// Terça: Algoritmos da 16ª à 19ª aula. Quinta: Algoritmos na 16ª (horário antigo, sem fim)
// e Banco de Dados na 18ª e na 19ª.
const MATERIAS = [
  { ...materia('alg', 'Algoritmos', [
    { dia: 2, inicio: '19:00', fim: '22:15', aulas: 4 },
    { dia: 4, inicio: '19:00' },
  ]), professor: 'Prof.ª Ana' },
  materia('bd', 'Banco de Dados', [{ dia: 4, inicio: '20:45', fim: '22:15', aulas: 2 }]),
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

/** A lista de um dia (a versão do celular). */
const dia = (nome: string | RegExp) => screen.getByRole('region', { name: nome })
const tabela = () => screen.getByRole('table')
/** O texto de cada célula de uma linha da tabela, a partir do cabeçalho da linha ("16ª aula"). */
function linha(aula: string) {
  const cabecalho = within(tabela()).getByRole('rowheader', { name: new RegExp(`^${aula}`) })
  return [...cabecalho.closest('tr')!.querySelectorAll('td')].map((td) => td.textContent)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  // Quinta-feira, 01/10/2026, meio-dia.
  vi.setSystemTime(new Date(2026, 9, 1, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TelaSemana', () => {
  it('tabela: uma coluna por dia (segunda a sexta) e uma linha por aula, da primeira à última ocupada', () => {
    montar()
    const colunas = within(tabela()).getAllByRole('columnheader').map((th) => th.textContent)
    expect(colunas).toEqual(['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira, hojeHoje', 'Sexta-feira'])
    const linhas = within(tabela()).getAllByRole('rowheader').map((th) => th.textContent)
    // A 17ª fica mesmo vazia na quinta: as linhas do meio não são puladas.
    expect(linhas).toEqual(['16ª aula19:00 às 19:45', '17ª aula19:45 às 20:30', '18ª aula20:45 às 21:30', '19ª aula21:30 às 22:15'])
  })

  it('tabela: o nome da matéria se repete em cada aula que ela ocupa, com o professor', () => {
    montar()
    // Colunas: seg, ter, qua, qui, sex.
    expect(linha('16ª aula')).toEqual(['', 'AlgoritmosProf.ª Ana', '', 'AlgoritmosProf.ª Ana', ''])
    expect(linha('17ª aula')).toEqual(['', 'AlgoritmosProf.ª Ana', '', '', ''])
    expect(linha('18ª aula')).toEqual(['', 'AlgoritmosProf.ª Ana', '', 'Banco de Dados', ''])
    expect(linha('19ª aula')).toEqual(['', 'AlgoritmosProf.ª Ana', '', 'Banco de Dados', ''])
    expect(within(tabela()).getAllByRole('link', { name: 'Algoritmos' })[0]).toHaveAttribute('href', '#/materia/alg')
  })

  it('celular: cada dia lista as aulas com o número, o horário e a matéria', () => {
    montar()
    const aulas = within(dia(/Quinta-feira/)).getAllByRole('listitem')
    expect(aulas.map((li) => li.textContent)).toEqual([
      '16ª aula19:00 às 19:45AlgoritmosProf.ª Ana',
      '18ª aula20:45 às 21:30Banco de Dados',
      '19ª aula21:30 às 22:15Banco de Dados',
    ])
    expect(within(aulas[1]).getByRole('link', { name: 'Banco de Dados' })).toHaveAttribute('href', '#/materia/bd')
  })

  it('celular: diz quando o dia não tem aula', () => {
    montar()
    expect(within(dia('Segunda-feira')).getByText('Sem aulas')).toBeInTheDocument()
    expect(within(dia('Segunda-feira')).queryByRole('list')).not.toBeInTheDocument()
  })

  it('marca o dia de hoje com texto, não só com a cor (na tabela e na lista)', () => {
    montar()
    const hoje = dia('Quinta-feira, hoje')
    expect(hoje).toHaveAttribute('aria-current', 'date')
    expect(hoje).toHaveClass('semana__dia--hoje')
    expect(within(hoje).getByText('Hoje')).toBeVisible()
    expect(dia('Terça-feira')).not.toHaveAttribute('aria-current')
    const coluna = within(tabela()).getByRole('columnheader', { name: 'Quinta-feira, hoje' })
    expect(coluna).toHaveAttribute('aria-current', 'date')
    expect(screen.getAllByText('Hoje')).toHaveLength(2)
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

  it('mostra o sábado e o domingo só quando há aula neles', () => {
    montar([materia('ead', 'Estágio', [{ dia: 0, inicio: '07:50', fim: '08:35' }])])
    expect(within(dia('Domingo')).getByRole('link', { name: 'Estágio' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Sábado' })).not.toBeInTheDocument()
    expect(within(tabela()).getAllByRole('columnheader').at(-1)).toHaveTextContent('Domingo')
  })

  it('junta as aulas vazias entre a manhã e a noite numa linha só', () => {
    montar([materia('c', 'Cálculo', [{ dia: 5, inicio: '10:25', fim: '11:10' }]), ...MATERIAS])
    expect(within(tabela()).getByRole('cell', { name: 'Sem aulas das 11:10 às 19:00' })).toHaveAttribute('colspan', '6')
    expect(within(tabela()).getAllByRole('rowheader')).toHaveLength(5)
  })

  it('horário que não bate com a tabela da PUC-PR vai para uma lista à parte, sem sumir', () => {
    montar([materia('lab', 'Laboratório', [{ dia: 1, inicio: '13:30', fim: '13:40' }])])
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const fora = screen.getByRole('region', { name: 'Fora da grade da PUC-PR' })
    expect(within(fora).getByRole('listitem')).toHaveTextContent('Segunda-feira, 13:30 às 13:40: Laboratório')
  })

  it('sem matérias, leva para o cadastro e mostra o exemplo', async () => {
    montar([], true)
    expect(screen.getByRole('link', { name: 'Cadastrar a primeira matéria' })).toHaveAttribute('href', '#/nova-materia')
    await userEvent.click(screen.getByRole('button', { name: 'Ver com dados de exemplo' }))
    // O exemplo tem horários (nas aulas da tabela da PUC-PR): a grade aparece, sem nada de fora.
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Fora da grade da PUC-PR' })).not.toBeInTheDocument()
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
