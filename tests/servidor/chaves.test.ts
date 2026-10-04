// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { RespostaChaveCriada, RespostaChaves, RespostaPrazos } from '../../src/api/contrato'
import { dadosVazios } from '../../src/logica/armazenamento'
import type { Dados } from '../../src/logica/tipos'
import { cadastro } from '../../servidor/rotas/cadastro'
import { chaves } from '../../servidor/rotas/chaves'
import { conta } from '../../servidor/rotas/conta'
import { dados } from '../../servidor/rotas/dados'
import { entrar } from '../../servidor/rotas/entrar'
import { eu } from '../../servidor/rotas/eu'
import { prazos } from '../../servidor/rotas/prazos'
import { sair } from '../../servidor/rotas/sair'
import { cadastrar, chamar, CONVITE, erroDe, prepararAmbiente } from './ajuda'

const amb = prepararAmbiente()
// O relógio dos testes (ajuda.ts): 28/09/2026 às 15h30 UTC, 12h30 em Brasília (segunda-feira).

function criar(sessao: string | null, nome = 'Bot do Telegram', cabecalhos: Record<string, string> = {}) {
  return chamar(chaves, amb.ctx, '/api/chaves', { metodo: 'POST', cookie: sessao, corpo: { nome }, cabecalhos })
}

async function criarToken(sessao: string, nome?: string): Promise<RespostaChaveCriada> {
  const resposta = await criar(sessao, nome)
  if (resposta.status !== 201) throw new Error(`criar chave deu ${resposta.status}`)
  return (await resposta.json()) as RespostaChaveCriada
}

async function listar(sessao: string): Promise<RespostaChaves> {
  return (await (await chamar(chaves, amb.ctx, '/api/chaves', { cookie: sessao })).json()) as RespostaChaves
}

function apagar(sessao: string | null, id: string) {
  return chamar(chaves, amb.ctx, `/api/chaves?id=${id}`, { metodo: 'DELETE', cookie: sessao })
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

function lerPrazos(token: string | null, consulta = '') {
  return chamar(prazos, amb.ctx, '/api/prazos' + consulta, { cabecalhos: token ? bearer(token) : {} })
}

async function salvarPainel(sessao: string, painel: Dados) {
  const resposta = await chamar(dados, amb.ctx, '/api/dados', {
    metodo: 'PUT',
    cookie: sessao,
    corpo: { dados: painel, revisao: 0 },
  })
  if (resposta.status !== 200) throw new Error(`salvar deu ${resposta.status}`)
}

function painelCom(eventos: { titulo: string; data: string }[]): Dados {
  return {
    ...dadosVazios(),
    materias: [
      {
        id: 'calc',
        nome: 'Cálculo',
        professor: '',
        horarios: [{ dia: 3, inicio: '19:00' }],
        cargaHoraria: 80,
        ras: [],
        pontosExtras: [],
        faltas: [],
      },
    ],
    eventos: eventos.map((e, i) => ({ id: `ev${i}`, materiaId: 'calc', tipo: 'prova', concluido: false, ...e })),
  }
}

describe('criar chave', () => {
  it('devolve o token uma vez só; a lista nunca mostra o token', async () => {
    const sessao = await cadastrar(amb.ctx)
    const resposta = await criar(sessao, '  Bot do Telegram  ')
    expect(resposta.status).toBe(201)
    const criada = (await resposta.json()) as RespostaChaveCriada
    expect(criada.token).toMatch(/^cb_[A-Za-z0-9_-]{43}$/)
    expect(criada.chave).toEqual({
      id: expect.stringMatching(/^k_[0-9a-f]{32}$/),
      nome: 'Bot do Telegram',
      criadaEm: '2026-09-28T15:30:00.000Z',
      usadaEm: null,
    })

    const lista = await listar(sessao)
    expect(lista).toEqual({ chaves: [criada.chave] })
    expect(JSON.stringify(lista)).not.toContain(criada.token)
  })

  it('guarda só o SHA-256 do token', async () => {
    const sessao = await cadastrar(amb.ctx)
    const { token } = await criarToken(sessao)
    const { rows } = await amb.pg.query<Record<string, unknown>>('SELECT * FROM chaves_acesso')
    expect(rows).toHaveLength(1)
    expect(rows[0].token_hash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(JSON.stringify(rows)).not.toContain(token.slice(3))
  })

  it('recusa nome vazio ou comprido demais', async () => {
    const sessao = await cadastrar(amb.ctx)
    for (const nome of ['   ', 'x'.repeat(41)]) {
      const resposta = await criar(sessao, nome)
      expect(resposta.status).toBe(400)
      expect((await erroDe(resposta)).codigo).toBe('pedido-invalido')
    }
    expect((await criar(sessao, 'x'.repeat(40))).status).toBe(201)
  })

  it('recusa caracteres de controle no nome', async () => {
    const sessao = await cadastrar(amb.ctx)
    for (const nome of ['Bot\u0000', 'Bot\ndo Telegram', 'Bot\tA', 'Bot\u007f']) {
      const resposta = await criar(sessao, nome)
      expect(resposta.status, JSON.stringify(nome)).toBe(400)
      expect(await erroDe(resposta)).toEqual({
        codigo: 'pedido-invalido',
        erro: 'O nome não pode ter quebras de linha nem caracteres de controle.',
      })
    }
    expect(await listar(sessao)).toEqual({ chaves: [] })
  })

  it('aceita no máximo 5 por conta, e apagar uma libera o lugar', async () => {
    const sessao = await cadastrar(amb.ctx)
    const criadas = []
    for (let i = 1; i <= 5; i++) {
      criadas.push(await criarToken(sessao, `Chave ${i}`))
      amb.avancar(1) // a lista vem em ordem de criação
    }
    const sexta = await criar(sessao, 'Chave 6')
    expect(sexta.status).toBe(409)
    expect(await erroDe(sexta)).toEqual({
      codigo: 'limite-chaves',
      erro: 'Cada conta pode ter no máximo 5 chaves. Apague uma que não usa mais.',
    })
    // O limite é por conta: outra conta cria a dela.
    const bia = await cadastrar(amb.ctx, 'bia@exemplo.com')
    expect((await criar(bia)).status).toBe(201)

    expect((await apagar(sessao, criadas[0].chave.id)).status).toBe(204)
    expect((await criar(sessao, 'Chave 6')).status).toBe(201)
    expect((await listar(sessao)).chaves.map((c) => c.nome)).toEqual([
      'Chave 2',
      'Chave 3',
      'Chave 4',
      'Chave 5',
      'Chave 6',
    ])
  })

  it('sem sessão responde 401, e de outro site 403', async () => {
    expect((await erroDe(await criar(null))).codigo).toBe('sem-sessao')
    expect((await chamar(chaves, amb.ctx, '/api/chaves')).status).toBe(401)
    const sessao = await cadastrar(amb.ctx)
    const deFora = await criar(sessao, 'x', { origin: 'https://malicioso.exemplo' })
    expect(deFora.status).toBe(403)
    expect(await listar(sessao)).toEqual({ chaves: [] })
  })
})

describe('apagar chave', () => {
  it('a chave apagada deixa de abrir os prazos (401)', async () => {
    const sessao = await cadastrar(amb.ctx)
    const { chave, token } = await criarToken(sessao)
    expect((await lerPrazos(token)).status).toBe(200)
    expect((await apagar(sessao, chave.id)).status).toBe(204)
    const depois = await lerPrazos(token)
    expect(depois.status).toBe(401)
    expect(await erroDe(depois)).toEqual({ codigo: 'chave-invalida', erro: 'Chave de acesso inválida ou apagada.' })
  })

  it('não apaga a chave de outra conta (404, como se não existisse)', async () => {
    const ana = await cadastrar(amb.ctx)
    const bia = await cadastrar(amb.ctx, 'bia@exemplo.com')
    const daAna = await criarToken(ana)
    const resposta = await apagar(bia, daAna.chave.id)
    expect(resposta.status).toBe(404)
    expect((await erroDe(resposta)).codigo).toBe('nao-encontrada')
    expect((await lerPrazos(daAna.token)).status).toBe(200)
    expect((await chamar(chaves, amb.ctx, '/api/chaves', { metodo: 'DELETE', cookie: ana })).status).toBe(400)
  })

  it('excluir a conta leva as chaves junto', async () => {
    const sessao = await cadastrar(amb.ctx)
    const { token } = await criarToken(sessao)
    const excluir = await chamar(conta, amb.ctx, '/api/conta', {
      metodo: 'DELETE',
      cookie: sessao,
      corpo: { senha: 'senha-boa-123' },
    })
    expect(excluir.status).toBe(204)
    expect((await lerPrazos(token)).status).toBe(401)
    const { rows } = await amb.pg.query('SELECT 1 FROM chaves_acesso')
    expect(rows).toHaveLength(0)
  })
})

describe('GET /api/prazos', () => {
  it('com Bearer devolve os prazos da conta, calculados no servidor', async () => {
    const sessao = await cadastrar(amb.ctx)
    await salvarPainel(
      sessao,
      painelCom([
        { titulo: 'Prova do RA2', data: '2026-10-07' },
        { titulo: 'Prova do RA1', data: '2026-09-30' },
        { titulo: 'Longe', data: '2026-10-20' },
        { titulo: 'Passou', data: '2026-09-27' },
      ]),
    )
    const { token } = await criarToken(sessao)
    const resposta = await lerPrazos(token)
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('Cache-Control')).toBe('no-store')
    const corpo = (await resposta.json()) as RespostaPrazos
    expect(corpo).toEqual({
      hoje: '2026-09-28',
      ate: '2026-10-05',
      dias: 7,
      prazos: [
        {
          data: '2026-09-30',
          diasRestantes: 2,
          tipo: 'prova',
          tipoNome: 'Prova',
          titulo: 'Prova do RA1',
          materia: 'Cálculo',
          horaAula: '19:00',
        },
      ],
    })

    const mais = (await (await lerPrazos(token, '?dias=9')).json()) as RespostaPrazos
    expect(mais.ate).toBe('2026-10-07')
    expect(mais.prazos.map((p) => p.titulo)).toEqual(['Prova do RA1', 'Prova do RA2'])
  })

  it('anota quando a chave foi usada', async () => {
    const sessao = await cadastrar(amb.ctx)
    const { token } = await criarToken(sessao)
    amb.avancar(60)
    await lerPrazos(token)
    expect((await listar(sessao)).chaves[0].usadaEm).toBe('2026-09-28T16:30:00.000Z')
  })

  it('usa o dia de Brasília: às 22h30 de lá ainda é hoje, mesmo já sendo amanhã em UTC', async () => {
    const sessao = await cadastrar(amb.ctx)
    await salvarPainel(sessao, painelCom([{ titulo: 'Amanhã', data: '2026-09-29' }]))
    const { token } = await criarToken(sessao)
    // 15h30 UTC + 10h = 01h30 UTC do dia 29 = 22h30 do dia 28 em Brasília.
    amb.avancar(10 * 60)
    const corpo = (await (await lerPrazos(token, '?dias=1')).json()) as RespostaPrazos
    expect(corpo.hoje).toBe('2026-09-28')
    expect(corpo.prazos.map((p) => [p.titulo, p.diasRestantes])).toEqual([['Amanhã', 1]])
  })

  it('conta sem painel salvo recebe a lista vazia', async () => {
    const sessao = await cadastrar(amb.ctx)
    const { token } = await criarToken(sessao)
    expect(((await (await lerPrazos(token, '?dias=60')).json()) as RespostaPrazos).prazos).toEqual([])
  })

  it('cada chave só vê o painel da própria conta', async () => {
    const ana = await cadastrar(amb.ctx)
    const bia = await cadastrar(amb.ctx, 'bia@exemplo.com')
    await salvarPainel(ana, painelCom([{ titulo: 'Da Ana', data: '2026-09-29' }]))
    await salvarPainel(bia, painelCom([{ titulo: 'Da Bia', data: '2026-09-29' }]))
    const daAna = await criarToken(ana)
    const daBia = await criarToken(bia)
    const titulos = async (token: string) =>
      ((await (await lerPrazos(token)).json()) as RespostaPrazos).prazos.map((p) => p.titulo)
    expect(await titulos(daAna.token)).toEqual(['Da Ana'])
    expect(await titulos(daBia.token)).toEqual(['Da Bia'])
  })

  it.each([
    ['sem cabeçalho', {}, 'Falta a chave de acesso: use o cabeçalho "Authorization: Bearer cb_...".'],
    ['outro tipo', { authorization: 'Basic abc' }, 'Chave de acesso fora do formato: use "Authorization: Bearer cb_...".'],
    ['sem prefixo', { authorization: 'Bearer ' + 'a'.repeat(46) }, 'Chave de acesso fora do formato: use "Authorization: Bearer cb_...".'],
    ['inventada', { authorization: 'Bearer cb_' + 'a'.repeat(43) }, 'Chave de acesso inválida ou apagada.'],
  ])('chave %s responde 401 com a mensagem em português', async (_caso, cabecalhos, mensagem) => {
    const resposta = await chamar(prazos, amb.ctx, '/api/prazos', { cabecalhos })
    expect(resposta.status).toBe(401)
    expect(resposta.headers.get('WWW-Authenticate')).toBe('Bearer')
    expect(await erroDe(resposta)).toEqual({ codigo: 'chave-invalida', erro: mensagem })
  })

  it('o cookie da sessão não serve: só a chave', async () => {
    const sessao = await cadastrar(amb.ctx)
    const resposta = await chamar(prazos, amb.ctx, '/api/prazos', { cookie: sessao })
    expect(resposta.status).toBe(401)
    expect((await erroDe(resposta)).codigo).toBe('chave-invalida')
  })

  it.each(['0', '61', '7.5', '-1', 'sete', '1e1'])('recusa ?dias=%s', async (dias) => {
    const sessao = await cadastrar(amb.ctx)
    const { token } = await criarToken(sessao)
    const resposta = await lerPrazos(token, `?dias=${dias}`)
    expect(resposta.status).toBe(400)
    expect(await erroDe(resposta)).toEqual({
      codigo: 'pedido-invalido',
      erro: 'O parâmetro "dias" tem que ser um número inteiro de 1 a 60.',
    })
  })

  it('só aceita GET', async () => {
    const sessao = await cadastrar(amb.ctx)
    const { token } = await criarToken(sessao)
    const resposta = await chamar(prazos, amb.ctx, '/api/prazos', { metodo: 'POST', cabecalhos: bearer(token) })
    expect(resposta.status).toBe(405)
    expect(resposta.headers.get('Allow')).toBe('GET')
  })
})

describe('a chave não serve para mais nada', () => {
  it('as rotas da conta e de escrita recusam o cabeçalho Authorization, mesmo com o cookie junto', async () => {
    const sessao = await cadastrar(amb.ctx)
    const { token } = await criarToken(sessao)
    const pedidos = [
      [eu, '/api/eu', { metodo: 'GET' }],
      [dados, '/api/dados', { metodo: 'GET' }],
      [dados, '/api/dados', { metodo: 'PUT', corpo: { dados: dadosVazios(), revisao: 0 } }],
      [chaves, '/api/chaves', { metodo: 'GET' }],
      [chaves, '/api/chaves', { metodo: 'POST', corpo: { nome: 'Outra' } }],
      [chaves, '/api/chaves?id=x', { metodo: 'DELETE' }],
      [conta, '/api/conta', { metodo: 'DELETE', corpo: { senha: 'senha-boa-123' } }],
      [sair, '/api/sair', { metodo: 'POST' }],
      [entrar, '/api/entrar', { metodo: 'POST', corpo: { email: 'ana@exemplo.com', senha: 'senha-boa-123' } }],
      [
        cadastro,
        '/api/cadastro',
        { metodo: 'POST', corpo: { email: 'bia@exemplo.com', senha: 'senha-boa-123', convite: CONVITE } },
      ],
    ] as const
    for (const [rota, caminho, opcoes] of pedidos) {
      for (const cookie of [null, sessao]) {
        const resposta = await chamar(rota, amb.ctx, caminho, { ...opcoes, cookie, cabecalhos: bearer(token) })
        expect(resposta.status, `${opcoes.metodo} ${caminho}`).toBe(403)
        expect(await erroDe(resposta)).toEqual({
          codigo: 'chave-recusada',
          erro: 'Chaves de acesso só servem para ler os prazos (/api/prazos). Para o resto, entre pelo site.',
        })
      }
    }
    // Nada mudou: a conta, a sessão, o painel e a chave continuam como estavam.
    const { rows } = await amb.pg.query(
      `SELECT (SELECT count(*)::int FROM usuarios) AS u, (SELECT count(*)::int FROM paineis) AS p,
              (SELECT count(*)::int FROM chaves_acesso) AS c, (SELECT count(*)::int FROM sessoes) AS s`,
    )
    expect(rows).toEqual([{ u: 1, p: 0, c: 1, s: 1 }])
  })
})
