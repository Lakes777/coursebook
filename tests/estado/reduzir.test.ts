import { describe, expect, it } from 'vitest'
import type { Acao } from '../../src/estado/acoes'
import { reduzir } from '../../src/estado/reduzir'
import { REGRA_PUCPR, type Dados } from '../../src/logica/tipos'

/** Congela tudo por dentro: se o reducer tentar alterar algo, o teste quebra. */
function congelar<T>(obj: T): T {
  if (typeof obj === 'object' && obj !== null) {
    Object.values(obj).forEach(congelar)
    Object.freeze(obj)
  }
  return obj
}

function dados(): Dados {
  return congelar({
    versao: 1,
    materias: [
      {
        id: 'poo',
        nome: 'POO',
        professor: '',
        horarios: [],
        cargaHoraria: 120,
        ras: [
          {
            id: 'ra1',
            nome: 'RA1',
            peso: 3,
            avaliacoes: [{ id: 'p1', nome: 'Prova', peso: 1, valorMaximo: 3, nota: null }],
            recuperacaoNoSemestre: false,
            notaRecuperacao: null,
          },
        ],
        pontosExtras: [{ id: 'x1', pontos: 0.3, comentario: 'Lista' }],
        faltas: [{ id: 'f1', data: '2026-09-01', quantidade: 2 }],
        regra: { ...REGRA_PUCPR, arredondarUmaCasa: true },
      },
      {
        id: 'filo',
        nome: 'Filosofia',
        professor: '',
        horarios: [],
        cargaHoraria: 80,
        ras: [],
        pontosExtras: [],
        faltas: [],
      },
    ],
    eventos: [
      { id: 'e1', materiaId: 'poo', titulo: 'Prova RA2', tipo: 'prova', data: '2026-10-27', concluido: false },
      { id: 'e2', materiaId: 'filo', titulo: 'Seminário', tipo: 'apresentacao', data: '2026-11-05', concluido: false },
      { id: 'e3', titulo: 'Rematrícula', tipo: 'trabalho', data: '2026-12-01', concluido: false },
    ],
    regraPadrao: REGRA_PUCPR,
  })
}

describe('reduzir', () => {
  it('substitui a matéria de mesmo id e mantém os eventos dela', () => {
    const inicio = dados()
    const editada = { ...inicio.materias[1], nome: 'Filosofia II', cargaHoraria: 40 }
    const d = reduzir(inicio, { tipo: 'materia/substituir', materia: editada })
    expect(d.materias[1]).toBe(editada)
    expect(d.materias[0]).toBe(inicio.materias[0])
    expect(d.eventos).toBe(inicio.eventos)
    // Id que não existe não muda nada (não vira uma matéria nova).
    const outra = reduzir(inicio, { tipo: 'materia/substituir', materia: { ...editada, id: 'nada' } })
    expect(outra).toBe(inicio)
  })

  it('adiciona, edita e remove matéria (e os eventos dela)', () => {
    const inicio = dados()
    const nova = { ...inicio.materias[1], id: 'pscf', nome: 'PSCF' }
    let d = reduzir(inicio, { tipo: 'materia/adicionar', materia: nova })
    expect(d.materias.map((m) => m.id)).toEqual(['poo', 'filo', 'pscf'])

    d = reduzir(d, { tipo: 'materia/editar', materiaId: 'pscf', campos: { nome: 'PSCF 2', cargaHoraria: 60 } })
    expect(d.materias[2]).toMatchObject({ nome: 'PSCF 2', cargaHoraria: 60, professor: '' })

    d = reduzir(d, { tipo: 'materia/remover', materiaId: 'poo' })
    expect(d.materias.map((m) => m.id)).toEqual(['filo', 'pscf'])
    expect(d.eventos.map((e) => e.id)).toEqual(['e2', 'e3']) // o evento sem matéria fica
  })

  it('editar com undefined apaga o campo (volta para a regra padrão)', () => {
    const d = reduzir(dados(), { tipo: 'materia/editar', materiaId: 'poo', campos: { regra: undefined } })
    expect(d.materias[0]).not.toHaveProperty('regra')
  })

  it('mexe em RA e avaliação sem tocar no resto', () => {
    const inicio = dados()
    let d = reduzir(inicio, {
      tipo: 'avaliacao/editar',
      materiaId: 'poo',
      raId: 'ra1',
      avaliacaoId: 'p1',
      campos: { nota: 2.4 },
    })
    expect(d.materias[0].ras[0].avaliacoes[0].nota).toBe(2.4)
    // Só o caminho que mudou é copiado; o resto continua o mesmo objeto.
    expect(d.materias[1]).toBe(inicio.materias[1])
    expect(d.materias[0].faltas).toBe(inicio.materias[0].faltas)
    expect(d.eventos).toBe(inicio.eventos)

    const trabalho = { id: 'p2', nome: 'Trabalho', peso: 1, valorMaximo: 10, nota: null }
    d = reduzir(d, { tipo: 'avaliacao/adicionar', materiaId: 'poo', raId: 'ra1', avaliacao: trabalho })
    d = reduzir(d, { tipo: 'avaliacao/remover', materiaId: 'poo', raId: 'ra1', avaliacaoId: 'p1' })
    expect(d.materias[0].ras[0].avaliacoes).toEqual([trabalho])

    d = reduzir(d, { tipo: 'ra/editar', materiaId: 'poo', raId: 'ra1', campos: { notaRecuperacao: 7 } })
    expect(d.materias[0].ras[0].notaRecuperacao).toBe(7)
    const ra2 = { ...d.materias[0].ras[0], id: 'ra2', nome: 'RA2', avaliacoes: [] }
    d = reduzir(d, { tipo: 'ra/adicionar', materiaId: 'poo', ra: ra2 })
    d = reduzir(d, { tipo: 'ra/remover', materiaId: 'poo', raId: 'ra1' })
    expect(d.materias[0].ras.map((r) => r.id)).toEqual(['ra2'])
  })

  it('adiciona e remove pontos extras e faltas', () => {
    let d = reduzir(dados(), {
      tipo: 'pontoExtra/adicionar',
      materiaId: 'filo',
      pontoExtra: { id: 'x2', pontos: 0.5, comentario: 'Resenha' },
    })
    d = reduzir(d, { tipo: 'pontoExtra/remover', materiaId: 'poo', pontoExtraId: 'x1' })
    expect(d.materias[0].pontosExtras).toEqual([])
    expect(d.materias[1].pontosExtras.map((p) => p.id)).toEqual(['x2'])

    d = reduzir(d, { tipo: 'falta/adicionar', materiaId: 'filo', falta: { id: 'f2', data: '2026-09-03', quantidade: 3 } })
    d = reduzir(d, { tipo: 'falta/remover', materiaId: 'poo', faltaId: 'f1' })
    expect(d.materias[0].faltas).toEqual([])
    expect(d.materias[1].faltas.map((f) => f.id)).toEqual(['f2'])
  })

  it('adiciona, edita, conclui e remove eventos', () => {
    let d = reduzir(dados(), {
      tipo: 'evento/adicionar',
      evento: { id: 'e4', titulo: 'Entrega', tipo: 'trabalho', data: '2026-10-10', concluido: false },
    })
    d = reduzir(d, { tipo: 'evento/editar', eventoId: 'e1', campos: { concluido: true } })
    expect(d.eventos[0].concluido).toBe(true)
    d = reduzir(d, { tipo: 'evento/editar', eventoId: 'e2', campos: { materiaId: undefined } })
    expect(d.eventos[1]).not.toHaveProperty('materiaId')
    d = reduzir(d, { tipo: 'evento/remover', eventoId: 'e1' })
    expect(d.eventos.map((e) => e.id)).toEqual(['e2', 'e3', 'e4'])
  })

  it('troca a regra padrão e substitui tudo', () => {
    const regra = { ...REGRA_PUCPR, mediaMinima: 6 }
    expect(reduzir(dados(), { tipo: 'regraPadrao/definir', regra }).regraPadrao).toBe(regra)
    const outro: Dados = { versao: 1, materias: [], eventos: [], regraPadrao: REGRA_PUCPR }
    expect(reduzir(dados(), { tipo: 'dados/substituir', dados: outro })).toBe(outro)
  })

  it('id que não existe não muda nada (devolve o mesmo objeto)', () => {
    const inicio = dados()
    const acoes: Acao[] = [
      { tipo: 'materia/editar', materiaId: 'x', campos: { nome: 'X' } },
      { tipo: 'materia/remover', materiaId: 'x' },
      { tipo: 'ra/adicionar', materiaId: 'x', ra: inicio.materias[0].ras[0] },
      { tipo: 'ra/editar', materiaId: 'poo', raId: 'x', campos: { peso: 1 } },
      { tipo: 'ra/remover', materiaId: 'poo', raId: 'x' },
      { tipo: 'avaliacao/editar', materiaId: 'poo', raId: 'ra1', avaliacaoId: 'x', campos: { nota: 1 } },
      { tipo: 'avaliacao/remover', materiaId: 'poo', raId: 'ra1', avaliacaoId: 'x' },
      { tipo: 'avaliacao/remover', materiaId: 'poo', raId: 'x', avaliacaoId: 'p1' },
      { tipo: 'pontoExtra/remover', materiaId: 'poo', pontoExtraId: 'x' },
      { tipo: 'falta/remover', materiaId: 'poo', faltaId: 'x' },
      { tipo: 'falta/adicionar', materiaId: 'x', falta: inicio.materias[0].faltas[0] },
      { tipo: 'evento/editar', eventoId: 'x', campos: { concluido: true } },
      { tipo: 'evento/remover', eventoId: 'x' },
    ]
    for (const acao of acoes) expect(reduzir(inicio, acao), acao.tipo).toBe(inicio)
  })

  it('dá o mesmo resultado se chamado duas vezes (StrictMode)', () => {
    const inicio = dados()
    const acao: Acao = { tipo: 'falta/remover', materiaId: 'poo', faltaId: 'f1' }
    expect(reduzir(inicio, acao)).toEqual(reduzir(inicio, acao))
  })
})
