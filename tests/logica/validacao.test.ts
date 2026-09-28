import { describe, expect, it } from 'vitest'
import { REGRA_PUCPR, type Dados } from '../../src/logica/tipos'
import { validarDados } from '../../src/logica/validacao'

/** Dados completos e corretos, com uma matéria de cada coisa. */
function dadosCompletos(): Dados {
  return {
    versao: 1,
    materias: [
      {
        id: 'poo',
        nome: 'Programação Orientada a Objetos',
        professor: 'Prof. Exemplo',
        horarios: [{ dia: 2, inicio: '07:45' }],
        cargaHoraria: 120,
        ras: [
          {
            id: 'ra1',
            nome: 'RA1',
            peso: 3,
            avaliacoes: [{ id: 'p1', nome: 'Prova', peso: 1, valorMaximo: 3, nota: 2.4, data: '2026-09-22' }],
            recuperacaoNoSemestre: false,
            notaRecuperacao: null,
          },
        ],
        pontosExtras: [{ id: 'x1', pontos: 0.3, comentario: 'Lista de exercícios' }],
        faltas: [{ id: 'f1', data: '2026-09-01', quantidade: 2 }],
        regra: { ...REGRA_PUCPR, arredondarUmaCasa: true },
      },
    ],
    eventos: [
      { id: 'e1', materiaId: 'poo', titulo: 'Prova do RA2', tipo: 'prova', data: '2026-10-27', concluido: false },
    ],
    regraPadrao: REGRA_PUCPR,
  }
}

function erroDe(bruto: unknown): string {
  const r = validarDados(bruto)
  if (r.ok) throw new Error('era para dar erro')
  return r.erro
}

describe('validarDados', () => {
  it('aceita dados corretos sem mudar nada', () => {
    const dados = dadosCompletos()
    expect(validarDados(structuredClone(dados))).toEqual({ ok: true, valor: dados })
  })

  it('devolve uma cópia, não o mesmo objeto', () => {
    const dados = dadosCompletos()
    const r = validarDados(dados)
    if (!r.ok) throw new Error(r.erro)
    expect(r.valor.materias[0]).not.toBe(dados.materias[0])
  })

  it('preenche o que falta com os padrões (dados antigos e JSON feito por IA)', () => {
    const r = validarDados({
      versao: 1,
      materias: [{ nome: 'Filosofia', ras: [{ nome: 'RA1', peso: 40, avaliacoes: [{ nome: 'Prova' }] }] }],
    })
    if (!r.ok) throw new Error(r.erro)
    const [m] = r.valor.materias
    expect(m).toMatchObject({
      nome: 'Filosofia',
      professor: '',
      horarios: [],
      cargaHoraria: 0,
      pontosExtras: [],
      faltas: [],
    })
    expect(m.regra).toBeUndefined()
    expect(m.ras[0]).toMatchObject({ recuperacaoNoSemestre: false, notaRecuperacao: null })
    expect(m.ras[0].avaliacoes[0]).toMatchObject({ peso: 1, valorMaximo: 10, nota: null })
    expect(r.valor.eventos).toEqual([])
    expect(r.valor.regraPadrao).toEqual(REGRA_PUCPR)
  })

  it('a regra padrão preenchida não é a mesma REGRA_PUCPR (mexer nela não estraga a constante)', () => {
    const r = validarDados({ versao: 1 })
    if (!r.ok) throw new Error(r.erro)
    expect(r.valor.regraPadrao.recuperacao).not.toBe(REGRA_PUCPR.recuperacao)
  })

  it('cria ids que faltam (ou são null) em todas as listas, todos diferentes', () => {
    const r = validarDados({
      versao: 1,
      materias: [
        {
          id: null,
          nome: 'A',
          ras: [{ nome: 'RA1', peso: 1, avaliacoes: [{ nome: 'P1' }, { nome: 'P2' }] }],
          pontosExtras: [{ pontos: 0.5, comentario: 'Lista' }],
          faltas: [{ data: '2026-09-01' }],
        },
        { nome: 'B' },
      ],
      eventos: [{ titulo: 'Prova', tipo: 'prova', data: '2026-10-01' }],
    })
    if (!r.ok) throw new Error(r.erro)
    const [a, b] = r.valor.materias
    const ids = [
      a.id,
      b.id,
      a.ras[0].id,
      ...a.ras[0].avaliacoes.map((x) => x.id),
      a.pontosExtras[0].id,
      a.faltas[0].id,
      r.valor.eventos[0].id,
    ]
    for (const id of ids) expect(id).toMatch(/^[\w-]{8,}$/)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cria ids mesmo sem crypto.randomUUID (site aberto pelo IP da rede, sem HTTPS)', () => {
    const original = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      const r = validarDados({ versao: 1, materias: [{ nome: 'A' }, { nome: 'B' }] })
      if (!r.ok) throw new Error(r.erro)
      expect(r.valor.materias[0].id).not.toBe(r.valor.materias[1].id)
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
    }
  })

  it('recusa id vazio', () => {
    const dados = dadosCompletos()
    dados.materias[0].faltas[0].id = '  '
    expect(erroDe(dados)).toMatch(/Falta 1: o id não pode ficar vazio/)
  })

  it('trata null como ausente no professor e null ou "" como evento sem matéria', () => {
    const dados = dadosCompletos() as unknown as Record<string, any>
    dados.materias[0].professor = null
    dados.eventos[0].materiaId = ''
    dados.regraPadrao = null
    const r = validarDados(dados)
    if (!r.ok) throw new Error(r.erro)
    expect(r.valor.materias[0].professor).toBe('')
    expect(r.valor.eventos[0]).not.toHaveProperty('materiaId')
    expect(r.valor.regraPadrao).toEqual(REGRA_PUCPR)
  })

  it('tira espaços das pontas dos textos', () => {
    const dados = dadosCompletos()
    dados.materias[0].nome = '  POO  '
    dados.materias[0].pontosExtras[0].comentario = ' Lista 1 '
    dados.eventos[0].titulo = ' Prova '
    const r = validarDados(dados)
    if (!r.ok) throw new Error(r.erro)
    expect(r.valor.materias[0].nome).toBe('POO')
    expect(r.valor.materias[0].pontosExtras[0].comentario).toBe('Lista 1')
    expect(r.valor.eventos[0].titulo).toBe('Prova')
  })

  it('ignora campos que não conhece', () => {
    const dados = { ...dadosCompletos(), lixo: 1 }
    const r = validarDados(dados)
    if (!r.ok) throw new Error(r.erro)
    expect(r.valor).not.toHaveProperty('lixo')
  })

  it('recusa o que não é objeto', () => {
    expect(erroDe(null)).toMatch(/objeto/)
    expect(erroDe([])).toMatch(/objeto/)
    expect(erroDe('oi')).toMatch(/objeto/)
  })

  it('recusa versão desconhecida', () => {
    expect(erroDe({ versao: 2 })).toMatch(/versão 2/)
    expect(erroDe({})).toBe('falta o campo "versao" (use 1).')
  })

  it('diz onde está o erro, com o nome da matéria', () => {
    const dados = dadosCompletos()
    dados.materias[0].ras[0].avaliacoes[0].nota = 5 // a prova vale 3
    expect(erroDe(dados)).toBe(
      'Matéria 1 (Programação Orientada a Objetos) > RA 1 > Avaliação 1: A nota precisa estar entre 0 e 3.',
    )
  })

  it('usa as mesmas regras dos formulários', () => {
    const casos: [(d: Dados) => void, RegExp][] = [
      [(d) => (d.materias[0].cargaHoraria = 12.5), /carga horária/],
      [(d) => (d.materias[0].ras[0].peso = -1), /peso do RA/],
      [(d) => (d.materias[0].ras[0].notaRecuperacao = 11), /recuperação/],
      [(d) => (d.materias[0].pontosExtras[0].comentario = '   '), /de onde vieram/],
      [(d) => (d.materias[0].faltas[0].quantidade = 0), /quantidade de aulas/],
      [(d) => (d.materias[0].faltas[0].data = '2026-02-30'), /data válida/],
      [(d) => (d.eventos[0].tipo = 'festa' as never), /prova, trabalho ou apresentação/],
      [(d) => (d.eventos[0].titulo = ''), /título/],
    ]
    for (const [estragar, mensagem] of casos) {
      const dados = dadosCompletos()
      estragar(dados)
      expect(erroDe(dados)).toMatch(mensagem)
    }
  })

  it('recusa tipos errados sem quebrar', () => {
    const casos: [(d: Record<string, any>) => void, RegExp][] = [
      [(d) => (d.materias = {}), /materias: era esperada uma lista/],
      [(d) => (d.materias[0].nome = 7), /nome: era esperado um texto/],
      [(d) => (d.materias[0].nome = ''), /nome não pode ficar vazio/],
      [(d) => (d.materias[0].ras[0].avaliacoes[0].nota = '7,5'), /nota: era esperado um número/],
      [(d) => (d.materias[0].ras[0].peso = Number.NaN), /peso: era esperado um número/],
      [(d) => (d.materias[0].pontosExtras[0].comentario = 3), /comentario: era esperado um texto/],
      [(d) => (d.materias[0].ras[0].recuperacaoNoSemestre = 'sim'), /true ou false/],
      [(d) => (d.materias[0].ras = [null]), /RA 1: era esperado um objeto/],
      [(d) => (d.eventos[0].concluido = 1), /concluido: era esperado true ou false/],
    ]
    for (const [estragar, mensagem] of casos) {
      const dados = dadosCompletos() as unknown as Record<string, any>
      estragar(dados)
      expect(erroDe(dados)).toMatch(mensagem)
    }
  })

  it('confere horários', () => {
    const dados = dadosCompletos()
    dados.materias[0].horarios[0].inicio = '7:45'
    expect(erroDe(dados)).toMatch(/HH:MM/)
    dados.materias[0].horarios[0] = { dia: 7 as never, inicio: '07:45' }
    expect(erroDe(dados)).toMatch(/0 \(domingo\) a 6/)
  })

  it('confere datas opcionais só quando existem', () => {
    const dados = dadosCompletos()
    dados.materias[0].ras[0].avaliacoes[0].data = '22/09/2026'
    expect(erroDe(dados)).toMatch(/AAAA-MM-DD/)
    ;(dados.materias[0].ras[0].avaliacoes[0] as { data?: unknown }).data = null
    const r = validarDados(dados)
    if (!r.ok) throw new Error(r.erro)
    expect(r.valor.materias[0].ras[0].avaliacoes[0]).not.toHaveProperty('data')
  })

  it('confere a regra de aprovação', () => {
    const casos: [Partial<Dados['regraPadrao']>, RegExp][] = [
      [{ mediaMinima: 11 }, /média mínima/],
      [{ frequenciaMinima: 75 }, /0.75 = 75%/],
      [{ recuperacao: { notaMinima: 8, teto: 7 } }, /nota mínima para a recuperação/],
      [{ recuperacao: { notaMinima: 4, teto: 12 } }, /teto/],
    ]
    for (const [mudanca, mensagem] of casos) {
      const dados = dadosCompletos()
      dados.regraPadrao = { ...REGRA_PUCPR, ...mudanca }
      expect(erroDe(dados)).toMatch(mensagem)
    }
  })

  it('confere a regra própria da matéria, dizendo qual matéria', () => {
    const dados = dadosCompletos()
    dados.materias[0].regra = { ...REGRA_PUCPR, mediaMinima: -1 }
    expect(erroDe(dados)).toBe(
      'Matéria 1 (Programação Orientada a Objetos) > regra: a média mínima precisa estar entre 0 e 10.',
    )
  })

  it('limita nomes a 100 caracteres', () => {
    const dados = dadosCompletos()
    dados.materias[0].nome = 'a'.repeat(100)
    expect(validarDados(dados).ok).toBe(true)
    dados.materias[0].nome = 'a'.repeat(101)
    expect(erroDe(dados)).toMatch(/nome pode ter no máximo 100/)
    dados.materias[0].nome = 'POO'
    dados.materias[0].professor = 'b'.repeat(101)
    expect(erroDe(dados)).toMatch(/professor pode ter no máximo 100/)
  })

  it('recusa evento com data inválida', () => {
    const dados = dadosCompletos()
    dados.eventos[0].data = '2026-13-01'
    expect(erroDe(dados)).toMatch(/Evento 1: Informe uma data válida/)
  })

  it('aceita regra sem recuperação', () => {
    const dados = dadosCompletos()
    dados.regraPadrao = { mediaMinima: 6, frequenciaMinima: 0.75, arredondarUmaCasa: false }
    const r = validarDados(dados)
    if (!r.ok) throw new Error(r.erro)
    expect(r.valor.regraPadrao).not.toHaveProperty('recuperacao')
  })

  it('recusa id repetido dentro de um RA, dizendo qual avaliação', () => {
    const dados = dadosCompletos()
    const ra = dados.materias[0].ras[0]
    ra.avaliacoes.push({ ...ra.avaliacoes[0], nome: 'Trabalho' })
    expect(erroDe(dados)).toMatch(/RA 1 > Avaliação 2: o id "p1" aparece mais de uma vez/)
  })

  it('recusa id repetido na mesma lista', () => {
    const dados = dadosCompletos()
    dados.materias.push({ ...structuredClone(dados.materias[0]), nome: 'Outra' })
    expect(erroDe(dados)).toMatch(/Matéria 2 \(Outra\): o id "poo" aparece mais de uma vez/)
  })

  it('aceita o mesmo id em listas diferentes (RA1 em duas matérias)', () => {
    const dados = dadosCompletos()
    dados.materias.push({ ...structuredClone(dados.materias[0]), id: 'filo', nome: 'Filosofia' })
    expect(validarDados(dados).ok).toBe(true)
  })

  it('recusa evento de uma matéria que não existe', () => {
    const dados = dadosCompletos()
    dados.eventos[0].materiaId = 'nao-existe'
    expect(erroDe(dados)).toMatch(/Evento 1: não existe matéria com o id "nao-existe"/)
  })

  it('aceita evento sem matéria', () => {
    const dados = dadosCompletos()
    delete dados.eventos[0].materiaId
    const r = validarDados(dados)
    if (!r.ok) throw new Error(r.erro)
    expect(r.valor.eventos[0]).not.toHaveProperty('materiaId')
  })
})
