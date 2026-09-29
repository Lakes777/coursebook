/**
 * Compara dois valores de JSON pelo conteúdo, sem depender da ordem dos campos
 * (JSON.stringify depende: { a, b } e { b, a } dariam textos diferentes).
 * Campo com undefined conta como ausente, igual ao JSON.
 */
export function iguais(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => iguais(item, b[i]))
  }
  const x = a as Record<string, unknown>
  const y = b as Record<string, unknown>
  const chaves = (o: Record<string, unknown>) => Object.keys(o).filter((k) => o[k] !== undefined)
  const cx = chaves(x)
  return cx.length === chaves(y).length && cx.every((k) => iguais(x[k], y[k]))
}
