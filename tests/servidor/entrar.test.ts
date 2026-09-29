// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { entrar } from '../../servidor/rotas/entrar'
import { cadastrar, chamar, cookieDe, erroDe, prepararAmbiente } from './ajuda'

const amb = prepararAmbiente()

function entrarCom(email: string, senha: string) {
  return chamar(entrar, amb.ctx, '/api/entrar', { metodo: 'POST', corpo: { email, senha } })
}

async function tentativas(): Promise<number> {
  const { rows } = await amb.pg.query<{ n: number }>('SELECT count(*)::int AS n FROM tentativas_login')
  return rows[0].n
}

describe('POST /api/entrar', () => {
  it('com e-mail (em qualquer caixa) e senha certos, responde 200 e abre uma sessão nova', async () => {
    await cadastrar(amb.ctx, 'Ana@Exemplo.com', 'senha-boa-123')
    const resposta = await entrarCom(' ana@EXEMPLO.com ', 'senha-boa-123')
    expect(resposta.status).toBe(200)
    expect(await resposta.json()).toEqual({ email: 'Ana@Exemplo.com' })
    expect(cookieDe(resposta)?.valor).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const { rows } = await amb.pg.query('SELECT 1 FROM sessoes')
    expect(rows).toHaveLength(2)
  })

  it('senha errada e e-mail inexistente dão exatamente a mesma resposta', async () => {
    await cadastrar(amb.ctx)
    const errada = await entrarCom('ana@exemplo.com', 'senha-errada')
    const inexistente = await entrarCom('ninguem@exemplo.com', 'senha-boa-123')
    for (const resposta of [errada, inexistente]) {
      expect(resposta.status).toBe(401)
      expect(cookieDe(resposta)).toBeNull()
    }
    const esperado = { codigo: 'credenciais', erro: 'E-mail ou senha incorretos.' }
    expect(await errada.json()).toEqual(esperado)
    expect(await inexistente.json()).toEqual(esperado)
    // As duas contam para o bloqueio, exista a conta ou não.
    expect(await tentativas()).toBe(2)
  })

  it('bloqueia no 6º pedido depois de 5 senhas erradas, mesmo com a senha certa', async () => {
    await cadastrar(amb.ctx)
    for (let i = 0; i < 5; i++) {
      expect((await entrarCom('ana@exemplo.com', 'errada-' + i)).status).toBe(401)
      amb.avancar(1)
    }
    const resposta = await entrarCom('ANA@exemplo.com', 'senha-boa-123')
    expect(resposta.status).toBe(429)
    expect(await erroDe(resposta)).toEqual({
      codigo: 'bloqueado',
      erro: 'Muitas tentativas. Tente de novo em 10 minutos.',
    })
    // A primeira errada foi há 5 minutos: faltam 10 para ela sair da janela de 15.
    expect(resposta.headers.get('Retry-After')).toBe('600')
    expect(cookieDe(resposta)).toBeNull()
    // Pedido bloqueado não grava tentativa (senão o bloqueio nunca acabaria).
    expect(await tentativas()).toBe(5)
  })

  it('o bloqueio é por e-mail: outro e-mail continua entrando', async () => {
    await cadastrar(amb.ctx, 'bia@exemplo.com', 'senha-da-bia')
    for (let i = 0; i < 5; i++) await entrarCom('ana@exemplo.com', 'errada')
    expect((await entrarCom('ana@exemplo.com', 'errada')).status).toBe(429)
    expect((await entrarCom('bia@exemplo.com', 'senha-da-bia')).status).toBe(200)
  })

  it('quando a primeira tentativa sai da janela de 15 minutos, volta a conferir a senha', async () => {
    await cadastrar(amb.ctx)
    await entrarCom('ana@exemplo.com', 'errada')
    amb.avancar(5)
    for (let i = 0; i < 4; i++) await entrarCom('ana@exemplo.com', 'errada')
    amb.avancar(9)
    expect((await entrarCom('ana@exemplo.com', 'senha-boa-123')).status).toBe(429)
    amb.avancar(1)
    // 15 minutos depois da primeira: sobram 4 na janela.
    expect((await entrarCom('ana@exemplo.com', 'senha-boa-123')).status).toBe(200)
  })

  it('entrar certo apaga as tentativas daquele e-mail', async () => {
    await cadastrar(amb.ctx)
    for (let i = 0; i < 4; i++) await entrarCom('ana@exemplo.com', 'errada')
    await entrarCom('outro@exemplo.com', 'errada')
    expect((await entrarCom('ana@exemplo.com', 'senha-boa-123')).status).toBe(200)
    expect(await tentativas()).toBe(1)
    // Com as tentativas zeradas, mais 4 erradas ainda não bloqueiam.
    for (let i = 0; i < 4; i++) await entrarCom('ana@exemplo.com', 'errada')
    expect((await entrarCom('ana@exemplo.com', 'senha-boa-123')).status).toBe(200)
  })

  it('tentativas antigas são limpas do banco', async () => {
    await entrarCom('ana@exemplo.com', 'errada')
    amb.avancar(20)
    await entrarCom('bia@exemplo.com', 'errada')
    const { rows } = await amb.pg.query<{ email: string }>('SELECT email FROM tentativas_login')
    expect(rows).toEqual([{ email: 'bia@exemplo.com' }])
  })

  it('recusa senha acima do máximo antes de gravar tentativa ou rodar o argon2', async () => {
    const resposta = await entrarCom('ana@exemplo.com', 'x'.repeat(201))
    expect(resposta.status).toBe(400)
    expect((await erroDe(resposta)).codigo).toBe('pedido-invalido')
    expect(await tentativas()).toBe(0)
  })

  it('confere o e-mail (tamanho, só ASCII, formato) antes de gravar tentativa', async () => {
    const longo = await entrarCom('a'.repeat(1_000_000) + '@x.com', 'senha-boa-123')
    expect(longo.status).toBe(400)
    expect(await erroDe(longo)).toEqual({
      codigo: 'pedido-invalido',
      erro: 'O e-mail pode ter no máximo 254 caracteres.',
    })
    const acento = await entrarCom('joão@exemplo.com', 'senha-boa-123')
    expect(await erroDe(acento)).toEqual({
      codigo: 'pedido-invalido',
      erro: 'Use um e-mail sem acentos ou outros caracteres especiais.',
    })
    expect((await entrarCom('sem-arroba', 'senha-boa-123')).status).toBe(400)
    expect(await tentativas()).toBe(0)
  })

  it('20 pedidos ao mesmo tempo com senha errada: só 5 chegam a conferir, o resto é 429', async () => {
    await cadastrar(amb.ctx)
    const respostas = await Promise.all(
      Array.from({ length: 20 }, (_, i) => entrarCom('ana@exemplo.com', 'errada-' + i)),
    )
    const status = respostas.map((r) => r.status)
    expect(status.filter((s) => s === 401).length).toBeLessThanOrEqual(5)
    expect(status.filter((s) => s !== 401).every((s) => s === 429)).toBe(true)
    expect(await tentativas()).toBeLessThanOrEqual(5)
    expect((await entrarCom('ana@exemplo.com', 'senha-boa-123')).status).toBe(429)
  })

  it('entrar com o cookie de uma sessão antiga apaga essa sessão', async () => {
    const antiga = await cadastrar(amb.ctx)
    const resposta = await chamar(entrar, amb.ctx, '/api/entrar', {
      metodo: 'POST',
      cookie: antiga,
      corpo: { email: 'ana@exemplo.com', senha: 'senha-boa-123' },
    })
    expect(resposta.status).toBe(200)
    const { rows } = await amb.pg.query('SELECT 1 FROM sessoes')
    expect(rows).toHaveLength(1)
  })

  it('recusa pedido sem senha', async () => {
    const resposta = await chamar(entrar, amb.ctx, '/api/entrar', { metodo: 'POST', corpo: { email: 'a@b.c' } })
    expect(resposta.status).toBe(400)
    expect((await erroDe(resposta)).codigo).toBe('pedido-invalido')
  })
})
