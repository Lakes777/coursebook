import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { CHAVE, dadosVazios } from '../../src/logica/armazenamento'
import type { Dados, Evento, Materia } from '../../src/logica/tipos'
import { TelaMateria } from '../../src/telas/TelaMateria'

/** localStorage falso: os testes não mexem no do jsdom. */
function navegador() {
  const itens = new Map<string, string>()
  return {
    itens,
    getItem: (chave: string) => itens.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void itens.set(chave, valor),
  }
}

// Parecida com a POO do plano: provas que valem 3,0 e um projeto que vale 4,0.
const POO: Materia = {
  id: 'poo',
  nome: 'POO',
  professor: 'Prof. Exemplo',
  horarios: [{ dia: 2, inicio: '19:00', fim: '22:30', aulas: 4 }],
  cargaHoraria: 120,
  ras: [
    {
      id: 'r1',
      nome: 'RA1',
      peso: 3,
      recuperacaoNoSemestre: false,
      notaRecuperacao: null,
      avaliacoes: [{ id: 'a1', nome: 'Prova 1', peso: 1, valorMaximo: 3, nota: 2.1 }],
    },
    {
      id: 'r2',
      nome: 'RA2',
      peso: 3,
      recuperacaoNoSemestre: true,
      notaRecuperacao: null,
      avaliacoes: [{ id: 'a2', nome: 'Prova 2', peso: 1, valorMaximo: 3, nota: null }],
    },
    {
      id: 'r3',
      nome: 'RA3',
      peso: 4,
      recuperacaoNoSemestre: false,
      notaRecuperacao: null,
      avaliacoes: [{ id: 'a3', nome: 'Projeto', peso: 1, valorMaximo: 4, nota: null }],
    },
  ],
  pontosExtras: [],
  faltas: [{ id: 'f1', data: '2026-09-02', quantidade: 2 }],
}

const PROVA: Evento = { id: 'e1', materiaId: 'poo', titulo: 'Prova 2', tipo: 'prova', data: '2026-10-28', concluido: false }

function montar(materia: Materia = POO, eventos: Evento[] = [PROVA]) {
  const nav = navegador()
  render(
    <ProvedorPainel
      inicial={{ dados: { ...dadosVazios(), materias: [materia], eventos }, aviso: null, podeSalvar: true }}
      armazenamento={nav}
    >
      <TelaMateria id={materia.id} />
    </ProvedorPainel>,
  )
  return nav
}

/** O que ficou gravado no localStorage falso. */
function salvos(nav: ReturnType<typeof navegador>): Dados {
  return JSON.parse(nav.itens.get(CHAVE)!)
}

const cartaoRA = (nome: string) => screen.getByRole('region', { name: nome })

beforeEach(() => {
  // "Hoje" nos testes é 01/10/2026. Só o Date é falso: os timers do userEvent continuam reais.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 1, 10))
  window.location.hash = '#/materia/poo'
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TelaMateria', () => {
  it('avisa quando a matéria não existe', () => {
    render(
      <ProvedorPainel inicial={{ dados: dadosVazios(), aviso: null, podeSalvar: true }} armazenamento={navegador()}>
        <TelaMateria id="nada" />
      </ProvedorPainel>,
    )
    expect(screen.getByRole('heading', { name: 'Matéria não encontrada' })).toBeInTheDocument()
  })

  it('mostra o resumo, o peso de cada RA e quanto tirar na escala de cada avaliação', () => {
    montar()
    expect(screen.getByRole('heading', { level: 2, name: 'POO' })).toBeInTheDocument()
    expect(screen.getByText('Prof. Exemplo · 120 aulas no semestre · Ter 19:00 às 22:30 (4 aulas)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editar matéria' })).toHaveAttribute('href', '#/materia/poo/editar')
    // RA1 tem 7,0; faltam 70% da nota final: precisa de 7,0 no resto.
    expect(screen.getAllByText('Precisa de 7,0 (de 10) no que falta')[0]).toBeInTheDocument()
    expect(within(cartaoRA('RA3')).getByText('40% da nota final')).toBeInTheDocument()
    expect(within(cartaoRA('RA1')).getByText('7,0')).toBeInTheDocument()
    expect(within(cartaoRA('RA2')).getByText('Precisa de 2,1 de 3,0')).toBeInTheDocument()
    expect(within(cartaoRA('RA3')).getByText('Precisa de 2,8 de 4,0')).toBeInTheDocument()
  })

  it('salva a nota ao apertar Enter e recalcula a situação', async () => {
    const user = userEvent.setup()
    const nav = montar()
    const campo = screen.getByRole('textbox', { name: 'Nota de Prova 2' })
    await user.type(campo, '3{Enter}')

    expect(salvos(nav).materias[0].ras[1].avaliacoes[0].nota).toBe(3)
    expect(campo).toHaveValue('3,0')
    expect(campo).toHaveFocus()
    expect(screen.getByText('Nota de Prova 2 salva: 3,0.')).toBeInTheDocument()
    // RA1 7,0 e RA2 10: 0,3·7 + 0,3·10 = 5,1; faltam 40%: (7 − 5,1) / 0,4 = 4,75 -> 4,8 -> 1,92 de 4,0.
    expect(within(cartaoRA('RA3')).getByText('Precisa de 1,92 de 4,0')).toBeInTheDocument()
  })

  it('não pede nota em RA de peso 0, que não entra na nota final', () => {
    montar({ ...POO, ras: POO.ras.map((ra) => (ra.id === 'r2' ? { ...ra, peso: 0 } : ra)) })
    const ra2 = cartaoRA('RA2')
    expect(within(ra2).getByText('Não conta na nota final')).toBeInTheDocument()
    expect(within(ra2).queryByText(/Precisa de/)).not.toBeInTheDocument()
  })

  it('avisa o erro da nota mesmo saindo do campo com Tab', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(screen.getByRole('textbox', { name: 'Nota de Prova 2' }), '12')
    await user.tab()
    expect(screen.getByRole('alert')).toHaveTextContent('Digite uma nota de 0 a 3,0')
  })

  it('salva ao sair do campo, e apagar a nota volta para "sem nota"', async () => {
    const user = userEvent.setup()
    const nav = montar()
    const campo = screen.getByRole('textbox', { name: 'Nota de Prova 1' })
    await user.clear(campo)
    await user.tab()
    expect(salvos(nav).materias[0].ras[0].avaliacoes[0].nota).toBeNull()
    expect(within(cartaoRA('RA1')).getByText('sem notas ainda')).toBeInTheDocument()
  })

  it('não salva nota acima do valor da avaliação e liga o erro ao campo', async () => {
    const user = userEvent.setup()
    const nav = montar()
    const campo = screen.getByRole('textbox', { name: 'Nota de Prova 2' })
    await user.type(campo, '3,5{Enter}')

    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveAccessibleDescription(expect.stringContaining('Digite uma nota de 0 a 3,0'))
    expect(nav.itens.has(CHAVE)).toBe(false)

    // Esc desfaz o que foi digitado e tira o erro.
    await user.keyboard('{Escape}')
    expect(campo).toHaveValue('')
    expect(campo).not.toHaveAttribute('aria-invalid')
  })

  it('mostra a recuperação do RA que o plano prevê e salva a nota dela', async () => {
    const user = userEvent.setup()
    const nav = montar()
    expect(within(cartaoRA('RA1')).queryByRole('textbox', { name: /Recuperação/ })).not.toBeInTheDocument()
    const campo = within(cartaoRA('RA2')).getByRole('textbox', { name: 'Recuperação de RA2' })
    await user.type(campo, '6,5{Enter}')
    expect(salvos(nav).materias[0].ras[1].notaRecuperacao).toBe(6.5)
  })

  it('"Faltei hoje" lança as aulas do dia pelos horários e mostra a frequência', async () => {
    const user = userEvent.setup()
    // 01/10/2026 é quinta: a matéria tem 4 aulas às quintas.
    const nav = montar({ ...POO, horarios: [...POO.horarios, { dia: 4, inicio: '19:00', fim: '22:30', aulas: 4 }] })
    const faltas = screen.getByRole('region', { name: 'Faltas' })
    expect(within(faltas).getByText(/Pode faltar mais 28 aulas/)).toBeInTheDocument()

    await user.click(within(faltas).getByRole('button', { name: 'Faltei hoje (4 aulas)' }))

    const lancadas = salvos(nav).materias[0].faltas
    expect(lancadas).toHaveLength(2)
    expect(lancadas[1]).toMatchObject({ data: '2026-10-01', quantidade: 4 })
    expect(within(faltas).getByText(/Pode faltar mais 24 aulas/)).toBeInTheDocument()
    // A mais recente vem primeiro.
    const itens = within(within(faltas).getByRole('list', { name: 'Faltas lançadas' })).getAllByRole('listitem')
    expect(itens[0]).toHaveTextContent('01/10/2026')
  })

  it('em dia sem aula da matéria, "Faltei hoje" lança 1 aula e explica', async () => {
    const user = userEvent.setup()
    // A POO só tem aula às terças; hoje é quinta.
    const nav = montar()
    const faltas = screen.getByRole('region', { name: 'Faltas' })
    expect(within(faltas).getByText(/Hoje não tem aula desta matéria/)).toBeInTheDocument()
    await user.click(within(faltas).getByRole('button', { name: 'Faltei hoje (1 aula)' }))
    expect(salvos(nav).materias[0].faltas[1]).toMatchObject({ data: '2026-10-01', quantidade: 1 })
  })

  it('recusa quantidade de aulas inválida no formulário de falta', async () => {
    const user = userEvent.setup()
    montar()
    const quantidade = screen.getByRole('textbox', { name: 'Aulas' })
    await user.clear(quantidade)
    await user.type(quantidade, '13')
    await user.click(screen.getByRole('button', { name: 'Lançar' }))
    expect(quantidade).toHaveAttribute('aria-invalid', 'true')
    expect(quantidade).toHaveFocus()
  })

  it('remove uma falta em 2 passos e põe o foco no título da seção', async () => {
    const user = userEvent.setup()
    const nav = montar()
    await user.click(screen.getByRole('button', { name: 'Remover a falta de 02/09/2026, 2 aulas' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar remoção de a falta de 02/09/2026, 2 aulas' }))
    expect(salvos(nav).materias[0].faltas).toEqual([])
    expect(screen.getByRole('heading', { name: 'Faltas' })).toHaveFocus()
  })

  it('adiciona pontos extras com comentário e eles entram na conta', async () => {
    const user = userEvent.setup()
    const nav = montar()
    const extras = screen.getByRole('region', { name: 'Pontos extras' })

    // Sem comentário não vai.
    await user.type(within(extras).getByRole('textbox', { name: 'Pontos' }), '0,7')
    await user.click(within(extras).getByRole('button', { name: 'Adicionar' }))
    const comentario = within(extras).getByRole('textbox', { name: 'De onde vieram' })
    expect(comentario).toHaveAttribute('aria-invalid', 'true')
    expect(comentario).toHaveFocus()

    await user.type(comentario, '  Lista 3  ')
    await user.click(within(extras).getByRole('button', { name: 'Adicionar' }))
    expect(salvos(nav).materias[0].pontosExtras).toMatchObject([{ pontos: 0.7, comentario: 'Lista 3' }])
    expect(within(extras).getByText('Total de 0,7, somado na nota final (até 10).')).toBeInTheDocument()
    // Com 0,7 a mais, precisa de (7 − 0,7 − 2,1) / 0,7 = 6,0 no que falta.
    expect(screen.getAllByText('Precisa de 6,0 (de 10) no que falta')[0]).toBeInTheDocument()
  })

  it('volta para a regra padrão quando a matéria tem regra própria', async () => {
    const user = userEvent.setup()
    const nav = montar({ ...POO, regra: { mediaMinima: 6, frequenciaMinima: 0.75, arredondarUmaCasa: false } })
    expect(screen.getByText('Regra própria desta matéria.')).toBeInTheDocument()
    expect(screen.getByText('Sem recuperação')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Usar a regra padrão' }))
    expect(salvos(nav).materias[0].regra).toBeUndefined()
    expect(screen.getByRole('heading', { name: 'Regra de aprovação' })).toHaveFocus()
  })

  it('remove a matéria com os eventos dela e volta para a lista', async () => {
    const user = userEvent.setup()
    const nav = montar()
    expect(screen.getByText(/e 1 evento dela na agenda/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remover matéria POO' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar remoção de POO' }))
    expect(salvos(nav)).toMatchObject({ materias: [], eventos: [] })
    expect(window.location.hash).toBe('#/materias')
  })
})
