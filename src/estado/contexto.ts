import { createContext, useContext, type Dispatch } from 'react'
import type { Dados } from '../logica/tipos'
import type { Acao } from './acoes'

export interface Painel {
  dados: Dados
  despachar: Dispatch<Acao>
  /** Aviso do carregamento (dados que não deu para ler), até a pessoa fechar. */
  aviso: string | null
  fecharAviso: () => void
  /** Erro do último salvamento (sem espaço ou bloqueado), ou null. */
  erroAoSalvar: string | null
  /**
   * false quando salvar poderia apagar dados: os que não foram lidos nem copiados,
   * ou os que outra aba acabou de gravar.
   */
  podeSalvar: boolean
  /** Outra aba do painel salvou dados: esta parou de salvar e precisa ser recarregada. */
  mudouEmOutraAba: boolean
}

export const ContextoPainel = createContext<Painel | null>(null)

/** Dados e ações do painel. Só funciona dentro do <ProvedorPainel>. */
export function usePainel(): Painel {
  const painel = useContext(ContextoPainel)
  if (!painel) throw new Error('usePainel() precisa estar dentro do <ProvedorPainel>.')
  return painel
}
