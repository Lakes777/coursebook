import { describe, expect, it } from 'vitest'
import { dadosVazios } from '../../src/logica/armazenamento'
import { hojeNoFuso, prazos, somarDias } from '../../src/logica/prazos'
import type { Avaliacao, Dados, Evento, Materia } from '../../src/logica/tipos'

// Domingo, 04/10/2026.
const HOJE = '2026-10-04'

function materia(id: string, nome: string, outros: Partial<Materia> = {}): Materia {
  return { id, nome, professor: '', horarios: [], cargaHoraria: 80, ras: [], pontosExtras: [], faltas: [], ...outros }
}

let contador = 0
function evento(titulo: string, data: string, outros: Partial<Evento> = {}): Evento {
  contador += 1
  return { id: `ev${contador}`, titulo, tipo: 'prova', data, concluido: false, ...outros }
}

function avaliacao(nome: string, data: string | undefined, nota: number | null = null): Avaliacao {
  return { id: `av-${nome}`, nome, peso: 1, valorMaximo: 10, nota, ...(data ? { data } : {}) }
}

function painel(materias: Materia[], eventos: Evento[]): Dados {
  return { ...dadosVazios(), materias, eventos }
}

describe('prazos', () => {
  it('pega de hoje até hoje + dias (os dois entram), sem atrasados nem os de depois', () => {
    const dados = painel(
      [],
      [
        evento('Ontem', '2026-10-03'),
        evento('Hoje', '2026-10-04'),
        evento('Último dia', '2026-10-11'),
        evento('Depois', '2026-10-12'),
      ],
    )
    expect(prazos(dados, HOJE, 7).map((p) => [p.titulo, p.diasRestantes])).toEqual([
      ['Hoje', 0],
      ['Último dia', 7],
    ])
    expect(prazos(dados, HOJE, 1).map((p) => p.titulo)).toEqual(['Hoje'])
  })

  it('deixa de fora os concluídos', () => {
    const dados = painel([], [evento('Feito', '2026-10-05', { concluido: true }), evento('Falta', '2026-10-05')])
    expect(prazos(dados, HOJE, 7).map((p) => p.titulo)).toEqual(['Falta'])
  })

  it('ordena por data, depois matéria e título', () => {
    const dados = painel(
      [materia('calc', 'Cálculo'), materia('alg', 'Álgebra')],
      [
        evento('B', '2026-10-06', { materiaId: 'calc' }),
        evento('Z', '2026-10-05', { materiaId: 'calc' }),
        evento('A', '2026-10-06', { materiaId: 'calc' }),
        evento('Sem matéria', '2026-10-06'),
        evento('Y', '2026-10-06', { materiaId: 'alg' }),
      ],
    )
    expect(prazos(dados, HOJE, 7).map((p) => `${p.data} ${p.materia ?? '-'} ${p.titulo}`)).toEqual([
      '2026-10-05 Cálculo Z',
      '2026-10-06 - Sem matéria',
      '2026-10-06 Álgebra Y',
      '2026-10-06 Cálculo A',
      '2026-10-06 Cálculo B',
    ])
  })

  it('monta cada prazo com o tipo, a matéria e a hora da primeira aula naquele dia da semana', () => {
    const calc = materia('calc', 'Cálculo', {
      horarios: [
        { dia: 2, inicio: '19:00' },
        { dia: 2, inicio: '07:50' },
        { dia: 4, inicio: '10:00' },
      ],
    })
    const dados = painel(
      [calc],
      [
        evento('Prova do RA1', '2026-10-06', { materiaId: 'calc' }), // terça
        evento('Lista', '2026-10-07', { materiaId: 'calc', tipo: 'trabalho' }), // quarta: sem aula
      ],
    )
    expect(prazos(dados, HOJE, 7)).toEqual([
      {
        data: '2026-10-06',
        diasRestantes: 2,
        tipo: 'prova',
        tipoNome: 'Prova',
        titulo: 'Prova do RA1',
        materia: 'Cálculo',
        horaAula: '07:50',
      },
      {
        data: '2026-10-07',
        diasRestantes: 3,
        tipo: 'trabalho',
        tipoNome: 'Trabalho',
        titulo: 'Lista',
        materia: 'Cálculo',
        horaAula: null,
      },
    ])
  })

  it('inclui as avaliações com data e sem nota, menos as que já estão pendentes na agenda no mesmo dia', () => {
    const fisica = materia('fis', 'Física', {
      ras: [
        {
          id: 'ra1',
          nome: 'RA1',
          peso: 1,
          recuperacaoNoSemestre: false,
          notaRecuperacao: null,
          avaliacoes: [
            avaliacao('Prova 1', '2026-10-05'),
            avaliacao('Já corrigida', '2026-10-05', 8),
            avaliacao('Sem data', undefined),
            avaliacao('Longe', '2026-11-30'),
            avaliacao('Na agenda', '2026-10-08'),
          ],
        },
      ],
    })
    const dados = painel([fisica], [evento('Prova 2 de Física', '2026-10-08', { materiaId: 'fis' })])
    expect(prazos(dados, HOJE, 7).map((p) => [p.tipo, p.titulo])).toEqual([
      ['avaliacao', 'Prova 1 (RA1)'],
      ['prova', 'Prova 2 de Física'],
    ])
    // A mesma prova com o evento já concluído: o evento sai, e a avaliação sem nota volta.
    dados.eventos[0].concluido = true
    expect(prazos(dados, HOJE, 7).map((p) => [p.tipo, p.titulo])).toEqual([
      ['avaliacao', 'Prova 1 (RA1)'],
      ['avaliacao', 'Na agenda (RA1)'],
    ])
    expect(prazos(dados, HOJE, 7)[0]).toEqual(
      {
        data: '2026-10-05',
        diasRestantes: 1,
        tipo: 'avaliacao',
        tipoNome: 'Avaliação',
        titulo: 'Prova 1 (RA1)',
        materia: 'Física',
        horaAula: null,
      },
    )
  })

  it('painel vazio não tem prazos', () => {
    expect(prazos(dadosVazios(), HOJE, 60)).toEqual([])
  })
})

describe('hojeNoFuso', () => {
  it('usa o dia de Brasília, mesmo quando em UTC já é amanhã', () => {
    // 01h30 UTC do dia 5 = 22h30 do dia 4 em Brasília.
    expect(hojeNoFuso(new Date('2026-10-05T01:30:00Z'))).toBe('2026-10-04')
    expect(hojeNoFuso(new Date('2026-10-05T03:00:00Z'))).toBe('2026-10-05')
    expect(hojeNoFuso(new Date('2026-10-05T01:30:00Z'), 'UTC')).toBe('2026-10-05')
  })
})

describe('somarDias', () => {
  it('passa de mês e de ano', () => {
    expect(somarDias('2026-10-04', 7)).toBe('2026-10-11')
    expect(somarDias('2026-10-28', 7)).toBe('2026-11-04')
    expect(somarDias('2026-12-30', 60)).toBe('2027-02-28')
  })
})
