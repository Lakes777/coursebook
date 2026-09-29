import { describe, expect, it } from 'vitest'
import { LIMITES } from '../../src/api/contrato'
import { campoDoErro, erroConta, textoSituacao } from '../../src/nuvem/formularios'

const IDS = { email: 'e', senha: 's', convite: 'c' }
const form = (campos: Partial<{ email: string; senha: string; convite: string }> = {}) => ({
  email: 'andre@exemplo.com',
  senha: 'senha-certa',
  convite: 'convite',
  ...campos,
})

describe('erroConta', () => {
  it('aceita um formulário certo', () => {
    expect(erroConta(form(), IDS, true)).toBeNull()
    expect(erroConta(form({ convite: '' }), IDS, false)).toBeNull()
  })

  it.each([
    [{ email: '  ' }, 'e', 'Informe o e-mail.'],
    [{ email: 'andre' }, 'e', /e-mail válido/],
    [{ email: 'an dre@x.com' }, 'e', /e-mail válido/],
    [{ email: `${'a'.repeat(250)}@x.com` }, 'e', /no máximo 254/],
    [{ senha: '' }, 's', 'Informe a senha.'],
    [{ senha: 'x'.repeat(LIMITES.senhaMaxima + 1) }, 's', /no máximo 200/],
  ])('%o: erro no campo certo', (campos, campo, mensagem) => {
    const erro = erroConta(form(campos), IDS, false)
    expect(erro?.campo).toBe(campo)
    expect(erro?.mensagem).toMatch(mensagem)
  })

  it('no cadastro, exige o tamanho mínimo da senha e o convite', () => {
    expect(erroConta(form({ senha: '1234567' }), IDS, true)).toEqual({
      campo: 's',
      mensagem: 'A senha precisa ter pelo menos 8 caracteres.',
    })
    // Para entrar, uma senha curta vai para a API (que diz "e-mail ou senha errados").
    expect(erroConta(form({ senha: '1234567' }), IDS, false)).toBeNull()
    const semConvite = erroConta(form({ convite: ' ' }), IDS, true)
    expect(semConvite).toEqual({ campo: 'c', mensagem: 'Informe o código de convite.' })
  })
})

describe('campoDoErro', () => {
  it('liga cada erro da API ao campo a que ele se refere', () => {
    expect(campoDoErro('credenciais')).toBe('senha')
    expect(campoDoErro('email-em-uso')).toBe('email')
    expect(campoDoErro('pedido-invalido')).toBe('email')
    expect(campoDoErro('convite-invalido')).toBe('convite')
    expect(campoDoErro('bloqueado')).toBeNull()
    expect(campoDoErro('sem-conexao')).toBeNull()
  })
})

describe('textoSituacao', () => {
  it('põe a mensagem da API no erro', () => {
    expect(textoSituacao({ tipo: 'erro', mensagem: 'Erro no servidor.' })).toMatch(/^Não deu para sincronizar: Erro no/)
  })
})
