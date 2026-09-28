import { dataValida, diasAte } from './datas'
import type { Evento, TipoEvento } from './tipos'

/** Quantos dias à frente contam como "próximo" por padrão. */
export const DIAS_PROXIMO = 7
export const TAMANHO_MAXIMO_TITULO = 100

export const TIPOS_EVENTO: readonly TipoEvento[] = ['prova', 'trabalho', 'apresentacao']

export const NOMES_TIPO: Record<TipoEvento, string> = {
  prova: 'Prova',
  trabalho: 'Trabalho',
  apresentacao: 'Apresentação',
}

export type Destaque =
  /** Já passou e não foi marcado como feito. */
  | 'atrasado'
  | 'hoje'
  /** Nos próximos dias (até `diasProximo`). */
  | 'proximo'
  | 'futuro'
  | 'concluido'

export type EventoNaAgenda = Evento & {
  /** Dias de hoje até o evento (negativo se já passou). */
  dias: number
  destaque: Destaque
}

function destaqueDe(evento: Evento, dias: number, diasProximo: number): Destaque {
  if (evento.concluido) return 'concluido'
  if (dias < 0) return 'atrasado'
  if (dias === 0) return 'hoje'
  if (dias <= diasProximo) return 'proximo'
  return 'futuro'
}

/**
 * Agenda de provas, trabalhos e apresentações: primeiro o que falta fazer, do mais
 * antigo (atrasado) para o mais distante; depois os concluídos, do mais recente para
 * o mais antigo. No mesmo dia, ordena pelo título. Não altera a lista recebida.
 * Só recebe eventos válidos (veja `erroEvento`): o carregamento e a importação dos
 * dados validam antes, e uma data inválida aqui lança erro em vez de sumir calada.
 */
export function agenda(
  eventos: Evento[],
  hoje: Date,
  diasProximo = DIAS_PROXIMO,
): EventoNaAgenda[] {
  const comDias = eventos.map((evento) => {
    const dias = diasAte(evento.data, hoje)
    return { ...evento, dias, destaque: destaqueDe(evento, dias, diasProximo) }
  })
  const porTitulo = (a: EventoNaAgenda, b: EventoNaAgenda) =>
    a.titulo.localeCompare(b.titulo, 'pt-BR')
  const pendentes = comDias
    .filter((e) => !e.concluido)
    .sort((a, b) => a.dias - b.dias || porTitulo(a, b))
  const concluidos = comDias
    .filter((e) => e.concluido)
    .sort((a, b) => b.dias - a.dias || porTitulo(a, b))
  return [...pendentes, ...concluidos]
}

/** Texto curto do prazo: "hoje", "amanhã", "em 3 dias", "ontem", "há 2 dias". */
export function textoPrazo(dias: number): string {
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  if (dias === -1) return 'ontem'
  if (dias > 1) return `em ${dias} dias`
  return `há ${-dias} dias`
}

/** Diz o que está errado num evento, ou null se ele está certo. */
export function erroEvento(evento: Pick<Evento, 'titulo' | 'tipo' | 'data'>): string | null {
  const titulo = evento.titulo.trim()
  if (titulo === '') return 'Dê um título (ex.: "Prova do RA1").'
  if (titulo.length > TAMANHO_MAXIMO_TITULO) {
    return `O título pode ter no máximo ${TAMANHO_MAXIMO_TITULO} caracteres.`
  }
  if (!TIPOS_EVENTO.includes(evento.tipo)) return 'Escolha se é prova, trabalho ou apresentação.'
  if (!dataValida(evento.data)) return 'Informe uma data válida.'
  return null
}
