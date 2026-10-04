// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LIMITES } from '../../src/api/contrato'
import { dadosVazios } from '../../src/logica/armazenamento'
import { aplicarEsquema, COMANDOS_ESQUEMA, comEsquema } from '../../servidor/banco'
import type { Banco } from '../../servidor/contexto'
import { cadastro } from '../../servidor/rotas/cadastro'
import { chaves } from '../../servidor/rotas/chaves'
import { conta } from '../../servidor/rotas/conta'
import { dados } from '../../servidor/rotas/dados'
import { entrar } from '../../servidor/rotas/entrar'
import { eu } from '../../servidor/rotas/eu'
import { prazos } from '../../servidor/rotas/prazos'
import { sair } from '../../servidor/rotas/sair'
import * as apiEu from '../../api/eu'
import { cadastrar, chamar, erroDe, prepararAmbiente } from './ajuda'

const amb = prepararAmbiente()

afterEach(() => {
  vi.restoreAllMocks()
})

describe('método errado', () => {
  it.each([
    [cadastro, 'GET', 'POST'],
    [entrar, 'PUT', 'POST'],
    [sair, 'GET', 'POST'],
    [eu, 'POST', 'GET'],
    [conta, 'POST', 'DELETE'],
    [dados, 'DELETE', 'GET, PUT'],
    [chaves, 'PUT', 'GET, POST, DELETE'],
    [prazos, 'DELETE', 'GET'],
  ])('responde 405 metodo com Allow', async (rota, metodo, permitidos) => {
    const resposta = await chamar(rota, amb.ctx, '/api/x', { metodo })
    expect(resposta.status).toBe(405)
    expect(resposta.headers.get('Allow')).toBe(permitidos)
    expect(resposta.headers.get('Cache-Control')).toBe('no-store')
    expect((await erroDe(resposta)).codigo).toBe('metodo')
  })
})

describe('corpo do pedido', () => {
  it('acima de 2 MB responde 413, pelo Content-Length ou lendo o corpo', async () => {
    const token = await cadastrar(amb.ctx)
    const grande = JSON.stringify({ dados: dadosVazios(), revisao: 0, sobra: 'x'.repeat(LIMITES.corpoMaximo) })
    const resposta = await chamar(dados, amb.ctx, '/api/dados', { metodo: 'PUT', cookie: token, corpo: grande })
    expect(resposta.status).toBe(413)
    expect(await erroDe(resposta)).toEqual({
      codigo: 'muito-grande',
      erro: 'O pedido é grande demais (máximo de 2 MB).',
    })

    // Content-Length mentindo (dizendo menos): o limite vale para o que chega de verdade.
    const req = new Request('https://painel.exemplo/api/entrar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '10' },
      body: grande,
    })
    expect((await entrar(req, amb.ctx)).status).toBe(413)

    const declarado = new Request('https://painel.exemplo/api/entrar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(LIMITES.corpoMaximo + 1) },
      body: '{}',
    })
    expect((await entrar(declarado, amb.ctx)).status).toBe(413)
  })

  it('exige Content-Type application/json', async () => {
    const resposta = await chamar(entrar, amb.ctx, '/api/entrar', {
      metodo: 'POST',
      corpo: { email: 'a@b.c', senha: 'x' },
      cabecalhos: { 'content-type': 'text/plain' },
    })
    expect(resposta.status).toBe(415)
    expect((await erroDe(resposta)).codigo).toBe('pedido-invalido')

    const comCharset = await chamar(entrar, amb.ctx, '/api/entrar', {
      metodo: 'POST',
      corpo: { email: 'a@b.c', senha: 'senha-qualquer' },
      cabecalhos: { 'content-type': 'Application/JSON; charset=utf-8' },
    })
    expect(comCharset.status).toBe(401)
  })

  it('JSON quebrado ou que não é objeto responde 400 pedido-invalido', async () => {
    for (const corpo of ['{"email": ', '[1, 2]', 'null', '"texto"', '']) {
      const resposta = await chamar(entrar, amb.ctx, '/api/entrar', {
        metodo: 'POST',
        corpo,
        cabecalhos: { 'content-type': 'application/json' },
      })
      expect(resposta.status).toBe(400)
      expect((await erroDe(resposta)).codigo).toBe('pedido-invalido')
    }
  })
})

describe('Origin', () => {
  it('recusa pedido que muda algo vindo de outro site', async () => {
    const token = await cadastrar(amb.ctx)
    for (const origem of ['https://malicioso.exemplo', 'null', 'http://painel.exemplo:8080']) {
      const resposta = await chamar(sair, amb.ctx, '/api/sair', {
        metodo: 'POST',
        cookie: token,
        cabecalhos: { origin: origem },
      })
      expect(resposta.status).toBe(403)
      expect((await erroDe(resposta)).codigo).toBe('pedido-invalido')
    }
    // A sessão continua viva.
    expect((await chamar(eu, amb.ctx, '/api/eu', { cookie: token })).status).toBe(200)
  })

  it('vale também para salvar os dados e excluir a conta', async () => {
    const token = await cadastrar(amb.ctx)
    const origin = { origin: 'https://malicioso.exemplo' }
    const salvar = await chamar(dados, amb.ctx, '/api/dados', {
      metodo: 'PUT',
      cookie: token,
      corpo: { dados: dadosVazios(), revisao: 0 },
      cabecalhos: origin,
    })
    expect(salvar.status).toBe(403)
    const excluir = await chamar(conta, amb.ctx, '/api/conta', {
      metodo: 'DELETE',
      cookie: token,
      corpo: { senha: 'senha-boa-123' },
      cabecalhos: origin,
    })
    expect(excluir.status).toBe(403)
    const { rows } = await amb.pg.query(
      'SELECT (SELECT count(*)::int FROM usuarios) AS u, (SELECT count(*)::int FROM paineis) AS p',
    )
    expect(rows).toEqual([{ u: 1, p: 0 }])
  })

  it('aceita o mesmo site, pelo endereço do pedido ou pelo Host', async () => {
    const token = await cadastrar(amb.ctx)
    const mesmo = await chamar(dados, amb.ctx, '/api/dados', {
      metodo: 'PUT',
      cookie: token,
      corpo: { dados: dadosVazios(), revisao: 0 },
      cabecalhos: { origin: 'https://painel.exemplo' },
    })
    expect(mesmo.status).toBe(200)

    // Atrás de um proxy, o endereço interno pode ser outro; o Host é o que o navegador usou.
    const req = new Request('http://interno:3000/api/sair', {
      method: 'POST',
      headers: { origin: 'https://painel.exemplo', host: 'painel.exemplo' },
    })
    expect((await sair(req, amb.ctx)).status).toBe(204)
  })
})

describe('erro inesperado', () => {
  it('responde 500 erro-interno sem contar o detalhe, que vai só para o log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const quebrado: Banco = {
      async consultar() {
        throw new Error('relation "usuarios" does not exist; SELECT senha_hash FROM usuarios')
      },
    }
    const resposta = await chamar(entrar, { ...amb.ctx, banco: quebrado }, '/api/entrar', {
      metodo: 'POST',
      corpo: { email: 'ana@exemplo.com', senha: 'senha-secreta-1' },
    })
    expect(resposta.status).toBe(500)
    expect(resposta.headers.get('Cache-Control')).toBe('no-store')
    const texto = await resposta.text()
    expect(JSON.parse(texto)).toEqual({
      codigo: 'erro-interno',
      erro: 'Algo deu errado no servidor. Tente de novo daqui a pouco.',
    })
    expect(texto).not.toContain('usuarios')
    expect(log).toHaveBeenCalledOnce()
    expect(JSON.stringify(log.mock.calls)).not.toContain('senha-secreta-1')
  })
})

describe('esquema', () => {
  it('aplicar de novo não muda nada nem apaga dados', async () => {
    await cadastrar(amb.ctx)
    await aplicarEsquema(amb.ctx.banco)
    const { rows } = await amb.pg.query('SELECT 1 FROM usuarios')
    expect(rows).toHaveLength(1)
  })

  it('comEsquema aplica uma vez só, antes da primeira consulta, e tenta de novo se falhar', async () => {
    const comandos: string[] = []
    let falhar = true
    const falso: Banco = {
      async consultar(sql) {
        if (falhar && sql.startsWith('CREATE')) {
          falhar = false
          throw new Error('fora do ar')
        }
        comandos.push(sql)
        return []
      },
    }
    const banco = comEsquema(falso)
    await expect(banco.consultar('SELECT 1')).rejects.toThrow('fora do ar')
    await Promise.all([banco.consultar('SELECT 2'), banco.consultar('SELECT 3')])
    await banco.consultar('SELECT 4')
    expect(comandos).toEqual([...COMANDOS_ESQUEMA, 'SELECT 2', 'SELECT 3', 'SELECT 4'])
    expect(COMANDOS_ESQUEMA).toHaveLength(9)
  })
})

describe('funções da Vercel (api/)', () => {
  it('/api/eu sem cookie responde 401 sem precisar de DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', '')
    const resposta = await apiEu.GET(new Request('https://painel.exemplo/api/eu'))
    expect(resposta.status).toBe(401)
    expect((await apiEu.POST(new Request('https://painel.exemplo/api/eu', { method: 'POST' }))).status).toBe(405)
    vi.unstubAllEnvs()
  })
})
