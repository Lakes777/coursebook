import { erroEvento } from '../logica/eventos'
import type { Evento } from '../logica/tipos'

export type CampoEvento = 'titulo' | 'tipo' | 'data'

/** Um tipo e uma data que sempre passam, para conferir cada campo sozinho. */
const CERTO: Pick<Evento, 'titulo' | 'tipo' | 'data'> = { titulo: 'x', tipo: 'prova', data: '2026-01-01' }

/**
 * O erro do formulário e o campo a que ele pertence, para a mensagem ficar ligada
 * ao campo certo. Confere um campo por vez junto com valores certos nos outros, em
 * vez de ler o texto da mensagem: se o erroEvento mudar as frases, isto continua valendo.
 */
export function erroDoFormulario(
  evento: Pick<Evento, 'titulo' | 'tipo' | 'data'>,
): { campo: CampoEvento; mensagem: string } | null {
  const mensagem = erroEvento(evento)
  if (mensagem === null) return null
  const campos: CampoEvento[] = ['titulo', 'tipo', 'data']
  const campo = campos.find((c) => erroEvento({ ...CERTO, [c]: evento[c] }) !== null) ?? 'titulo'
  return { campo, mensagem }
}
