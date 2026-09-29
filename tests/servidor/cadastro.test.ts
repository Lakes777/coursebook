// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { cadastro } from '../../servidor/rotas/cadastro'
import { eu } from '../../servidor/rotas/eu'
import { chamar, CONVITE, cookieDe, erroDe, prepararAmbiente } from './ajuda'

const amb = prepararAmbiente()

function cadastrarCom(corpo: Record<string, unknown>, ctx = amb.ctx) {
  return chamar(cadastro, ctx, '/api/cadastro', { metodo: 'POST', corpo })
}

const valido = { email: 'Ana@Exemplo.com', senha: 'senha-boa-123', convite: CONVITE }

describe('POST /api/cadastro', () => {
  it('cria a conta, responde 201 com o e-mail como foi digitado e já entra', async () => {
    const resposta = await cadastrarCom({ ...valido, email: '  Ana@Exemplo.com ' })
    expect(resposta.status).toBe(201)
    expect(await resposta.json()).toEqual({ email: 'Ana@Exemplo.com' })

    const token = cookieDe(resposta)!.valor
    const quem = await chamar(eu, amb.ctx, '/api/eu', { cookie: token })
    expect(await quem.json()).toEqual({ email: 'Ana@Exemplo.com' })
  })

  it('guarda a senha com argon2id e o id no formato u_ + 32 hex', async () => {
    await cadastrarCom(valido)
    const { rows } = await amb.pg.query<{ id: string; senha_hash: string }>('SELECT id, senha_hash FROM usuarios')
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toMatch(/^u_[0-9a-f]{32}$/)
    expect(rows[0].senha_hash).toMatch(/^\$argon2id\$/)
    expect(rows[0].senha_hash).not.toContain('senha-boa-123')
  })

  it('recusa o convite errado com 403 e não cria nada', async () => {
    const resposta = await cadastrarCom({ ...valido, convite: 'chute' })
    expect(resposta.status).toBe(403)
    expect(await resposta.json()).toEqual({ codigo: 'convite-invalido', erro: 'Código de convite incorreto.' })
    expect(cookieDe(resposta)).toBeNull()
    expect((await amb.pg.query('SELECT 1 FROM usuarios')).rows).toHaveLength(0)
  })

  it('sem CODIGO_CONVITE, o cadastro está fechado para qualquer código', async () => {
    const fechado = { ...amb.ctx, convite: undefined }
    for (const convite of ['', CONVITE, 'undefined']) {
      const resposta = await cadastrarCom({ ...valido, convite }, fechado)
      expect(resposta.status).toBe(403)
      expect(await resposta.json()).toEqual({ codigo: 'convite-invalido', erro: 'O cadastro de contas está fechado.' })
    }
  })

  it('confere o convite antes do formato do e-mail', async () => {
    const resposta = await cadastrarCom({ ...valido, email: 'sem-arroba', convite: 'chute' })
    expect(resposta.status).toBe(403)
  })

  it.each([
    ['sem arroba', 'ana.exemplo.com'],
    ['com espaço no meio', 'ana maria@exemplo.com'],
    ['vazio', '   '],
    ['longo demais', 'a'.repeat(250) + '@x.com'],
  ])('recusa e-mail %s', async (_caso, email) => {
    const resposta = await cadastrarCom({ ...valido, email })
    expect(resposta.status).toBe(400)
    expect((await erroDe(resposta)).codigo).toBe('pedido-invalido')
  })

  it('aceita senha de 8 a 200 caracteres', async () => {
    const curta = await cadastrarCom({ ...valido, senha: '1234567' })
    expect(curta.status).toBe(400)
    expect(await curta.json()).toEqual({
      codigo: 'pedido-invalido',
      erro: 'A senha precisa ter pelo menos 8 caracteres.',
    })

    const longa = await cadastrarCom({ ...valido, senha: 'x'.repeat(201) })
    expect(longa.status).toBe(400)
    expect((await erroDe(longa)).erro).toBe('A senha pode ter no máximo 200 caracteres.')

    expect((await cadastrarCom({ ...valido, senha: '12345678' })).status).toBe(201)
    expect((await cadastrarCom({ ...valido, email: 'b@x.com', senha: 'y'.repeat(200) })).status).toBe(201)
  })

  it('recusa campo faltando ou de outro tipo', async () => {
    const resposta = await cadastrarCom({ email: 'ana@exemplo.com', senha: 12345678, convite: CONVITE })
    expect(resposta.status).toBe(400)
    expect(await resposta.json()).toEqual({ codigo: 'pedido-invalido', erro: 'Falta o campo "senha" (texto).' })
  })

  it('e-mail repetido, mesmo com outras maiúsculas, dá 409 email-em-uso', async () => {
    await cadastrarCom(valido)
    const resposta = await cadastrarCom({ ...valido, email: 'ANA@exemplo.COM', senha: 'outra-senha-9' })
    expect(resposta.status).toBe(409)
    expect((await erroDe(resposta)).codigo).toBe('email-em-uso')
    expect(cookieDe(resposta)).toBeNull()
    expect((await amb.pg.query('SELECT 1 FROM usuarios')).rows).toHaveLength(1)
  })
})
