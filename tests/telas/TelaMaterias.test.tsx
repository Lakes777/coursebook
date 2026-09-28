import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { CHAVE, dadosVazios } from '../../src/logica/armazenamento'
import type { Dados, Materia } from '../../src/logica/tipos'
import { TelaMaterias } from '../../src/telas/TelaMaterias'

function montar(dados: Dados) {
  render(
    <ProvedorPainel inicial={{ dados, aviso: null, podeSalvar: false }}>
      <TelaMaterias />
    </ProvedorPainel>,
  )
}

function materia(id: string, nome: string, nota: number | null, parcial: Partial<Materia> = {}): Materia {
  return {
    id,
    nome,
    professor: '',
    horarios: [],
    cargaHoraria: 80,
    ras: [
      {
        id: 'ra1',
        nome: 'RA1',
        peso: 1,
        avaliacoes: [{ id: 'p', nome: 'Prova', peso: 1, valorMaximo: 10, nota }],
        recuperacaoNoSemestre: false,
        notaRecuperacao: null,
      },
    ],
    pontosExtras: [],
    faltas: [],
    ...parcial,
  }
}

describe('TelaMaterias', () => {
  it('sem matérias, explica e leva para o cadastro', () => {
    montar(dadosVazios())
    expect(screen.getByText(/Cadastre as matérias do semestre/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cadastrar a primeira matéria' })).toHaveAttribute(
      'href',
      '#/nova-materia',
    )
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('sem matérias, mostra o painel com os dados de exemplo, sem apagar a agenda', async () => {
    const nav = new Map<string, string>()
    const evento = { id: 'e', titulo: 'Rematrícula', tipo: 'trabalho', data: '2026-12-01', concluido: false } as const
    render(
      <ProvedorPainel
        inicial={{ dados: { ...dadosVazios(), eventos: [evento] }, aviso: null, podeSalvar: true }}
        armazenamento={{ getItem: (c) => nav.get(c) ?? null, setItem: (c, v) => void nav.set(c, v) }}
      >
        <TelaMaterias />
      </ProvedorPainel>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Ver com dados de exemplo' }))
    const nomes = within(screen.getByRole('list')).getAllByRole('heading').map((h) => h.textContent)
    expect(nomes).toEqual(['Estruturas de Dados', 'Programação Orientada a Objetos', 'Cálculo Numérico'])
    expect(screen.getByRole('heading', { level: 2, name: 'Matérias' })).toHaveFocus()
    // O exemplo foi juntado: o evento que já estava continua lá.
    const salvos = JSON.parse(nav.get(CHAVE)!) as Dados
    expect(salvos.eventos[0]).toEqual(evento)
    expect(salvos.eventos.length).toBeGreaterThan(1)
  })

  it('sem salvar, o exemplo não é oferecido (pareceria guardado sem estar)', () => {
    montar(dadosVazios())
    expect(screen.getByRole('button', { name: 'Ver com dados de exemplo' })).toBeDisabled()
  })

  it('mostra um cartão por matéria, com link, professor e situação', () => {
    const dados = dadosVazios()
    dados.materias.push(
      materia('poo', 'POO', 8, { professor: 'Prof. Exemplo', faltas: [{ id: 'f', data: '2026-09-01', quantidade: 3 }] }),
      materia('filo', 'Filosofia', null, { cargaHoraria: 0 }),
    )
    montar(dados)

    const cartoes = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(cartoes).toHaveLength(2)

    const poo = within(cartoes[0])
    expect(poo.getByRole('link', { name: 'POO' })).toHaveAttribute('href', '#/materia/poo')
    expect(poo.getByText('Prof. Exemplo')).toBeInTheDocument()
    expect(poo.getByText('Aprovado com 8,0')).toHaveClass('selo--ok')
    expect(poo.getByText('3 de 20 faltas')).toHaveClass('selo--ok')

    const filo = within(cartoes[1])
    expect(filo.getByText('Precisa de 7,0 (de 10) no que falta')).toHaveClass('selo--neutro')
    expect(filo.getByText('Sem carga horária')).toHaveClass('selo--neutro')

    expect(screen.getByRole('link', { name: 'Nova matéria' })).toHaveAttribute('href', '#/nova-materia')
  })

  it('mostra os alertas de faltas e de nota', () => {
    const dados = dadosVazios()
    const faltas = (n: number) =>
      Array.from({ length: Math.ceil(n / 4) }, (_, i) => ({
        id: `f${i}`,
        data: `2026-09-${String(i + 1).padStart(2, '0')}`,
        quantidade: Math.min(4, n - 4 * i),
      }))
    const semRecuperacao = { mediaMinima: 7, frequenciaMinima: 0.75, arredondarUmaCasa: false }
    dados.materias.push(
      materia('perto', 'Perto do limite', 8, { faltas: faltas(16) }),
      materia('passou', 'Passou do limite', 8, { faltas: faltas(21) }),
      materia('sem', 'Sem chance', 2, { regra: semRecuperacao }),
    )
    montar(dados)
    expect(screen.getByText('16 de 20 faltas')).toHaveClass('selo--atencao')
    expect(screen.getByText('Reprovado por faltas (21 de 20)')).toHaveClass('selo--perigo')
    expect(screen.getByText('Reprovado com 2,0')).toHaveClass('selo--perigo')
  })

  it('usa a regra própria da matéria', () => {
    const dados = dadosVazios()
    const regra = { ...dados.regraPadrao, arredondarUmaCasa: true }
    dados.materias.push(materia('a', 'Arredonda', 6.95, { regra }), materia('b', 'Não arredonda', 6.95))
    montar(dados)
    expect(screen.getByText('Aprovado com 7,0')).toBeInTheDocument()
    expect(screen.getByText('Em recuperação')).toBeInTheDocument()
  })
})
