import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
    const nomes = within(screen.getByRole('list', { name: 'Matérias' })).getAllByRole('heading').map((h) => h.textContent)
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

    const cartoes = within(screen.getByRole('list', { name: 'Matérias' })).getAllByRole('listitem')
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

  it('resume o semestre ao lado do botão de nova matéria', () => {
    const dados = dadosVazios()
    dados.materias.push(materia('a', 'A', 8), materia('b', 'B', null), materia('c', 'C', 6))
    montar(dados)
    expect(screen.getByText('3 matérias').closest('p')).toHaveTextContent(
      '3 matérias · 1 aprovada · 1 em andamento · 1 pede atenção',
    )
  })

  describe('próximos prazos', () => {
    afterEach(() => vi.useRealTimers())

    function comEventos(eventos: Dados['eventos']) {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 9, 2, 12))
      const dados = dadosVazios()
      dados.materias.push(materia('poo', 'POO', null))
      dados.eventos = eventos
      montar(dados)
    }

    it('mostra os 3 primeiros pendentes, atrasados antes, com o resto na agenda', () => {
      comEventos([
        { id: '1', titulo: 'Seminário', tipo: 'apresentacao', data: '2026-11-20', concluido: false },
        { id: '2', titulo: 'Prova do RA2', tipo: 'prova', data: '2026-10-07', concluido: false, materiaId: 'poo' },
        { id: '3', titulo: 'Lista 5', tipo: 'trabalho', data: '2026-09-30', concluido: false },
        { id: '4', titulo: 'Relatório', tipo: 'trabalho', data: '2026-10-02', concluido: false },
        { id: '5', titulo: 'Prova do RA1', tipo: 'prova', data: '2026-09-22', concluido: true },
      ])
      const lista = screen.getByRole('list', { name: 'Próximos prazos' })
      const itens = within(lista).getAllByRole('listitem')
      expect(itens.map((i) => i.querySelector('.prazos__nome')?.textContent)).toEqual([
        'Trabalho: Lista 5',
        'Trabalho: Relatório',
        'Prova: Prova do RA2',
      ])
      expect(within(itens[0]).getByText('Atrasado')).toHaveClass('selo--perigo')
      // O prazo vai depois da data só quando o selo não diz o mesmo: aparece uma vez em cada item.
      const detalhe = (i: number) => itens[i].querySelector('.prazos__detalhe')
      expect(detalhe(0)).toHaveTextContent(/^30\/09\/2026 · há 2 dias$/)
      expect(detalhe(1)).toHaveTextContent(/^02\/10\/2026$/)
      expect(within(itens[1]).getByText('Hoje')).toHaveClass('selo--atencao')
      expect(detalhe(2)).toHaveTextContent(/^POO · 07\/10\/2026$/)
      expect(within(itens[2]).getAllByText(/em 5 dias/i)).toHaveLength(1)
      expect(within(itens[2]).getByText('Em 5 dias')).toHaveClass('selo--destaque')
      expect(screen.getByRole('link', { name: 'Ver a agenda (mais 1)' })).toHaveAttribute('href', '#/agenda')
    })

    it('sem nada pendente, a seção não aparece', () => {
      comEventos([{ id: '5', titulo: 'Prova do RA1', tipo: 'prova', data: '2026-09-22', concluido: true }])
      expect(screen.queryByRole('heading', { name: 'Próximos prazos' })).not.toBeInTheDocument()
    })
  })
})
