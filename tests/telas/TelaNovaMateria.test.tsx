import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { dadosVazios } from '../../src/logica/armazenamento'
import type { Materia, RegraAprovacao } from '../../src/logica/tipos'
import { TelaNovaMateria } from '../../src/telas/TelaNovaMateria'

/** localStorage falso: os testes não mexem no do jsdom. */
function navegador() {
  const itens = new Map<string, string>()
  return {
    itens,
    getItem: (chave: string) => itens.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void itens.set(chave, valor),
  }
}

function montar(regraPadrao?: RegraAprovacao) {
  const nav = navegador()
  const dados = dadosVazios()
  render(
    <ProvedorPainel
      inicial={{ dados: regraPadrao ? { ...dados, regraPadrao } : dados, aviso: null, podeSalvar: true }}
      armazenamento={nav}
    >
      <TelaNovaMateria />
    </ProvedorPainel>,
  )
  return nav
}

/** A matéria gravada no armazenamento falso. */
function materiaSalva(nav: ReturnType<typeof navegador>): Materia {
  const salvo = JSON.parse([...nav.itens.values()][0])
  expect(salvo.materias).toHaveLength(1)
  return salvo.materias[0]
}

const tituloPasso = () => screen.getByRole('heading', { level: 3 })
const grupo = (nome: string) => screen.getByRole('group', { name: nome })
const continuar = () => userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
const voltar = () => userEvent.click(screen.getByRole('button', { name: 'Voltar' }))

async function digitar(campo: HTMLElement, texto: string) {
  await userEvent.clear(campo)
  await userEvent.type(campo, texto)
}

/** Passo 1 com o mínimo: nome e carga horária. */
async function preencherMateria(nome = 'POO') {
  await digitar(screen.getByLabelText('Nome da matéria'), nome)
  await digitar(screen.getByLabelText('Carga horária (aulas de 45 min)'), '80')
}

afterEach(() => {
  window.location.hash = ''
})

describe('TelaNovaMateria', () => {
  it('começa no passo 1, com o progresso marcado', () => {
    montar()
    expect(screen.getByRole('heading', { level: 2, name: 'Nova matéria' })).toBeInTheDocument()
    expect(tituloPasso()).toHaveTextContent('Passo 1 de 5: Matéria')
    const passos = within(screen.getByRole('list', { name: 'Passos' })).getAllByRole('listitem')
    expect(passos).toHaveLength(5)
    expect(passos[0]).toHaveAttribute('aria-current', 'step')
    expect(passos[1]).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '#/materias')
    // A dica da carga horária fica ligada ao campo.
    expect(screen.getByLabelText('Carga horária (aulas de 45 min)')).toHaveAccessibleDescription(/HA/)
  })

  it('não avança com erro: marca o campo, liga a mensagem e põe o foco nele', async () => {
    const nav = montar()
    await continuar()
    const nome = screen.getByLabelText('Nome da matéria')
    expect(nome).toHaveAttribute('aria-invalid', 'true')
    expect(nome).toHaveAccessibleDescription('Dê um nome à matéria (ex.: "Programação Orientada a Objetos").')
    expect(nome).toHaveFocus()
    expect(tituloPasso()).toHaveTextContent('Passo 1 de 5')
    // Corrigir o campo tira a mensagem.
    await userEvent.type(nome, 'P')
    expect(nome).not.toHaveAttribute('aria-invalid')

    // O próximo erro é o da carga horária, que ainda está vazia.
    await continuar()
    const carga = screen.getByLabelText('Carga horária (aulas de 45 min)')
    expect(carga).toHaveAttribute('aria-invalid', 'true')
    expect(carga).toHaveFocus()
    expect(carga).toHaveAccessibleDescription(/Informe a carga horária em aulas/)
    await digitar(carga, '80,5')
    await continuar()
    expect(carga).toHaveAccessibleDescription(/número inteiro de aulas/)
    expect(nav.itens.size).toBe(0)
  })

  it('adiciona e remove horários, e confere a hora', async () => {
    montar()
    await preencherMateria()
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar horário' }))
    const horario = grupo('Horário 1')
    expect(within(horario).getByLabelText('Dia')).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Horário 1 adicionado.')
    await continuar()
    const inicio = within(horario).getByLabelText('Começa às')
    expect(inicio).toHaveAttribute('aria-invalid', 'true')
    expect(inicio).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Remover horário 1' }))
    expect(screen.queryByRole('group', { name: 'Horário 1' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar horário' })).toHaveFocus()
    await continuar()
    expect(tituloPasso()).toHaveTextContent('Passo 2 de 5: RAs')
  })

  it('mostra a soma dos pesos e a porcentagem de cada RA', async () => {
    montar()
    await preencherMateria()
    await continuar()
    await digitar(within(grupo('RA 1')).getByLabelText('Peso na nota final'), '1')
    // Um RA só não pode ser removido.
    expect(screen.queryByRole('button', { name: 'Remover RA 1' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar RA' }))
    const nomeRA2 = within(grupo('RA 2')).getByLabelText('Nome')
    expect(nomeRA2).toHaveValue('RA2')
    expect(nomeRA2).toHaveFocus()
    await digitar(within(grupo('RA 2')).getByLabelText('Peso na nota final'), '3')
    expect(within(grupo('RA 1')).getByLabelText('Peso na nota final')).toHaveAccessibleDescription(
      'Vale 25% da nota final.',
    )
    expect(within(grupo('RA 2')).getByLabelText('Peso na nota final')).toHaveAccessibleDescription(
      'Vale 75% da nota final.',
    )
    expect(screen.getByText(/Soma dos pesos/)).toHaveTextContent('Soma dos pesos: 4')

    await userEvent.click(screen.getByRole('button', { name: 'Remover RA 2' }))
    expect(screen.queryByRole('group', { name: 'RA 2' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar RA' })).toHaveFocus()
  })

  it('pede o peso de cada RA', async () => {
    montar()
    await preencherMateria()
    await continuar()
    await continuar()
    const peso = within(grupo('RA 1')).getByLabelText('Peso na nota final')
    expect(peso).toHaveAttribute('aria-invalid', 'true')
    expect(peso).toHaveFocus()
    expect(tituloPasso()).toHaveTextContent('Passo 2 de 5')
  })

  it('voltar um passo mantém o que foi digitado, e o foco vai para o título do passo', async () => {
    montar()
    await preencherMateria('Cálculo')
    await digitar(screen.getByLabelText('Professor (opcional)'), 'Ana')
    await continuar()
    expect(tituloPasso()).toHaveFocus()
    await digitar(within(grupo('RA 1')).getByLabelText('Peso na nota final'), '7,5')
    await voltar()
    expect(tituloPasso()).toHaveTextContent('Passo 1 de 5: Matéria')
    expect(tituloPasso()).toHaveFocus()
    expect(screen.getByLabelText('Nome da matéria')).toHaveValue('Cálculo')
    expect(screen.getByLabelText('Professor (opcional)')).toHaveValue('Ana')
    await continuar()
    expect(within(grupo('RA 1')).getByLabelText('Peso na nota final')).toHaveValue('7,5')
  })

  it('avisa do RA sem avaliações, sem impedir de seguir', async () => {
    montar()
    await preencherMateria()
    await continuar()
    await digitar(within(grupo('RA 1')).getByLabelText('Peso na nota final'), '100')
    await continuar()
    expect(tituloPasso()).toHaveTextContent('Passo 3 de 5: Avaliações')
    await userEvent.click(screen.getByRole('button', { name: 'Remover avaliação 1 do RA1' }))
    expect(screen.getByRole('button', { name: 'Adicionar avaliação ao RA1' })).toHaveFocus()
    expect(screen.getByText(/Sem avaliações: a nota do RA1 fica pendente/)).toBeInTheDocument()
    await continuar()
    expect(tituloPasso()).toHaveTextContent('Passo 4 de 5')
  })

  it('preenche tudo com a regra padrão, salva sem o campo regra e abre a matéria', async () => {
    const nav = montar()
    // Passo 1
    await digitar(screen.getByLabelText('Nome da matéria'), '  Programação Orientada a Objetos ')
    await digitar(screen.getByLabelText('Professor (opcional)'), 'Ana Souza')
    await digitar(screen.getByLabelText('Carga horária (aulas de 45 min)'), '80')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar horário' }))
    await userEvent.selectOptions(within(grupo('Horário 1')).getByLabelText('Dia'), 'Terça-feira')
    fireEvent.change(within(grupo('Horário 1')).getByLabelText('Começa às'), { target: { value: '07:45' } })
    await continuar()

    // Passo 2
    await digitar(within(grupo('RA 1')).getByLabelText('Peso na nota final'), '40')
    await userEvent.click(within(grupo('RA 1')).getByLabelText('Tem recuperação durante o semestre'))
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar RA' }))
    await digitar(within(grupo('RA 2')).getByLabelText('Peso na nota final'), '60')
    await continuar()

    // Passo 3
    const av1 = grupo('Avaliação 1 do RA1')
    await digitar(within(av1).getByLabelText('Nome'), 'Prova 1')
    await digitar(within(av1).getByLabelText('Vale até'), '3,0')
    fireEvent.change(within(av1).getByLabelText('Data (opcional)'), { target: { value: '2026-10-05' } })
    await digitar(within(grupo('Avaliação 1 do RA2')).getByLabelText('Nome'), 'Projeto')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar avaliação ao RA2' }))
    const av2 = grupo('Avaliação 2 do RA2')
    expect(within(av2).getByLabelText('Nome')).toHaveFocus()
    await digitar(within(av2).getByLabelText('Nome'), 'Apresentação')
    await digitar(within(av2).getByLabelText('Peso no RA'), '2')
    await continuar()

    // Passo 4: a regra padrão vem marcada, com o resumo dela.
    expect(tituloPasso()).toHaveTextContent('Passo 4 de 5: Regra de aprovação')
    expect(screen.getByLabelText('Usar a regra padrão do painel')).toBeChecked()
    expect(screen.getByText('Média mínima 7,0 e frequência mínima de 75%.')).toBeInTheDocument()
    expect(screen.getByText(/de 4,0 a 6,9; a nota da recuperação vale no máximo 7,0/)).toBeInTheDocument()
    await continuar()

    // Passo 5: o resumo
    expect(tituloPasso()).toHaveTextContent('Passo 5 de 5: Revisar e salvar')
    expect(screen.getByText('Programação Orientada a Objetos')).toBeInTheDocument()
    expect(screen.getByText('Terça-feira às 07:45')).toBeInTheDocument()
    expect(screen.getByText('80 aulas de 45 min')).toBeInTheDocument()
    expect(screen.getByText(/Prova 1: vale 3,0, peso 1, em 05\/10\/2026/)).toBeInTheDocument()
    expect(screen.getByText('Regra padrão do painel')).toBeInTheDocument()
    expect(nav.itens.size).toBe(0)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar matéria' }))

    const materia = materiaSalva(nav)
    expect(materia).toMatchObject({
      nome: 'Programação Orientada a Objetos',
      professor: 'Ana Souza',
      cargaHoraria: 80,
      horarios: [{ dia: 2, inicio: '07:45' }],
      pontosExtras: [],
      faltas: [],
      ras: [
        {
          nome: 'RA1',
          peso: 40,
          recuperacaoNoSemestre: true,
          notaRecuperacao: null,
          avaliacoes: [{ nome: 'Prova 1', valorMaximo: 3, peso: 1, nota: null, data: '2026-10-05' }],
        },
        {
          nome: 'RA2',
          peso: 60,
          recuperacaoNoSemestre: false,
          notaRecuperacao: null,
          avaliacoes: [
            { nome: 'Projeto', valorMaximo: 10, peso: 1, nota: null },
            { nome: 'Apresentação', valorMaximo: 10, peso: 2, nota: null },
          ],
        },
      ],
    })
    expect(materia).not.toHaveProperty('regra')
    expect(materia.ras[1].avaliacoes[0]).not.toHaveProperty('data')
    expect(materia.id).toEqual(expect.any(String))
    expect(new Set([materia.ras[0].id, materia.ras[1].id]).size).toBe(2)
    expect(window.location.hash).toBe(`#/materia/${encodeURIComponent(materia.id)}`)
  })

  it('grava a regra própria', async () => {
    const nav = montar()
    await preencherMateria()
    await continuar()
    await digitar(within(grupo('RA 1')).getByLabelText('Peso na nota final'), '100')
    await continuar()
    await digitar(within(grupo('Avaliação 1 do RA1')).getByLabelText('Nome'), 'Prova')
    await continuar()

    await userEvent.click(screen.getByLabelText('Regra própria desta matéria'))
    const media = screen.getByLabelText('Média mínima')
    // Começa com os valores da regra padrão.
    expect(media).toHaveValue('7')
    expect(screen.getByLabelText('Frequência mínima (%)')).toHaveValue('75')
    await digitar(media, '11')
    await continuar()
    expect(media).toHaveAttribute('aria-invalid', 'true')
    expect(media).toHaveFocus()
    await digitar(media, '6,0')
    await digitar(screen.getByLabelText('Frequência mínima (%)'), '70')
    await userEvent.click(screen.getByLabelText('Tem recuperação no fim do semestre'))
    expect(screen.queryByLabelText('Nota máxima da recuperação')).not.toBeInTheDocument()
    await userEvent.click(screen.getByLabelText(/Arredondar a nota final/))
    await continuar()
    expect(screen.getByText('Regra própria')).toBeInTheDocument()
    expect(screen.getByText('Sem recuperação.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar matéria' }))

    expect(materiaSalva(nav).regra).toEqual({ mediaMinima: 6, frequenciaMinima: 0.7, arredondarUmaCasa: true })
  })

  it('o resumo da regra padrão segue a regra do painel', async () => {
    montar({ mediaMinima: 6, frequenciaMinima: 0.7, arredondarUmaCasa: false })
    await preencherMateria()
    await continuar()
    await digitar(within(grupo('RA 1')).getByLabelText('Peso na nota final'), '1')
    await continuar()
    await digitar(within(grupo('Avaliação 1 do RA1')).getByLabelText('Nome'), 'Prova')
    await continuar()
    expect(screen.getByText('Média mínima 6,0 e frequência mínima de 70%.')).toBeInTheDocument()
    expect(screen.getByText('Sem recuperação.')).toBeInTheDocument()
  })

  it('"Alterar" no resumo volta ao passo, e dá para seguir de novo até salvar', async () => {
    const nav = montar()
    await preencherMateria()
    await continuar()
    await digitar(within(grupo('RA 1')).getByLabelText('Peso na nota final'), '1')
    await continuar()
    await digitar(within(grupo('Avaliação 1 do RA1')).getByLabelText('Nome'), 'Prova')
    await continuar()
    await continuar()
    await userEvent.click(screen.getByRole('button', { name: 'Alterar matéria' }))
    expect(tituloPasso()).toHaveTextContent('Passo 1 de 5')
    expect(tituloPasso()).toHaveFocus()
    await digitar(screen.getByLabelText('Nome da matéria'), 'POO 2')
    for (let i = 0; i < 4; i++) await continuar()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar matéria' }))
    expect(materiaSalva(nav).nome).toBe('POO 2')
  })
})
