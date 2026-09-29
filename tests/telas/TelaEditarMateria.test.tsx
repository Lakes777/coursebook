import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { CHAVE, dadosVazios } from '../../src/logica/armazenamento'
import type { Dados, Materia } from '../../src/logica/tipos'
import { TelaEditarMateria } from '../../src/telas/TelaEditarMateria'

/** localStorage falso: os testes não mexem no do jsdom. */
function navegador() {
  const itens = new Map<string, string>()
  return {
    itens,
    getItem: (chave: string) => itens.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void itens.set(chave, valor),
  }
}

const POO: Materia = {
  id: 'poo',
  nome: 'POO',
  professor: 'Ana',
  horarios: [],
  cargaHoraria: 120,
  ras: [
    {
      id: 'r1',
      nome: 'RA1',
      peso: 3,
      recuperacaoNoSemestre: false,
      notaRecuperacao: null,
      avaliacoes: [
        { id: 'a1', nome: 'Prova 1', peso: 1, valorMaximo: 10, nota: 8 },
        { id: 'a2', nome: 'Lista', peso: 1, valorMaximo: 10, nota: 9 },
      ],
    },
  ],
  pontosExtras: [{ id: 'x', pontos: 0.5, comentario: 'Monitoria' }],
  faltas: [{ id: 'f', data: '2026-09-02', quantidade: 2 }],
}

function montar() {
  const nav = navegador()
  render(
    <ProvedorPainel
      inicial={{ dados: { ...dadosVazios(), materias: [POO] }, aviso: null, podeSalvar: true }}
      armazenamento={nav}
    >
      <TelaEditarMateria id="poo" />
    </ProvedorPainel>,
  )
  return nav
}

const salva = (nav: ReturnType<typeof navegador>): Materia => (JSON.parse(nav.itens.get(CHAVE)!) as Dados).materias[0]
const continuar = () => userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
const grupo = (nome: string) => screen.getByRole('group', { name: nome })

beforeEach(() => {
  window.location.hash = '#/materia/poo/editar'
})

describe('TelaEditarMateria', () => {
  it('avisa quando a matéria não existe', () => {
    render(
      <ProvedorPainel inicial={{ dados: dadosVazios(), aviso: null, podeSalvar: true }} armazenamento={navegador()}>
        <TelaEditarMateria id="nada" />
      </ProvedorPainel>,
    )
    expect(screen.getByRole('heading', { name: 'Matéria não encontrada' })).toBeInTheDocument()
  })

  it('começa com a matéria e o Cancelar volta para ela', () => {
    montar()
    expect(screen.getByRole('heading', { level: 2, name: 'Editar POO' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nome da matéria')).toHaveValue('POO')
    expect(screen.getByLabelText('Carga horária (aulas de 45 min)')).toHaveValue('120')
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '#/materia/poo')
  })

  it('salva a mudança mantendo notas, faltas e pontos extras, e volta para a matéria', async () => {
    const user = userEvent.setup()
    const nav = montar()
    const nome = screen.getByLabelText('Nome da matéria')
    await user.clear(nome)
    await user.type(nome, 'Programação OO')
    for (let i = 0; i < 4; i++) await continuar()
    await user.click(screen.getByRole('button', { name: 'Salvar matéria' }))

    const materia = salva(nav)
    expect(materia.nome).toBe('Programação OO')
    expect(materia.ras[0].avaliacoes.map((a) => a.nota)).toEqual([8, 9])
    expect(materia.faltas).toEqual(POO.faltas)
    expect(materia.pontosExtras).toEqual(POO.pontosExtras)
    expect(window.location.hash).toBe('#/materia/poo')
  })

  it('não deixa a avaliação valer menos que a nota dela', async () => {
    const user = userEvent.setup()
    const nav = montar()
    await continuar()
    await continuar()
    const valor = within(grupo('Avaliação 1 do RA1')).getByLabelText('Vale até')
    await user.clear(valor)
    await user.type(valor, '3')
    await continuar()
    expect(valor).toHaveAttribute('aria-invalid', 'true')
    expect(valor).toHaveFocus()
    expect(valor).toHaveAccessibleDescription(expect.stringContaining('já tem nota 8,0'))
    expect(nav.itens.has(CHAVE)).toBe(false)
  })

  it('avisa na revisão as notas que serão apagadas', async () => {
    const user = userEvent.setup()
    const nav = montar()
    await continuar()
    await continuar()
    await user.click(screen.getByRole('button', { name: 'Remover avaliação 2 do RA1' }))
    await continuar()
    await continuar()
    expect(screen.getByText('Ao salvar, estas notas serão apagadas:')).toBeInTheDocument()
    expect(screen.getByText('Nota 9,0 de Lista (RA1)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar matéria' }))
    expect(salva(nav).ras[0].avaliacoes).toMatchObject([{ id: 'a1', nota: 8 }])
  })

  describe('outra aba mexe na matéria com o formulário aberto', () => {
    function outraAbaSalvou(nav: ReturnType<typeof navegador>, dados: Dados) {
      nav.itens.set(CHAVE, JSON.stringify(dados))
      act(() => void window.dispatchEvent(new StorageEvent('storage', { key: CHAVE })))
    }

    it('removida: o formulário continua, avisa, e salvar coloca a matéria de volta', async () => {
      const nav = montar()
      await userEvent.clear(screen.getByLabelText('Nome da matéria'))
      await userEvent.type(screen.getByLabelText('Nome da matéria'), 'POO 2')
      outraAbaSalvou(nav, dadosVazios())

      expect(screen.getByRole('alert')).toHaveTextContent('removida em outra aba')
      expect(screen.getByLabelText('Nome da matéria')).toHaveValue('POO 2')
      for (let i = 0; i < 4; i++) await continuar()
      await userEvent.click(screen.getByRole('button', { name: 'Salvar matéria' }))
      expect(salva(nav).nome).toBe('POO 2')
      expect(salva(nav).faltas).toEqual(POO.faltas)
    })

    it('alterada: avisa, e salvar mantém as notas de agora', async () => {
      const nav = montar()
      const comNota: Materia = {
        ...POO,
        ras: [{ ...POO.ras[0], avaliacoes: [{ ...POO.ras[0].avaliacoes[0], nota: 10 }, POO.ras[0].avaliacoes[1]] }],
      }
      outraAbaSalvou(nav, { ...dadosVazios(), materias: [comNota] })
      expect(screen.getByRole('alert')).toHaveTextContent('alterada em outra aba')
      for (let i = 0; i < 4; i++) await continuar()
      await userEvent.click(screen.getByRole('button', { name: 'Salvar matéria' }))
      expect(salva(nav).ras[0].avaliacoes[0].nota).toBe(10)
    })

    it('a outra aba salvou sem mexer nesta matéria: nenhum aviso', () => {
      const nav = montar()
      outraAbaSalvou(nav, { ...dadosVazios(), materias: [POO], eventos: [] })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
