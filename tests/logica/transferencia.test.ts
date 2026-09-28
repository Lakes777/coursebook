import { describe, expect, it } from 'vitest'
import { dadosVazios } from '../../src/logica/armazenamento'
import { EXEMPLO_IA, INSTRUCOES_IA } from '../../src/logica/instrucoesIA'
import { notaRA } from '../../src/logica/notas'
import { REGRA_PUCPR, type Dados, type Materia } from '../../src/logica/tipos'
import {
  extrairJson,
  lerImportacao,
  mesclar,
  nomeArquivo,
  nomesRepetidos,
  resumoDados,
  textoExportacao,
  vazio,
} from '../../src/logica/transferencia'

const materia = (id: string, nome: string): Materia => ({
  id,
  nome,
  professor: '',
  horarios: [],
  cargaHoraria: 80,
  ras: [],
  pontosExtras: [],
  faltas: [],
})

function dados(): Dados {
  return {
    ...dadosVazios(),
    materias: [materia('poo', 'POO')],
    eventos: [{ id: 'e1', materiaId: 'poo', titulo: 'Prova', tipo: 'prova', data: '2026-10-01', concluido: false }],
  }
}

describe('exportar', () => {
  it('o backup volta a ser lido igual', () => {
    const d = dados()
    expect(lerImportacao(textoExportacao(d))).toEqual({ ok: true, valor: d })
  })

  it('põe a data no nome do arquivo', () => {
    expect(nomeArquivo(new Date(2026, 8, 5))).toBe('painel-estudos-2026-09-05.json')
  })
})

describe('extrairJson', () => {
  it('tira o bloco de código e as frases em volta', () => {
    expect(extrairJson('Aqui está:\n```json\n{"a": 1}\n```\nAtenção: confira.')).toBe('{"a": 1}')
    expect(extrairJson('```\n{"a": 1}\n```')).toBe('{"a": 1}')
    expect(extrairJson('Claro! {"a": {"b": 2}}\nAtenção: a data do RA2 está em junho.')).toBe('{"a": {"b": 2}}')
    expect(extrairJson('  {"a": 1}  ')).toBe('{"a": 1}')
  })

  it('aceita uma lista colada direto, com várias matérias', () => {
    expect(extrairJson('[{"nome": "A"}, {"nome": "B"}]')).toBe('[{"nome": "A"}, {"nome": "B"}]')
    expect(extrairJson('Segue: [{"a": 1}, {"b": 2}] pronto')).toBe('[{"a": 1}, {"b": 2}]')
  })

  it('não se confunde com chaves no texto antes ou depois do JSON', () => {
    expect(extrairJson('{"a": 1}\nAtenção: a fórmula cita {RA4}, que não existe.')).toBe('{"a": 1}')
    expect(extrairJson('Troquei {RA4} por RA2. {"a": {"b": 2}}')).toBe('{"a": {"b": 2}}')
  })

  it('sem JSON nenhum, devolve o texto para o erro aparecer', () => {
    expect(extrairJson('  não achei o plano  ')).toBe('não achei o plano')
  })
})

describe('lerImportacao', () => {
  it('aceita o exemplo das instruções para a IA', () => {
    const lido = lerImportacao(JSON.stringify(EXEMPLO_IA))
    expect(lido.ok).toBe(true)
    if (!lido.ok) return
    expect(lido.valor.materias[0].ras[1].avaliacoes[0]).toMatchObject({ valorMaximo: 3, nota: null })
    expect(lido.valor.eventos[0].materiaId).toBe('estruturas')
    // O exemplo que a IA vê é o mesmo objeto.
    expect(INSTRUCOES_IA).toContain(JSON.stringify(EXEMPLO_IA, null, 2))
  })

  it('completa o que a IA esquece: versão, ou só a matéria, ou só a lista', () => {
    const { versao: _versao, ...semVersao } = EXEMPLO_IA
    expect(lerImportacao(JSON.stringify(semVersao)).ok).toBe(true)

    const soMateria = lerImportacao(JSON.stringify(EXEMPLO_IA.materias[0]))
    expect(soMateria.ok && soMateria.valor.materias[0].nome).toBe('Estruturas de Dados')

    const lista = lerImportacao(JSON.stringify(EXEMPLO_IA.materias))
    expect(lista.ok && lista.valor.materias).toHaveLength(1)
  })

  it('o exemplo ensina a conta certa: 3 de 3 na prova e 0 de 7 no projeto dá 3,0 no RA', () => {
    const lido = lerImportacao(JSON.stringify(EXEMPLO_IA))
    if (!lido.ok) throw new Error(lido.erro)
    const ra2 = lido.valor.materias[0].ras[1]
    const [prova, projeto] = ra2.avaliacoes
    const comNotas = { ...ra2, avaliacoes: [{ ...prova, nota: 3 }, { ...projeto, nota: 0 }] }
    expect(notaRA(comNotas, REGRA_PUCPR)).toBe(3)
  })

  it('aceita várias matérias numa lista e "materia" no singular', () => {
    const duas = lerImportacao(JSON.stringify([{ nome: 'A' }, { nome: 'B' }]))
    expect(duas.ok && duas.valor.materias.map((m) => m.nome)).toEqual(['A', 'B'])
    const singular = lerImportacao(JSON.stringify({ materia: { nome: 'C' } }))
    expect(singular.ok && singular.valor.materias.map((m) => m.nome)).toEqual(['C'])
  })

  it('recusa JSON que não parece dados do painel (não vira um painel vazio)', () => {
    for (const texto of ['{}', '{"name": "vite", "version": "1.0.0"}', '42', '"texto"']) {
      expect(lerImportacao(texto).ok, texto).toBe(false)
    }
    expect(lerImportacao('{}')).toMatchObject({ erro: expect.stringContaining('"materias"') })
  })

  it('sem regra padrão no JSON, fica a regra atual, e não a da PUC-PR', () => {
    const minha = { mediaMinima: 6, frequenciaMinima: 0.7, arredondarUmaCasa: true }
    const lido = lerImportacao(JSON.stringify({ materias: [] }), minha)
    expect(lido.ok && lido.valor.regraPadrao).toEqual(minha)
    // Um backup traz a regra dele, e ela vale.
    const backup = lerImportacao(textoExportacao(dados()), minha)
    expect(backup.ok && backup.valor.regraPadrao).toEqual(REGRA_PUCPR)
  })

  it('explica o erro', () => {
    expect(lerImportacao('   ')).toEqual({ ok: false, erro: 'Não há nada para importar.' })
    expect(lerImportacao('{ "materias": [ ')).toMatchObject({ ok: false, erro: expect.stringContaining('JSON válido') })
    const semNome = lerImportacao('{"materias": [{"ras": []}]}')
    expect(semNome).toMatchObject({ ok: false, erro: expect.stringContaining('Matéria 1') })
  })
})

describe('mesclar', () => {
  it('junta com ids novos e liga os eventos à matéria certa', () => {
    const atual = dados()
    // A IA usou o mesmo id "poo" que já existe aqui.
    const importado: Dados = {
      ...dadosVazios(),
      materias: [materia('poo', 'Filosofia')],
      eventos: [{ id: 'e1', materiaId: 'poo', titulo: 'Seminário', tipo: 'apresentacao', data: '2026-11-05', concluido: false }],
      regraPadrao: { mediaMinima: 5, frequenciaMinima: 0.5, arredondarUmaCasa: true },
    }
    const junto = mesclar(atual, importado)

    expect(junto.materias.map((m) => m.nome)).toEqual(['POO', 'Filosofia'])
    const filosofia = junto.materias[1]
    expect(filosofia.id).not.toBe('poo')
    expect(junto.eventos[0]).toBe(atual.eventos[0])
    expect(junto.eventos[1]).toMatchObject({ titulo: 'Seminário', materiaId: filosofia.id })
    expect(junto.eventos[1].id).not.toBe('e1')
    // A regra padrão é a de quem já usa o painel.
    expect(junto.regraPadrao).toBe(atual.regraPadrao)
  })

  it('evento sem matéria continua sem matéria', () => {
    const importado: Dados = {
      ...dadosVazios(),
      eventos: [{ id: 'x', titulo: 'Rematrícula', tipo: 'trabalho', data: '2026-12-01', concluido: false }],
    }
    expect(mesclar(dados(), importado).eventos[1]).not.toHaveProperty('materiaId')
  })
})

describe('resumos', () => {
  it('conta matérias e eventos', () => {
    expect(resumoDados(dados())).toBe('1 matéria e 1 evento na agenda')
    expect(resumoDados(dadosVazios())).toBe('0 matérias e 0 eventos na agenda')
    expect(vazio(dadosVazios())).toBe(true)
    expect(vazio(dados())).toBe(false)
  })

  it('acha nomes que já existem, sem ligar para maiúsculas', () => {
    const importado = { ...dadosVazios(), materias: [materia('a', 'poo'), materia('b', 'Cálculo')] }
    expect(nomesRepetidos(dados(), importado)).toEqual(['poo'])
  })
})
