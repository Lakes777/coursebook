import { createContext, useContext, type Dispatch } from 'react'
import type { Dados } from '../logica/tipos'
import type { Acao } from './acoes'

export interface Painel {
  dados: Dados
  despachar: Dispatch<Acao>
  /**
   * O que a última ação apagou ({ texto: "Falta removida." }), enquanto dá para desfazer;
   * senão null. É um objeto novo a cada ação, mesmo com o mesmo texto.
   */
  desfazer: { readonly texto: string } | null
  /** Volta os dados para antes da última ação que apagou algo. */
  aoDesfazer: () => void
  /** Fecha o aviso de desfazer sem voltar nada. */
  esquecerDesfazer: () => void
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
  /**
   * Outra aba salvou dados que esta não consegue ler (ex.: versão mais nova do site):
   * esta parou de salvar e precisa ser recarregada. Dados legíveis são trocados sozinhos.
   */
  mudouEmOutraAba: boolean
}

export const ContextoPainel = createContext<Painel | null>(null)

/** Dados e ações do painel. Só funciona dentro do <ProvedorPainel>. */
export function usePainel(): Painel {
  const painel = useContext(ContextoPainel)
  if (!painel) throw new Error('usePainel() precisa estar dentro do <ProvedorPainel>.')
  return painel
}
