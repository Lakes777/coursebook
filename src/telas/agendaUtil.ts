import { erroEvento, type EventoNaAgenda } from '../logica/eventos'
import type { Evento } from '../logica/tipos'

/**
 * Texto do selo de cada item. O que está longe (futuro) não ganha selo: a data e o
 * "em 20 dias" ao lado já dizem tudo, e um selo em cada linha tiraria a força dos outros.
 */
export function textoSelo(item: Pick<EventoNaAgenda, 'destaque' | 'dias'>): string | null {
  switch (item.destaque) {
    case 'atrasado':
      return 'Atrasado'
    case 'hoje':
      return 'Hoje'
    case 'proximo':
      return item.dias === 1 ? 'Amanhã' : `Em ${item.dias} dias`
    case 'concluido':
      return 'Concluído'
    case 'futuro':
      return null
  }
}

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
