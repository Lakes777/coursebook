/**
 * Id novo e único. O crypto.randomUUID só existe em HTTPS ou em localhost; aberto
 * pelo IP da rede (ex.: `vite --host` no celular) ele falta, então monta um com a
 * hora e números aleatórios.
 */
export function novoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
