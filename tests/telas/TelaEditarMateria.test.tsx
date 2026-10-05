import { act, render, screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { CHAVE, dadosVazios } from '../../src/logica/armazenamento'
import type { Dados, Materia } from '../../src/logica/tipos'
import { TelaEditarMateria } from '../../src/telas/TelaEditarMateria'
import { criarUsuario } from '../usuario'

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

function montar(materias: Materia[] = [POO]) {
  const nav = navegador()
  render(
    <ProvedorPainel
      inicial={{ dados: { ...dadosVazios(), materias }, aviso: null, podeSalvar: true }}
      armazenamento={nav}
    >
      <TelaEditarMateria id="poo" />
    </ProvedorPainel>,
  )
  return nav
}

const salva = (nav: ReturnType<typeof navegador>): Materia => (JSON.parse(nav.itens.get(CHAVE)!) as Dados).materias[0]
const continuar = () => user.click(screen.getByRole('button', { name: 'Continuar' }))
const grupo = (nome: string) => screen.getByRole('group', { name: nome })
const tituloPasso = () => screen.getByRole('heading', { level: 3 })

/** POO na terça, da 4ª à 7ª aula, e Filosofia (outra matéria) só na 5ª. */
const POO_TERCA: Materia = { ...POO, horarios: [{ dia: 2, inicio: '09:40', fim: '12:40', aulas: 4 }] }
const FILO_5A: Materia = {
  ...POO,
  id: 'filo',
  nome: 'Filosofia',
  horarios: [{ dia: 2, inicio: '10:25', fim: '11:10', aulas: 1 }],
}

beforeEach(() => {
  window.location.hash = '#/materia/poo/editar'
})

let user: UserEvent
beforeEach(() => {
  user = criarUsuario()
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

  it('os horários da própria matéria não contam como ocupados; os das outras, sim', async () => {
    const comHorario: Materia = { ...POO, horarios: [{ dia: 2, inicio: '09:40', fim: '12:40', aulas: 4 }] }
    const filo: Materia = {
      ...POO,
      id: 'filo',
      nome: 'Filosofia',
      horarios: [{ dia: 2, inicio: '07:50', fim: '08:35', aulas: 1 }],
    }
    const nav = montar([comHorario, filo])
    const horario = screen.getByRole('group', { name: 'Horário 1' })
    expect(within(horario).getByLabelText('Da aula')).toHaveDisplayValue('4ª aula (09:40)')
    expect(within(horario).getByRole('option', { name: '2ª aula (07:50) · Filosofia' })).toBeDisabled()
    for (let i = 0; i < 4; i++) await continuar()
    await user.click(screen.getByRole('button', { name: 'Salvar matéria' }))
    expect((JSON.parse(nav.itens.get(CHAVE)!) as Dados).materias[0].horarios).toEqual(comHorario.horarios)
  })

  it('choque que já estava nos dados: salva quem só muda o nome, sem mexer no horário', async () => {
    const nav = montar([POO_TERCA, FILO_5A])
    const horario = grupo('Horário 1')
    // A última aula salva continua visível, mesmo desativada (a 5ª, da Filosofia, fica no caminho).
    const ultima = within(horario).getByLabelText('Até a aula')
    expect(ultima).toHaveDisplayValue('7ª aula (até 12:40)')
    expect(within(ultima).getByRole('option', { name: '7ª aula (até 12:40)' })).toBeDisabled()
    // Mudar só o nome: o horário é o mesmo de antes, então passa.
    await user.clear(screen.getByLabelText('Nome da matéria'))
    await user.type(screen.getByLabelText('Nome da matéria'), 'POO 2')
    await continuar()
    expect(tituloPasso()).toHaveTextContent('Passo 2 de 5')
    for (let i = 0; i < 3; i++) await continuar()
    await user.click(screen.getByRole('button', { name: 'Salvar matéria' }))
    expect(salva(nav)).toMatchObject({ nome: 'POO 2', horarios: POO_TERCA.horarios })
  })

  it('choque que já estava nos dados: trocar para outra aula em cima da Filosofia avisa, sem travar', async () => {
    montar([POO_TERCA, FILO_5A])
    const horario = grupo('Horário 1')
    await user.selectOptions(within(horario).getByLabelText('Da aula'), '3ª aula (08:35)')
    await continuar()
    const primeira = within(horario).getByLabelText('Da aula')
    expect(primeira).toHaveAccessibleDescription(/Choca com Filosofia \(terça-feira, 10:25 às 11:10\)/)
    expect(primeira).toHaveFocus()
    expect(tituloPasso()).toHaveTextContent('Passo 1 de 5')
    await user.selectOptions(within(horario).getByLabelText('Até a aula'), '4ª aula (até 10:25)')
    await continuar()
    expect(tituloPasso()).toHaveTextContent('Passo 2 de 5')
  })

  describe('outra aba mexe na matéria com o formulário aberto', () => {
    function outraAbaSalvou(nav: ReturnType<typeof navegador>, dados: Dados) {
      nav.itens.set(CHAVE, JSON.stringify(dados))
      act(() => void window.dispatchEvent(new StorageEvent('storage', { key: CHAVE })))
    }

    it('removida: o formulário continua, avisa, e salvar coloca a matéria de volta', async () => {
      const nav = montar()
      await user.clear(screen.getByLabelText('Nome da matéria'))
      await user.type(screen.getByLabelText('Nome da matéria'), 'POO 2')
      outraAbaSalvou(nav, dadosVazios())

      expect(screen.getByRole('alert')).toHaveTextContent('removida em outra aba')
      expect(screen.getByLabelText('Nome da matéria')).toHaveValue('POO 2')
      for (let i = 0; i < 4; i++) await continuar()
      await user.click(screen.getByRole('button', { name: 'Salvar matéria' }))
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
      await user.click(screen.getByRole('button', { name: 'Salvar matéria' }))
      expect(salva(nav).ras[0].avaliacoes[0].nota).toBe(10)
    })

    it('outra matéria passou a ocupar o horário salvo, sem mexer nele: salva mesmo assim', async () => {
      // Decisão: o horário é o mesmo de quando o formulário abriu, então vale a mesma regra do
      // choque que já estava nos dados. Na prática só acontece com importação na outra aba,
      // já que o formulário de lá barraria o choque.
      const nav = montar([POO_TERCA])
      await user.clear(screen.getByLabelText('Nome da matéria'))
      await user.type(screen.getByLabelText('Nome da matéria'), 'POO 2')
      for (let i = 0; i < 4; i++) await continuar()
      outraAbaSalvou(nav, { ...dadosVazios(), materias: [POO_TERCA, FILO_5A] })
      await user.click(screen.getByRole('button', { name: 'Salvar matéria' }))
      const dados = JSON.parse(nav.itens.get(CHAVE)!) as Dados
      expect(dados.materias.map((m) => m.nome)).toEqual(['POO 2', 'Filosofia'])
      expect(dados.materias[0].horarios).toEqual(POO_TERCA.horarios)
    })

    it('outra matéria passou a ocupar o horário novo: salvar no revisar volta ao passo 1 com o erro', async () => {
      const nav = montar([POO_TERCA])
      // Muda o horário (4ª à 6ª): deixa de ser o que estava salvo.
      await user.selectOptions(within(grupo('Horário 1')).getByLabelText('Até a aula'), '6ª aula (até 11:55)')
      for (let i = 0; i < 4; i++) await continuar()
      expect(tituloPasso()).toHaveTextContent('Passo 5 de 5')
      outraAbaSalvou(nav, { ...dadosVazios(), materias: [POO_TERCA, FILO_5A] })
      await user.click(screen.getByRole('button', { name: 'Salvar matéria' }))
      expect(tituloPasso()).toHaveTextContent('Passo 1 de 5')
      const primeira = within(grupo('Horário 1')).getByLabelText('Da aula')
      expect(primeira).toHaveAccessibleDescription(/Choca com Filosofia/)
      expect(primeira).toHaveFocus()
      expect(salva(nav).horarios).toEqual(POO_TERCA.horarios)
    })

    it('a outra aba salvou sem mexer nesta matéria: nenhum aviso', () => {
      const nav = montar()
      outraAbaSalvou(nav, { ...dadosVazios(), materias: [POO], eventos: [] })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
