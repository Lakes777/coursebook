import { useSyncExternalStore } from 'react'
import { lerRota, paraHash, type Rota } from './rota'

function assinar(avisar: () => void) {
  window.addEventListener('hashchange', avisar)
  return () => window.removeEventListener('hashchange', avisar)
}

// O hash é "estado de fora do React": useSyncExternalStore lê ele e redesenha
// quando muda (clique num link, botão voltar), sem copiar para um useState.
const lerHash = () => window.location.hash

/** A tela atual, lida do endereço. */
export function useRota(): Rota {
  return lerRota(useSyncExternalStore(assinar, lerHash))
}

/**
 * Vai para outra tela (entra no histórico, então "voltar" funciona). Ir para a
 * tela em que já está não faz nada: o hash não muda e o navegador não avisa.
 */
export function navegar(rota: Rota): void {
  window.location.hash = paraHash(rota)
}
