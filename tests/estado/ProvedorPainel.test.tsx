import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'
import { usePainel } from '../../src/estado/contexto'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { CHAVE, dadosVazios, type Carregamento } from '../../src/logica/armazenamento'
import type { Materia } from '../../src/logica/tipos'

/** localStorage falso que conta as gravações; `falhar` pode ser ligado e desligado. */
function navegador(falhar = false) {
  const itens = new Map<string, string>()
  return {
    itens,
    gravacoes: 0,
    falhar,
    getItem: (chave: string) => itens.get(chave) ?? null,
    setItem(chave: string, valor: string) {
      if (this.falhar) throw new DOMException('cheio', 'QuotaExceededError')
      this.gravacoes += 1
      itens.set(chave, valor)
    },
  }
}

const FILOSOFIA: Materia = {
  id: 'filo',
  nome: 'Filosofia',
  professor: '',
  horarios: [],
  cargaHoraria: 80,
  ras: [],
  pontosExtras: [],
  faltas: [],
}

function montar(inicial: Partial<Carregamento> = {}, nav = navegador(), reactStrictMode = false) {
  const carregamento: Carregamento = { dados: dadosVazios(), aviso: null, podeSalvar: true, ...inicial }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ProvedorPainel inicial={carregamento} armazenamento={nav}>
      {children}
    </ProvedorPainel>
  )
  return { nav, carregamento, ...renderHook(() => usePainel(), { wrapper, reactStrictMode }) }
}

/** Simula outra aba gravando: o navegador manda o evento "storage" para esta. */
function outraAbaSalvou(chave: string | null = CHAVE) {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: chave }))
  })
}

function renderApp(inicial: Partial<Carregamento>, nav = navegador()) {
  render(
    <ProvedorPainel inicial={{ dados: dadosVazios(), aviso: null, podeSalvar: true, ...inicial }} armazenamento={nav}>
      <App />
    </ProvedorPainel>,
  )
}

describe('ProvedorPainel', () => {
  it('começa com os dados carregados e não grava à toa', () => {
    const { result, nav } = montar()
    expect(result.current.dados).toEqual(dadosVazios())
    expect(nav.gravacoes).toBe(0)
  })

  it('salva a cada mudança', () => {
    const { result, nav } = montar()
    act(() => result.current.despachar({ tipo: 'materia/adicionar', materia: FILOSOFIA }))
    expect(result.current.dados.materias).toEqual([FILOSOFIA])
    expect(JSON.parse(nav.itens.get(CHAVE)!).materias).toEqual([FILOSOFIA])
    expect(nav.gravacoes).toBe(1)
  })

  it('não grava nada quando podeSalvar é false', () => {
    const { result, nav } = montar({ podeSalvar: false })
    act(() => result.current.despachar({ tipo: 'materia/adicionar', materia: FILOSOFIA }))
    expect(result.current.dados.materias).toHaveLength(1) // a tela muda...
    expect(nav.gravacoes).toBe(0) // ...mas o navegador não
    expect(result.current.podeSalvar).toBe(false)
  })

  it('no StrictMode também não grava ao montar e grava uma vez por mudança', () => {
    const { result, nav } = montar({}, navegador(), true)
    expect(nav.gravacoes).toBe(0)
    act(() => result.current.despachar({ tipo: 'materia/adicionar', materia: FILOSOFIA }))
    expect(nav.gravacoes).toBe(1)
  })

  it('não regrava quando só redesenha', () => {
    const { result, nav, rerender } = montar()
    act(() => result.current.despachar({ tipo: 'materia/adicionar', materia: FILOSOFIA }))
    rerender()
    rerender()
    expect(nav.gravacoes).toBe(1)
  })

  it('grava quando os dados voltam a ser os do começo (desfazer)', () => {
    const { result, nav, carregamento } = montar()
    act(() => result.current.despachar({ tipo: 'materia/adicionar', materia: FILOSOFIA }))
    act(() => result.current.despachar({ tipo: 'dados/substituir', dados: carregamento.dados }))
    expect(nav.gravacoes).toBe(2)
    expect(JSON.parse(nav.itens.get(CHAVE)!).materias).toEqual([])
  })

  it('mostra o erro quando o navegador não deixa salvar, e tira quando volta a dar certo', () => {
    const nav = navegador(true)
    const { result } = montar({}, nav)
    act(() => result.current.despachar({ tipo: 'materia/adicionar', materia: FILOSOFIA }))
    expect(result.current.erroAoSalvar).toMatch(/Não deu para salvar/)
    nav.falhar = false
    act(() => result.current.despachar({ tipo: 'materia/remover', materiaId: 'filo' }))
    expect(result.current.erroAoSalvar).toBeNull()
  })

  it('para de salvar quando outra aba grava, para não apagar o que ela fez', () => {
    const { result, nav } = montar()
    outraAbaSalvou()
    expect(result.current.mudouEmOutraAba).toBe(true)
    expect(result.current.podeSalvar).toBe(false)
    act(() => result.current.despachar({ tipo: 'materia/adicionar', materia: FILOSOFIA }))
    expect(nav.gravacoes).toBe(0)
  })

  it('também para quando outra aba limpa tudo (key null), mas ignora outras chaves', () => {
    const { result } = montar()
    outraAbaSalvou('outra-coisa')
    expect(result.current.mudouEmOutraAba).toBe(false)
    outraAbaSalvou(null)
    expect(result.current.mudouEmOutraAba).toBe(true)
  })

  it('usePainel fora do provedor explica o erro', () => {
    expect(() => renderHook(() => usePainel())).toThrow(/dentro do <ProvedorPainel>/)
  })
})

describe('App com o provedor', () => {
  it('mostra o aviso do carregamento até a pessoa fechar', async () => {
    renderApp({ aviso: 'Não deu para ler os dados salvos.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Não deu para ler os dados salvos.')
    await userEvent.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('continua dizendo que nada é salvo depois que o aviso é fechado', async () => {
    renderApp({ aviso: 'O navegador não deixou ler os dados salvos.', podeSalvar: false })
    await userEvent.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(screen.getByRole('status')).toHaveTextContent('Nada está sendo salvo neste navegador.')
  })

  it('pede para recarregar quando outra aba salvou', () => {
    renderApp({})
    outraAbaSalvou()
    expect(screen.getByRole('status')).toHaveTextContent('alterado em outra aba')
  })

  it('mostra o erro ao salvar', () => {
    function Adicionar() {
      const { despachar } = usePainel()
      return (
        <button type="button" onClick={() => despachar({ tipo: 'materia/adicionar', materia: FILOSOFIA })}>
          Adicionar
        </button>
      )
    }
    render(
      <ProvedorPainel inicial={{ dados: dadosVazios(), aviso: null, podeSalvar: true }} armazenamento={navegador(true)}>
        <App />
        <Adicionar />
      </ProvedorPainel>,
    )
    act(() => screen.getByRole('button', { name: 'Adicionar' }).click())
    expect(screen.getByRole('alert')).toHaveTextContent('Não deu para salvar')
  })
})
