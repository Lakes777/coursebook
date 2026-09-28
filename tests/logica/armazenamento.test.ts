import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHAVE,
  carregar,
  dadosVazios,
  lerDados,
  migrar,
  PREFIXO_COPIA,
  salvar,
} from '../../src/logica/armazenamento'
import { REGRA_PUCPR, type Dados } from '../../src/logica/tipos'

/** localStorage falso, que guarda num Map e pode falhar de propósito. */
function navegador(inicial: Record<string, string> = {}, falhar: { ler?: boolean; gravar?: boolean } = {}) {
  const itens = new Map(Object.entries(inicial))
  return {
    itens,
    getItem(chave: string) {
      if (falhar.ler) throw new DOMException('bloqueado', 'SecurityError')
      return itens.get(chave) ?? null
    },
    setItem(chave: string, valor: string) {
      if (falhar.gravar) throw new DOMException('cheio', 'QuotaExceededError')
      itens.set(chave, valor)
    },
  }
}

const AGORA = new Date('2026-09-28T15:30:00.000Z')

function umaMateria(): Dados {
  const dados = dadosVazios()
  dados.materias.push({
    id: 'filo',
    nome: 'Filosofia',
    professor: '',
    horarios: [],
    cargaHoraria: 80,
    ras: [],
    pontosExtras: [],
    faltas: [],
  })
  return dados
}

describe('dadosVazios', () => {
  it('começa sem nada e com a regra da PUC-PR', () => {
    expect(dadosVazios()).toEqual({ versao: 1, materias: [], eventos: [], regraPadrao: REGRA_PUCPR })
  })

  it('cada chamada devolve uma regra nova', () => {
    expect(dadosVazios().regraPadrao.recuperacao).not.toBe(REGRA_PUCPR.recuperacao)
  })
})

describe('migrar', () => {
  it('não mexe em dados da versão atual', () => {
    expect(migrar({ versao: 1, materias: [] })).toEqual({ ok: true, valor: { versao: 1, materias: [] } })
  })

  it('aplica as migrações em ordem até a versão atual', () => {
    const migracoes = {
      1: (d: Record<string, unknown>) => ({ ...d, passos: ['1->2'] }),
      2: (d: Record<string, unknown>) => ({ ...d, passos: [...((d.passos as string[] | undefined) ?? []), '2->3'] }),
    }
    expect(migrar({ versao: 1 }, migracoes, 3)).toEqual({
      ok: true,
      valor: { versao: 3, passos: ['1->2', '2->3'] },
    })
    expect(migrar({ versao: 2 }, migracoes, 3)).toEqual({ ok: true, valor: { versao: 3, passos: ['2->3'] } })
  })

  it('recusa, sem quebrar, quando a migração dá erro', () => {
    const migracoes = { 1: (d: Record<string, unknown>) => ({ ...d, n: (d.materias as unknown[]).length }) }
    expect(migrar({ versao: 1 }, migracoes, 2)).toEqual({
      ok: false,
      erro: 'Não deu para atualizar os dados da versão 1.',
    })
  })

  it('avisa quando falta uma migração', () => {
    expect(migrar({ versao: 1 }, {}, 2)).toEqual({ ok: false, erro: 'Não sei atualizar dados da versão 1.' })
  })

  it('recusa dados de um painel mais novo', () => {
    const r = migrar({ versao: 2 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/versão 2, de um painel mais novo/)
  })

  it('recusa o que não tem versão', () => {
    for (const bruto of [{}, { versao: '1' }, { versao: 0 }, { versao: 1.5 }]) {
      expect(migrar(bruto)).toEqual({ ok: false, erro: 'O arquivo não diz a versão dos dados (campo "versao").' })
    }
    expect(migrar([])).toEqual({ ok: false, erro: 'O arquivo não tem os dados do painel.' })
    expect(migrar(null)).toEqual({ ok: false, erro: 'O arquivo não tem os dados do painel.' })
  })
})

describe('lerDados', () => {
  it('lê o que salvar() gravou', () => {
    const dados = umaMateria()
    const nav = navegador()
    salvar(dados, nav)
    expect(lerDados(nav.itens.get(CHAVE)!)).toEqual({ ok: true, valor: dados })
  })

  it('recusa JSON quebrado', () => {
    expect(lerDados('{"versao": 1,')).toEqual({ ok: false, erro: 'O texto não é um JSON válido.' })
  })

  it('passa os erros da validação adiante', () => {
    const r = lerDados(JSON.stringify({ versao: 1, materias: [{ nome: '' }] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/Matéria 1: o nome não pode ficar vazio/)
  })
})

describe('carregar', () => {
  afterEach(() => {
    vi.restoreAllMocks() // antes do clear(), que precisa do localStorage de volta
    localStorage.clear()
  })

  it('começa vazio na primeira visita', () => {
    expect(carregar(navegador(), AGORA)).toEqual({ dados: dadosVazios(), aviso: null, podeSalvar: true })
  })

  it('lê os dados salvos', () => {
    const dados = umaMateria()
    const r = carregar(navegador({ [CHAVE]: JSON.stringify(dados) }), AGORA)
    expect(r).toEqual({ dados, aviso: null, podeSalvar: true })
  })

  it('guarda uma cópia do que não conseguiu ler e começa vazio', () => {
    const nav = navegador({ [CHAVE]: '{"versao": 1, "mat' })
    const r = carregar(nav, AGORA)
    const copia = `${PREFIXO_COPIA}2026-09-28T15:30:00.000Z`
    expect(nav.itens.get(copia)).toBe('{"versao": 1, "mat')
    expect(r.dados).toEqual(dadosVazios())
    expect(r.podeSalvar).toBe(true)
    expect(r.aviso).toContain('O texto não é um JSON válido.')
    expect(r.aviso).toContain(copia)
  })

  it('grava o painel vazio depois da cópia, para a próxima visita não copiar de novo', () => {
    const nav = navegador({ [CHAVE]: 'lixo' })
    carregar(nav, AGORA)
    expect(JSON.parse(nav.itens.get(CHAVE)!)).toEqual(dadosVazios())
    const depois = carregar(nav, new Date('2026-09-29T10:00:00.000Z'))
    expect(depois.aviso).toBeNull()
    expect([...nav.itens.keys()].filter((k) => k.startsWith(PREFIXO_COPIA))).toHaveLength(1)
  })

  it('guarda cópia de JSON válido que a validação recusa, com a mensagem dela', () => {
    const texto = JSON.stringify({ versao: 1, materias: [{ nome: '' }] })
    const nav = navegador({ [CHAVE]: texto })
    const r = carregar(nav, AGORA)
    expect(nav.itens.get(`${PREFIXO_COPIA}2026-09-28T15:30:00.000Z`)).toBe(texto)
    expect(r.aviso).toContain('Matéria 1: o nome não pode ficar vazio.')
  })

  it('também guarda cópia de dados de um painel mais novo', () => {
    const texto = JSON.stringify({ versao: 99 })
    const nav = navegador({ [CHAVE]: texto })
    expect(carregar(nav, AGORA).aviso).toMatch(/painel mais novo/)
    expect(nav.itens.get(`${PREFIXO_COPIA}2026-09-28T15:30:00.000Z`)).toBe(texto)
  })

  it('não deixa salvar por cima se nem a cópia deu para guardar', () => {
    const nav = navegador({ [CHAVE]: 'lixo' }, { gravar: true })
    const r = carregar(nav, AGORA)
    expect(r.podeSalvar).toBe(false)
    expect(r.aviso).toMatch(/nada será salvo/)
    expect(nav.itens.get(CHAVE)).toBe('lixo')
  })

  it('não quebra quando o navegador bloqueia o localStorage', () => {
    const r = carregar(navegador({}, { ler: true }), AGORA)
    expect(r.dados).toEqual(dadosVazios())
    expect(r.podeSalvar).toBe(false)
    expect(r.aviso).toMatch(/não deixou ler/)
  })

  it('usa o localStorage de verdade quando não recebe outro', () => {
    const dados = umaMateria()
    expect(salvar(dados)).toBeNull()
    expect(carregar().dados).toEqual(dados)
  })

  it('não quebra quando até acessar o localStorage dá erro (cookies bloqueados no Chrome)', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    const r = carregar()
    expect(r.podeSalvar).toBe(false)
    expect(r.dados).toEqual(dadosVazios())
    expect(salvar(umaMateria())).toMatch(/Não deu para salvar/)
  })
})

describe('salvar', () => {
  it('grava em JSON na chave do painel', () => {
    const nav = navegador()
    expect(salvar(umaMateria(), nav)).toBeNull()
    expect(JSON.parse(nav.itens.get(CHAVE)!)).toEqual(umaMateria())
  })

  it('devolve a mensagem quando o navegador está sem espaço', () => {
    expect(salvar(umaMateria(), navegador({}, { gravar: true }))).toMatch(/Exporte seus dados/)
  })
})
