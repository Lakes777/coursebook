// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { RespostaConflito, RespostaDados } from '../../src/api/contrato'
import { dadosVazios } from '../../src/logica/armazenamento'
import type { Dados } from '../../src/logica/tipos'
import { dados } from '../../servidor/rotas/dados'
import { cadastrar, chamar, erroDe, prepararAmbiente } from './ajuda'

const amb = prepararAmbiente()

function umaMateria(nome = 'Filosofia'): Dados {
  const painel = dadosVazios()
  painel.materias.push({
    id: 'filo',
    nome,
    professor: '',
    horarios: [],
    cargaHoraria: 80,
    ras: [],
    pontosExtras: [],
    faltas: [],
  })
  return painel
}

function baixar(token: string | null) {
  return chamar(dados, amb.ctx, '/api/dados', { cookie: token })
}

function salvar(token: string | null, corpo: unknown) {
  return chamar(dados, amb.ctx, '/api/dados', { metodo: 'PUT', cookie: token, corpo })
}

describe('GET /api/dados', () => {
  it('conta que nunca salvou recebe dados null e revisão 0', async () => {
    const token = await cadastrar(amb.ctx)
    const resposta = await baixar(token)
    expect(resposta.status).toBe(200)
    expect(await resposta.json()).toEqual({ dados: null, revisao: 0 })
  })

  it('sem sessão responde 401', async () => {
    expect((await baixar(null)).status).toBe(401)
    expect((await erroDe(await salvar('inventado', { dados: dadosVazios(), revisao: 0 }))).codigo).toBe('sem-sessao')
  })
})

describe('PUT /api/dados', () => {
  it('com revisão 0 cria o painel na revisão 1', async () => {
    const token = await cadastrar(amb.ctx)
    const resposta = await salvar(token, { dados: umaMateria(), revisao: 0 })
    expect(resposta.status).toBe(200)
    expect(await resposta.json()).toEqual({ revisao: 1 })
    expect(await (await baixar(token)).json()).toEqual({ dados: umaMateria(), revisao: 1 })
  })

  it('com a revisão atual grava e sobe a revisão de 1 em 1', async () => {
    const token = await cadastrar(amb.ctx)
    await salvar(token, { dados: dadosVazios(), revisao: 0 })
    expect(await (await salvar(token, { dados: umaMateria(), revisao: 1 })).json()).toEqual({ revisao: 2 })
    expect(await (await salvar(token, { dados: umaMateria('Cálculo'), revisao: 2 })).json()).toEqual({ revisao: 3 })
    const baixado = (await (await baixar(token)).json()) as RespostaDados
    expect(baixado.revisao).toBe(3)
    expect(baixado.dados!.materias[0].nome).toBe('Cálculo')
  })

  it('com revisão velha responde 409 com o que está na nuvem e não grava', async () => {
    const token = await cadastrar(amb.ctx)
    await salvar(token, { dados: umaMateria('Da nuvem'), revisao: 0 })
    await salvar(token, { dados: umaMateria('Da nuvem 2'), revisao: 1 })

    const resposta = await salvar(token, { dados: umaMateria('Deste aparelho'), revisao: 1 })
    expect(resposta.status).toBe(409)
    const conflito = (await resposta.json()) as RespostaConflito
    expect(conflito.codigo).toBe('conflito')
    expect(conflito.erro).toBe('Outro aparelho salvou mudanças antes deste.')
    expect(conflito.revisao).toBe(2)
    expect(conflito.dados).toEqual(umaMateria('Da nuvem 2'))
  })

  it('revisão 0 quando a nuvem já tem painel também é conflito', async () => {
    const token = await cadastrar(amb.ctx)
    await salvar(token, { dados: umaMateria(), revisao: 0 })
    const resposta = await salvar(token, { dados: dadosVazios(), revisao: 0 })
    expect(resposta.status).toBe(409)
    expect(((await resposta.json()) as RespostaConflito).revisao).toBe(1)
  })

  it('revisão maior que zero sem painel na nuvem é conflito com dados null', async () => {
    const token = await cadastrar(amb.ctx)
    const resposta = await salvar(token, { dados: dadosVazios(), revisao: 4 })
    expect(resposta.status).toBe(409)
    expect(await resposta.json()).toMatchObject({ codigo: 'conflito', dados: null, revisao: 0 })
  })

  it('dados que o painel não abriria dão 400 dados-invalidos com a mensagem da validação', async () => {
    const token = await cadastrar(amb.ctx)
    const ruim = umaMateria() as unknown as { materias: { cargaHoraria: unknown }[] }
    ruim.materias[0].cargaHoraria = 'muita'
    const resposta = await salvar(token, { dados: ruim, revisao: 0 })
    expect(resposta.status).toBe(400)
    const corpo = await erroDe(resposta)
    expect(corpo.codigo).toBe('dados-invalidos')
    expect(corpo.erro).toContain('Filosofia')

    const semVersao = await salvar(token, { dados: { materias: [] }, revisao: 0 })
    expect(await erroDe(semVersao)).toEqual({
      codigo: 'dados-invalidos',
      erro: 'O arquivo não diz a versão dos dados (campo "versao").',
    })
    expect((await erroDe(await salvar(token, { revisao: 0 }))).codigo).toBe('dados-invalidos')
    expect(await (await baixar(token)).json()).toEqual({ dados: null, revisao: 0 })
  })

  it('grava a versão limpa que a validação devolve', async () => {
    const token = await cadastrar(amb.ctx)
    // Sem eventos nem regra padrão (campos que ganham o padrão) e com um campo a mais.
    const incompleto = { versao: 1, materias: umaMateria().materias, campoEstranho: 'x' }
    expect((await salvar(token, { dados: incompleto, revisao: 0 })).status).toBe(200)
    const { rows } = await amb.pg.query<{ dados: Record<string, unknown> }>('SELECT dados FROM paineis')
    expect(rows[0].dados).toEqual(umaMateria())
  })

  it.each([
    ['faltando', undefined],
    ['negativa', -1],
    ['quebrada', 1.5],
    ['em texto', '1'],
  ])('recusa revisão %s', async (_caso, revisao) => {
    const token = await cadastrar(amb.ctx)
    const resposta = await salvar(token, { dados: dadosVazios(), revisao })
    expect(resposta.status).toBe(400)
    expect((await erroDe(resposta)).codigo).toBe('pedido-invalido')
  })

  it('uma conta não vê nem sobrescreve o painel da outra', async () => {
    const ana = await cadastrar(amb.ctx)
    const bia = await cadastrar(amb.ctx, 'bia@exemplo.com')
    await salvar(ana, { dados: umaMateria('Da Ana'), revisao: 0 })
    expect(await (await baixar(bia)).json()).toEqual({ dados: null, revisao: 0 })
    expect((await salvar(bia, { dados: umaMateria('Da Bia'), revisao: 0 })).status).toBe(200)
    expect(((await (await baixar(ana)).json()) as RespostaDados).dados!.materias[0].nome).toBe('Da Ana')
  })
})
