import { describe, expect, it } from 'vitest'
import type { RespostaConflito, RespostaSalvar, Resposta } from '../../src/api/contrato'
import { dadosVazios } from '../../src/logica/armazenamento'
import { REGRA_PUCPR, type Evento } from '../../src/logica/tipos'
import type { ContaGuardada } from '../../src/nuvem/conta'
import { decidirAoAbrir, decidirAposSalvar, decidirErro } from '../../src/nuvem/decidir'
import { comMaterias } from './apoio'

const conta = (campos: Partial<ContaGuardada> = {}): ContaGuardada => ({
  email: 'a@b.com',
  revisao: 3,
  pendente: false,
  ...campos,
})

const LOCAL = comMaterias('POO')
const NUVEM = comMaterias('Cálculo')

describe('decidirAoAbrir', () => {
  const abrir = (c: ContaGuardada, nuvem: { dados: typeof LOCAL | null; revisao: number }, local = LOCAL) =>
    decidirAoAbrir({ local, conta: c, nuvem, podeSalvar: true })

  it('mesma revisão sem nada pendente: em dia', () => {
    expect(abrir(conta(), { dados: NUVEM, revisao: 3 })).toEqual({ tipo: 'em-dia', revisao: 3 })
  })

  it('mesma revisão com mudança pendente: envia', () => {
    expect(abrir(conta({ pendente: true }), { dados: NUVEM, revisao: 3 })).toEqual({ tipo: 'enviar', revisao: 3 })
  })

  it('nuvem mais nova sem pendente: usa a da nuvem', () => {
    expect(abrir(conta(), { dados: NUVEM, revisao: 5 })).toEqual({ tipo: 'adotar-nuvem', dados: NUVEM, revisao: 5 })
  })

  it('nuvem mais nova com pendente: conflito', () => {
    expect(abrir(conta({ pendente: true }), { dados: NUVEM, revisao: 5 })).toEqual({
      tipo: 'conflito',
      dados: NUVEM,
      revisao: 5,
      primeiraVez: false,
    })
  })

  it('nuvem mais nova com pendente, mas com os mesmos dados: só adota a revisão', () => {
    expect(abrir(conta({ pendente: true }), { dados: comMaterias('POO'), revisao: 5 })).toEqual({
      tipo: 'em-dia',
      revisao: 5,
    })
  })

  it('sem poder salvar, não faz nada', () => {
    const decisao = decidirAoAbrir({
      local: LOCAL,
      conta: conta({ pendente: true }),
      nuvem: { dados: NUVEM, revisao: 5 },
      podeSalvar: false,
    })
    expect(decisao).toEqual({ tipo: 'nada' })
  })

  describe('primeira vez que entra', () => {
    const primeira = conta({ revisao: 0, primeiraVez: true })

    it('nuvem vazia e aparelho com matérias: envia com revisão 0', () => {
      expect(abrir(primeira, { dados: null, revisao: 0 })).toEqual({ tipo: 'enviar', revisao: 0 })
    })

    it('nuvem vazia e aparelho só com eventos também envia', () => {
      const evento: Evento = { id: 'e', titulo: 'Prova', tipo: 'prova', data: '2026-10-01', concluido: false }
      const local = { ...dadosVazios(), eventos: [evento] }
      expect(abrir(primeira, { dados: null, revisao: 0 }, local)).toEqual({ tipo: 'enviar', revisao: 0 })
    })

    it('nuvem vazia e aparelho vazio: nada a enviar', () => {
      expect(abrir(primeira, { dados: null, revisao: 0 }, dadosVazios())).toEqual({ tipo: 'em-dia', revisao: 0 })
    })

    it('só a regra padrão editada já conta como dado do aparelho', () => {
      const local = { ...dadosVazios(), regraPadrao: { ...REGRA_PUCPR, mediaMinima: 6 } }
      expect(abrir(primeira, { dados: null, revisao: 0 }, local)).toEqual({ tipo: 'enviar', revisao: 0 })
      const comNuvem = abrir(primeira, { dados: NUVEM, revisao: 4 }, local)
      expect(comNuvem).toMatchObject({ tipo: 'conflito', primeiraVez: true })
    })

    it('nuvem com dados e aparelho vazio: usa a da nuvem', () => {
      expect(abrir(primeira, { dados: NUVEM, revisao: 4 }, dadosVazios())).toEqual({
        tipo: 'adotar-nuvem',
        dados: NUVEM,
        revisao: 4,
      })
    })

    it('nuvem e aparelho iguais: só adota a revisão', () => {
      expect(abrir(primeira, { dados: comMaterias('POO'), revisao: 4 })).toEqual({ tipo: 'em-dia', revisao: 4 })
    })

    it('os dois com dados diferentes: pergunta', () => {
      expect(abrir(primeira, { dados: NUVEM, revisao: 4 })).toEqual({
        tipo: 'conflito',
        dados: NUVEM,
        revisao: 4,
        primeiraVez: true,
      })
    })
  })
})

describe('decidirAposSalvar', () => {
  const salvar = (resposta: Resposta<RespostaSalvar>, local = LOCAL, enviados = LOCAL) =>
    decidirAposSalvar({ resposta, local, enviados, revisaoEnviada: 3, primeiraVez: false })
  const conflito = (dados: typeof LOCAL | null, revisao = 5): Resposta<RespostaSalvar> => {
    const erro: RespostaConflito = { codigo: 'conflito', erro: 'Outro aparelho salvou antes.', dados, revisao }
    return { ok: false, status: 409, erro }
  }

  it('deu certo: guarda a revisão nova', () => {
    expect(salvar({ ok: true, valor: { revisao: 4 } })).toEqual({ tipo: 'salvo', revisao: 4, aindaPendente: false })
  })

  it('deu certo, mas os dados mudaram enquanto ia: continua pendente', () => {
    expect(salvar({ ok: true, valor: { revisao: 4 } }, comMaterias('POO', 'BD'))).toEqual({
      tipo: 'salvo',
      revisao: 4,
      aindaPendente: true,
    })
  })

  it('409 com os mesmos dados (outra aba mandou igual): só adota a revisão', () => {
    expect(salvar(conflito(comMaterias('POO')))).toEqual({ tipo: 'em-dia', revisao: 5 })
  })

  it('409 com o que foi enviado, mas aqui já mudou: adota a revisão e continua pendente', () => {
    expect(salvar(conflito(comMaterias('POO')), comMaterias('POO', 'BD'))).toEqual({
      tipo: 'salvo',
      revisao: 5,
      aindaPendente: true,
    })
  })

  it('409 com outros dados: conflito', () => {
    expect(salvar(conflito(NUVEM))).toEqual({ tipo: 'conflito', dados: NUVEM, revisao: 5, primeiraVez: false })
  })

  it('409 com a nuvem vazia: envia de novo com a revisão dela, uma vez só', () => {
    expect(salvar(conflito(null, 0))).toEqual({ tipo: 'enviar', revisao: 0 })
    expect(salvar(conflito(null, 3))).toMatchObject({ tipo: 'erro' })
  })

  it('sem conexão, sem sessão e outros erros', () => {
    const semConexao = salvar({ ok: false, status: 0, erro: { codigo: 'sem-conexao', erro: 'x' } })
    expect(semConexao).toEqual({ tipo: 'sem-conexao' })
    const semSessao = salvar({ ok: false, status: 401, erro: { codigo: 'sem-sessao', erro: 'x' } })
    expect(semSessao).toEqual({ tipo: 'sem-sessao' })
    expect(salvar({ ok: false, status: 500, erro: { codigo: 'erro-interno', erro: 'Falhou.' } })).toEqual({
      tipo: 'erro',
      mensagem: 'Falhou.',
    })
  })
})

describe('decidirErro', () => {
  it('dados inválidos viram erro com a mensagem da API', () => {
    expect(decidirErro({ codigo: 'dados-invalidos', erro: 'A matéria 1 não tem nome.' })).toEqual({
      tipo: 'erro',
      mensagem: 'A matéria 1 não tem nome.',
    })
  })
})
