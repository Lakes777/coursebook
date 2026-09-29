import { describe, expect, it } from 'vitest'
import { CHAVE } from '../../src/logica/armazenamento'
import { apagarDoAparelho, CHAVE_NUVEM, gravarConta, lerConta, mesmoEmail } from '../../src/nuvem/conta'
import { navegador } from './apoio'

describe('conta guardada', () => {
  it('sem a chave, não há conta', () => {
    expect(lerConta(navegador())).toBeNull()
  })

  it('grava, lê e apaga', () => {
    const nav = navegador()
    gravarConta(nav, { email: 'a@b.com', revisao: 3, pendente: true })
    expect(lerConta(nav)).toEqual({ email: 'a@b.com', revisao: 3, pendente: true })
    gravarConta(nav, { email: 'a@b.com', revisao: 0, pendente: false, primeiraVez: true })
    expect(lerConta(nav)).toEqual({ email: 'a@b.com', revisao: 0, pendente: false, primeiraVez: true })
    gravarConta(nav, null)
    expect(nav.itens.has(CHAVE_NUVEM)).toBe(false)
  })

  it.each([
    ['texto que não é JSON', '{quebrado'],
    ['sem e-mail', JSON.stringify({ revisao: 1, pendente: false })],
    ['revisão negativa', JSON.stringify({ email: 'a@b.com', revisao: -1, pendente: false })],
    ['revisão quebrada', JSON.stringify({ email: 'a@b.com', revisao: 1.5, pendente: false })],
    ['pendente que não é booleano', JSON.stringify({ email: 'a@b.com', revisao: 1, pendente: 'sim' })],
    ['uma lista', '[]'],
  ])('o que não dá para ler conta como sem conta: %s', (_, texto) => {
    expect(lerConta(navegador({ [CHAVE_NUVEM]: texto }))).toBeNull()
  })

  it('navegador que não deixa ler nem gravar não quebra', () => {
    const nav = navegador()
    nav.getItem = () => {
      throw new DOMException('bloqueado', 'SecurityError')
    }
    nav.setItem = nav.getItem
    expect(lerConta(nav)).toBeNull()
    expect(() => gravarConta(nav, { email: 'a@b.com', revisao: 0, pendente: false })).not.toThrow()
  })

  it('"Sair e apagar" leva tudo o que é do painel, e só isso', () => {
    const nav = navegador({
      [CHAVE]: '{}',
      [CHAVE_NUVEM]: '{}',
      'painel-estudos:copia-2026-09-29T10:00:00.000Z': '{}',
      'outro-site': 'fica',
    })
    apagarDoAparelho(nav)
    expect([...nav.itens.keys()]).toEqual(['outro-site'])
  })

  it('compara e-mails sem diferenciar maiúsculas', () => {
    expect(mesmoEmail('Andre@Exemplo.com', 'andre@exemplo.com')).toBe(true)
    expect(mesmoEmail('a@b.com', 'c@b.com')).toBe(false)
  })
})
