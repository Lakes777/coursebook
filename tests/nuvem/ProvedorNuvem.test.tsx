import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePainel } from '../../src/estado/contexto'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { CHAVE, dadosVazios } from '../../src/logica/armazenamento'
import type { Dados } from '../../src/logica/tipos'
import { CHAVE_NUVEM, lerConta, type ContaGuardada } from '../../src/nuvem/conta'
import { useNuvem } from '../../src/nuvem/contexto'
import { ProvedorNuvem } from '../../src/nuvem/ProvedorNuvem'
import { ESPERA_ENVIO_MS } from '../../src/nuvem/sincronizador'
import { comMaterias, materia, navegador, NuvemFalsa } from './apoio'

interface Montagem {
  dados?: Dados
  conta?: ContaGuardada
  nuvem?: NuvemFalsa
  podeSalvar?: boolean
  reactStrictMode?: boolean
}

function montar(m: Montagem) {
  const { dados = dadosVazios(), conta, nuvem = new NuvemFalsa(), podeSalvar = true, reactStrictMode } = m
  const nav = navegador(conta ? { [CHAVE_NUVEM]: JSON.stringify(conta) } : {})
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ProvedorPainel inicial={{ dados, aviso: null, podeSalvar }} armazenamento={nav}>
      <ProvedorNuvem cliente={nuvem} armazenamento={nav}>
        {children}
      </ProvedorNuvem>
    </ProvedorPainel>
  )
  const r = renderHook(() => ({ painel: usePainel(), nuvem: useNuvem()! }), { wrapper, reactStrictMode })
  return { ...r, nav, nuvem }
}

const conta = (campos: Partial<ContaGuardada> = {}): ContaGuardada => ({
  email: 'andre@exemplo.com',
  revisao: 0,
  pendente: false,
  ...campos,
})

/** Deixa as chamadas da API (promessas) terminarem. */
const esperar = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms))

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ProvedorNuvem', () => {
  it('sem conta, nada muda: nenhuma chamada à API, nem ao abrir nem ao mudar os dados', async () => {
    const { result, nuvem } = montar({})
    act(() => result.current.painel.despachar({ tipo: 'materia/adicionar', materia: materia('poo') }))
    await esperar(ESPERA_ENVIO_MS * 2)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await esperar()
    expect(nuvem.chamadas).toEqual([])
    expect(result.current.nuvem.conta).toBeNull()
  })

  it('confere ao abrir e envia 2 s depois de uma mudança', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.dados = dadosVazios()
    nuvem.revisao = 1
    const { result, nav } = montar({ conta: conta({ revisao: 1 }), nuvem })
    expect(result.current.nuvem.situacao.tipo).toBe('conferindo')
    await esperar()
    expect(nuvem.chamadas).toEqual(['eu', 'baixar'])
    expect(result.current.nuvem.situacao.tipo).toBe('sincronizado')

    act(() => result.current.painel.despachar({ tipo: 'materia/adicionar', materia: materia('poo') }))
    expect(result.current.nuvem.situacao.tipo).toBe('salvando')
    expect(lerConta(nav)?.pendente).toBe(true)
    await esperar(ESPERA_ENVIO_MS)
    expect(nuvem.salvos).toEqual([{ dados: comMaterias('poo'), revisao: 1 }])
    expect(result.current.nuvem.situacao.tipo).toBe('sincronizado')
  })

  it('no StrictMode, confere uma vez só depois de montar e envia uma vez por mudança', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.dados = dadosVazios()
    const { result } = montar({ conta: conta(), nuvem, reactStrictMode: true })
    await esperar()
    expect(nuvem.chamadas.filter((c) => c === 'baixar')).toHaveLength(1)
    act(() => result.current.painel.despachar({ tipo: 'materia/adicionar', materia: materia('poo') }))
    await esperar(ESPERA_ENVIO_MS)
    expect(nuvem.salvos).toHaveLength(1)
  })

  it('troca pelos dados da nuvem sem reenviá-los', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.dados = comMaterias('Cálculo')
    nuvem.revisao = 3
    const { result, nav } = montar({ conta: conta({ revisao: 1 }), nuvem })
    await esperar(ESPERA_ENVIO_MS * 2)
    expect(result.current.painel.dados).toEqual(comMaterias('Cálculo'))
    // O ProvedorPainel gravou no aparelho, como sempre.
    expect(JSON.parse(nav.itens.get(CHAVE)!)).toEqual(comMaterias('Cálculo'))
    expect(nuvem.salvos).toEqual([])
    // Veio de fora: não dá para "desfazer" o que outro aparelho fez.
    expect(result.current.painel.desfazer).toBeNull()
  })

  it('o que outra aba salvou não é reenviado por esta (a outra envia)', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.dados = dadosVazios()
    const { result, nav } = montar({ conta: conta(), nuvem })
    await esperar()
    nav.itens.set(CHAVE, JSON.stringify(comMaterias('POO')))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: CHAVE }))
    })
    expect(result.current.painel.dados).toEqual(comMaterias('POO'))
    await esperar(ESPERA_ENVIO_MS * 2)
    expect(nuvem.salvos).toEqual([])
  })

  it('a chave da nuvem também passa de uma aba para a outra', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.dados = dadosVazios()
    const { result, nav } = montar({ conta: conta(), nuvem })
    await esperar()
    nav.itens.set(CHAVE_NUVEM, JSON.stringify(conta({ revisao: 4 })))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: CHAVE_NUVEM }))
    })
    expect(result.current.nuvem.conta).toEqual(conta({ revisao: 4 }))

    nav.itens.delete(CHAVE_NUVEM)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: CHAVE_NUVEM }))
    })
    expect(result.current.nuvem.conta).toBeNull()
  })

  it('confere de novo ao voltar a internet e ao voltar para a aba', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.dados = dadosVazios()
    nuvem.online = false
    const { result } = montar({ conta: conta({ pendente: true }), dados: comMaterias('POO'), nuvem })
    await esperar()
    expect(result.current.nuvem.situacao.tipo).toBe('sem-conexao')

    nuvem.online = true
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await esperar()
    expect(nuvem.salvos).toEqual([{ dados: comMaterias('POO'), revisao: 0 }])

    nuvem.outroAparelhoSalvou(comMaterias('POO', 'BD'))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await esperar()
    expect(result.current.painel.dados).toEqual(comMaterias('POO', 'BD'))
  })

  it('"Usar a da nuvem" pode ser desfeito, e desfazer envia a versão deste aparelho', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.dados = comMaterias('Cálculo')
    nuvem.revisao = 5
    const { result } = montar({ conta: conta({ revisao: 2, pendente: true }), dados: comMaterias('POO'), nuvem })
    await esperar()
    expect(result.current.nuvem.situacao.tipo).toBe('conflito')

    act(() => result.current.nuvem.resolver('nuvem'))
    expect(result.current.painel.dados).toEqual(comMaterias('Cálculo'))
    expect(result.current.painel.desfazer?.texto).toBe('Dados do painel substituídos.')
    await esperar(ESPERA_ENVIO_MS)
    expect(nuvem.salvos).toEqual([])

    act(() => result.current.painel.aoDesfazer())
    expect(result.current.painel.dados).toEqual(comMaterias('POO'))
    await esperar(ESPERA_ENVIO_MS)
    expect(nuvem.salvos).toEqual([{ dados: comMaterias('POO'), revisao: 5 }])
  })

  it('desfazer uma mudança feita nos dados que vieram da nuvem volta a enviar (regressão)', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.dados = comMaterias('A', 'B')
    nuvem.revisao = 3
    const { result } = montar({ conta: conta({ revisao: 1 }), nuvem })
    await esperar()
    expect(result.current.painel.dados).toEqual(comMaterias('A', 'B'))

    act(() => result.current.painel.despachar({ tipo: 'materia/remover', materiaId: 'B' }))
    await esperar(ESPERA_ENVIO_MS)
    expect(nuvem.dados).toEqual(comMaterias('A'))

    // O Desfazer devolve o mesmo objeto que veio da nuvem: mesmo assim é uma mudança daqui.
    act(() => result.current.painel.aoDesfazer())
    expect(result.current.nuvem.situacao.tipo).toBe('salvando')
    await esperar(ESPERA_ENVIO_MS)
    expect(nuvem.dados).toEqual(comMaterias('A', 'B'))
    expect(result.current.nuvem.situacao.tipo).toBe('sincronizado')
  })

  it('com podeSalvar false, não envia nem troca os dados', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.dados = comMaterias('Cálculo')
    nuvem.revisao = 5
    const { result } = montar({ conta: conta(), nuvem, podeSalvar: false })
    await esperar()
    act(() => result.current.painel.despachar({ tipo: 'materia/adicionar', materia: materia('poo') }))
    await esperar(ESPERA_ENVIO_MS)
    expect(nuvem.chamadas).toEqual([])
    expect(result.current.painel.dados).toEqual(comMaterias('poo'))
    expect(result.current.nuvem.situacao.tipo).toBe('parado')
  })

  it('"Sair e apagar" limpa o que o painel guardou e esvazia a tela, sem desfazer', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.dados = comMaterias('POO')
    const { result, nav } = montar({ conta: conta(), dados: comMaterias('POO'), nuvem })
    await esperar()
    nav.itens.set('painel-estudos:copia-x', '{}')
    await act(async () => {
      expect(await result.current.nuvem.sair(true)).toBeNull()
    })
    expect(result.current.nuvem.conta).toBeNull()
    expect(result.current.painel.dados).toEqual(dadosVazios())
    expect(result.current.painel.desfazer).toBeNull()
    expect(nav.itens.has(CHAVE_NUVEM)).toBe(false)
    expect(nav.itens.has('painel-estudos:copia-x')).toBe(false)
  })

  it('sair sem conexão não esquece a conta (o cookie ainda valeria)', async () => {
    const nuvem = new NuvemFalsa()
    nuvem.dados = dadosVazios()
    const { result } = montar({ conta: conta(), nuvem })
    await esperar()
    nuvem.online = false
    await act(async () => {
      expect(await result.current.nuvem.sair(false)).toMatchObject({ codigo: 'sem-conexao' })
    })
    expect(result.current.nuvem.conta).not.toBeNull()
  })
})
