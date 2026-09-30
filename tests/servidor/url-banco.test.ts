// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { urlDoBanco } from '../../servidor/url-banco'

const URL_NEON =
  'postgresql://dono:s3nh%40@ep-x-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

describe('urlDoBanco', () => {
  it('sem nome, devolve a URL como veio', () => {
    expect(urlDoBanco(URL_NEON)).toBe(URL_NEON)
    expect(urlDoBanco(URL_NEON, '')).toBe(URL_NEON)
    expect(urlDoBanco(URL_NEON, '   ')).toBe(URL_NEON)
  })

  it('troca só o nome do banco, mantendo usuário, senha, servidor e opções', () => {
    const nova = new URL(urlDoBanco(URL_NEON, 'painel_estudos'))
    expect(nova.pathname).toBe('/painel_estudos')
    expect(nova.username).toBe('dono')
    expect(nova.password).toBe('s3nh%40')
    expect(nova.host).toBe('ep-x-pooler.us-east-1.aws.neon.tech')
    expect(nova.searchParams.get('sslmode')).toBe('require')
    expect(nova.searchParams.get('channel_binding')).toBe('require')
  })

  it('funciona com URL sem banco no fim e ignora espaços no nome', () => {
    const semBanco = 'postgresql://dono:x@servidor.neon.tech?sslmode=require'
    expect(new URL(urlDoBanco(semBanco, ' painel_estudos ')).pathname).toBe('/painel_estudos')
  })
})
