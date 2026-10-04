import { createContext, useContext } from 'react'
import type {
  PedidoCadastro,
  PedidoCriarChave,
  PedidoEntrar,
  PedidoExcluirConta,
  RespostaChaveCriada,
  RespostaChaves,
  RespostaErro,
  Resposta,
} from '../api/contrato'
import type { EstadoNuvem } from './sincronizador'

export interface Nuvem extends EstadoNuvem {
  // As ações devolvem o erro da API (para a tela mostrar no campo certo), ou null se deu certo.
  entrar(pedido: PedidoEntrar): Promise<RespostaErro | null>
  cadastrar(pedido: PedidoCadastro): Promise<RespostaErro | null>
  /** Sai da conta; com `apagarDados`, limpa também tudo o que o painel guardou neste navegador. */
  sair(apagarDados: boolean): Promise<RespostaErro | null>
  excluirConta(pedido: PedidoExcluirConta): Promise<RespostaErro | null>
  /** Resposta à pergunta do conflito (ou da primeira vez). */
  resolver(escolha: 'nuvem' | 'aparelho'): void
  // As chaves de acesso vão direto à API: não mexem nos dados nem na sincronização.
  listarChaves(): Promise<Resposta<RespostaChaves>>
  criarChave(pedido: PedidoCriarChave): Promise<Resposta<RespostaChaveCriada>>
  apagarChave(id: string): Promise<Resposta<null>>
}

export const ContextoNuvem = createContext<Nuvem | null>(null)

/**
 * A conta e a sincronização, ou null fora do <ProvedorNuvem>. Não lança como o
 * usePainel: as telas funcionam sem a nuvem (e os testes delas não precisam dela).
 */
export function useNuvem(): Nuvem | null {
  return useContext(ContextoNuvem)
}
