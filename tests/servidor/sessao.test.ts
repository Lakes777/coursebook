// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { dadosVazios } from '../../src/logica/armazenamento'
import { cadastro } from '../../servidor/rotas/cadastro'
import { conta } from '../../servidor/rotas/conta'
import { dados } from '../../servidor/rotas/dados'
import { entrar } from '../../servidor/rotas/entrar'
import { eu } from '../../servidor/rotas/eu'
import { sair } from '../../servidor/rotas/sair'
import { cadastrar, chamar, CONVITE, cookieDe, prepararAmbiente } from './ajuda'

const amb = prepararAmbiente()

async function contar(tabela: string): Promise<number> {
  const { rows } = await amb.pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${tabela}`)
  return rows[0].n
}

describe('cookie da sessão', () => {
  it('é HttpOnly, SameSite=Lax, Path=/, dura 30 dias e leva Secure quando seguro', async () => {
    const resposta = await chamar(cadastro, amb.ctx, '/api/cadastro', {
      metodo: 'POST',
      corpo: { email: 'ana@exemplo.com', senha: 'senha-boa-123', convite: CONVITE },
    })
    expect(cookieDe(resposta)!.atributos).toEqual(['Path=/', 'Max-Age=2592000', 'HttpOnly', 'SameSite=Lax', 'Secure'])
    expect(resposta.headers.get('Cache-Control')).toBe('no-store')
  })

  it('sem seguro (http://localhost) não leva Secure', async () => {
    const resposta = await chamar(cadastro, { ...amb.ctx, seguro: false }, '/api/cadastro', {
      metodo: 'POST',
      corpo: { email: 'ana@exemplo.com', senha: 'senha-boa-123', convite: CONVITE },
    })
    expect(cookieDe(resposta)!.atributos).not.toContain('Secure')
  })

  it('o banco guarda só o SHA-256 do token, com a validade de 30 dias', async () => {
    const token = await cadastrar(amb.ctx)
    const { rows } = await amb.pg.query<{ token_hash: string; expira_em: Date }>(
      'SELECT token_hash, expira_em FROM sessoes',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].token_hash).not.toContain(token)
    expect(rows[0].token_hash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(rows[0].expira_em.toISOString()).toBe('2026-10-28T15:30:00.000Z')
  })
})

describe('limpeza de sessões', () => {
  it('ao criar uma sessão, apaga as vencidas de qualquer conta', async () => {
    await cadastrar(amb.ctx)
    amb.avancar(30 * 24 * 60)
    await cadastrar(amb.ctx, 'bia@exemplo.com')
    const { rows } = await amb.pg.query<{ email: string }>(
      'SELECT u.email FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id',
    )
    expect(rows).toEqual([{ email: 'bia@exemplo.com' }])
  })

  it('cadastrar com o cookie de outra conta apaga a sessão antiga', async () => {
    const daAna = await cadastrar(amb.ctx)
    const resposta = await chamar(cadastro, amb.ctx, '/api/cadastro', {
      metodo: 'POST',
      cookie: daAna,
      corpo: { email: 'bia@exemplo.com', senha: 'senha-boa-123', convite: CONVITE },
    })
    expect(resposta.status).toBe(201)
    expect(await contar('sessoes')).toBe(1)
    expect((await chamar(eu, amb.ctx, '/api/eu', { cookie: daAna })).status).toBe(401)
  })
})

describe('GET /api/eu', () => {
  it('sem cookie responde 401 sem-sessao, sem consultar o banco', async () => {
    const consultar = vi.fn()
    const resposta = await chamar(eu, { ...amb.ctx, banco: { consultar } }, '/api/eu')
    expect(resposta.status).toBe(401)
    expect(await resposta.json()).toEqual({
      codigo: 'sem-sessao',
      erro: 'Sua sessão acabou. Entre de novo na sua conta.',
    })
    expect(consultar).not.toHaveBeenCalled()
  })

  it('com token que não existe responde 401', async () => {
    expect((await chamar(eu, amb.ctx, '/api/eu', { cookie: 'inventado' })).status).toBe(401)
  })

  it('lê o cookie mesmo no meio de outros', async () => {
    const token = await cadastrar(amb.ctx)
    const resposta = await chamar(eu, amb.ctx, '/api/eu', {
      cabecalhos: { cookie: `tema=escuro; sessao=${token}; outro=1` },
    })
    expect(resposta.status).toBe(200)
  })

  it('sessão vencida conta como sem sessão e é apagada', async () => {
    const token = await cadastrar(amb.ctx)
    amb.avancar(30 * 24 * 60 - 1)
    expect((await chamar(eu, amb.ctx, '/api/eu', { cookie: token })).status).toBe(200)
    amb.avancar(1)
    expect((await chamar(eu, amb.ctx, '/api/eu', { cookie: token })).status).toBe(401)
    expect(await contar('sessoes')).toBe(0)
  })
})

describe('POST /api/sair', () => {
  it('apaga a sessão e manda o cookie vencido', async () => {
    const token = await cadastrar(amb.ctx)
    const outra = await cadastrar(amb.ctx, 'bia@exemplo.com')
    const resposta = await chamar(sair, amb.ctx, '/api/sair', { metodo: 'POST', cookie: token })
    expect(resposta.status).toBe(204)
    expect(await resposta.text()).toBe('')
    expect(cookieDe(resposta)).toEqual({
      valor: '',
      atributos: ['Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax', 'Secure'],
    })
    expect((await chamar(eu, amb.ctx, '/api/eu', { cookie: token })).status).toBe(401)
    // A sessão da outra conta continua.
    expect((await chamar(eu, amb.ctx, '/api/eu', { cookie: outra })).status).toBe(200)
  })

  it('sem sessão também responde 204', async () => {
    expect((await chamar(sair, amb.ctx, '/api/sair', { metodo: 'POST' })).status).toBe(204)
    expect((await chamar(sair, amb.ctx, '/api/sair', { metodo: 'POST', cookie: 'x' })).status).toBe(204)
  })
})

describe('DELETE /api/conta', () => {
  function excluir(token: string | null, senha: string) {
    return chamar(conta, amb.ctx, '/api/conta', { metodo: 'DELETE', cookie: token, corpo: { senha } })
  }

  it('sem sessão responde 401', async () => {
    expect((await excluir(null, 'qualquer-uma')).status).toBe(401)
  })

  it('com a senha errada responde 401 credenciais e conta como tentativa', async () => {
    const token = await cadastrar(amb.ctx)
    const resposta = await excluir(token, 'senha-errada')
    expect(resposta.status).toBe(401)
    expect(await resposta.json()).toEqual({ codigo: 'credenciais', erro: 'E-mail ou senha incorretos.' })
    expect(await contar('usuarios')).toBe(1)
    expect(await contar('tentativas_login')).toBe(1)
  })

  it('depois de 5 senhas erradas bloqueia também aqui', async () => {
    const token = await cadastrar(amb.ctx)
    for (let i = 0; i < 5; i++) await excluir(token, 'senha-errada')
    const resposta = await excluir(token, 'senha-boa-123')
    expect(resposta.status).toBe(429)
    expect(await contar('usuarios')).toBe(1)
  })

  it('20 pedidos ao mesmo tempo com senha errada: só 5 chegam a conferir, o resto é 429', async () => {
    const token = await cadastrar(amb.ctx)
    const respostas = await Promise.all(Array.from({ length: 20 }, () => excluir(token, 'senha-errada')))
    const status = respostas.map((r) => r.status)
    expect(status.filter((s) => s === 401).length).toBeLessThanOrEqual(5)
    expect(status.filter((s) => s !== 401).every((s) => s === 429)).toBe(true)
    expect(await contar('tentativas_login')).toBeLessThanOrEqual(5)
    expect(await contar('usuarios')).toBe(1)
  })

  it('com a senha certa apaga a conta, as sessões e o painel, e só dessa conta', async () => {
    const token = await cadastrar(amb.ctx)
    const outroAparelho = (await entrarDeNovo()).valor
    const daBia = await cadastrar(amb.ctx, 'bia@exemplo.com')
    for (const t of [token, daBia]) {
      const salvo = await chamar(dados, amb.ctx, '/api/dados', {
        metodo: 'PUT',
        cookie: t,
        corpo: { dados: dadosVazios(), revisao: 0 },
      })
      expect(salvo.status).toBe(200)
    }

    const resposta = await excluir(token, 'senha-boa-123')
    expect(resposta.status).toBe(204)
    expect(cookieDe(resposta)!.atributos).toContain('Max-Age=0')
    expect(await contar('usuarios')).toBe(1)
    expect(await contar('paineis')).toBe(1)
    expect(await contar('sessoes')).toBe(1)
    expect((await chamar(eu, amb.ctx, '/api/eu', { cookie: outroAparelho })).status).toBe(401)
    expect((await chamar(eu, amb.ctx, '/api/eu', { cookie: daBia })).status).toBe(200)
  })

  /** Uma segunda sessão da Ana, como se entrasse em outro aparelho. */
  async function entrarDeNovo() {
    const resposta = await chamar(entrar, amb.ctx, '/api/entrar', {
      metodo: 'POST',
      corpo: { email: 'ana@exemplo.com', senha: 'senha-boa-123' },
    })
    return cookieDe(resposta)!
  }
})
