import { diasAte, lerData, paraDataISO } from './datas'
import { agenda, NOMES_TIPO } from './eventos'
import type { Dados, DataISO, DiaSemana, Materia, TipoEvento } from './tipos'

// Os prazos dos próximos dias, para quem não abre o painel (o bot do Telegram, pela
// rota GET /api/prazos). Sem React e sem servidor: as mesmas peças da agenda.

/** O fuso do "hoje" dos prazos: o servidor da Vercel roda em UTC, e às 22h de Brasília lá já é amanhã. */
export const FUSO_PRAZOS = 'America/Sao_Paulo'

/** Os tipos da agenda, mais as avaliações com data que ainda não têm nota. */
export type TipoPrazo = TipoEvento | 'avaliacao'

export const NOMES_TIPO_PRAZO: Record<TipoPrazo, string> = { ...NOMES_TIPO, avaliacao: 'Avaliação' }

export interface Prazo {
  /** "AAAA-MM-DD". */
  data: DataISO
  /** Dias de hoje até a data: 0 = hoje, 1 = amanhã. */
  diasRestantes: number
  tipo: TipoPrazo
  /** O tipo pronto para mostrar ("Prova", "Avaliação"...). */
  tipoNome: string
  titulo: string
  /** Nome da matéria, ou null (evento da agenda sem matéria). */
  materia: string | null
  /**
   * Início ("HH:MM") da primeira aula da matéria no dia da semana do prazo, ou null.
   * O painel não guarda a hora das provas: esta é a hora em que a turma se encontra.
   */
  horaAula: string | null
}

/** A data de hoje ("AAAA-MM-DD") no fuso dado, qualquer que seja o fuso do computador. */
export function hojeNoFuso(agora: Date, fuso = FUSO_PRAZOS): DataISO {
  // en-CA escreve as datas como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    agora,
  )
}

function horaDaAula(materia: Materia | undefined, data: DataISO): string | null {
  const dia = lerData(data)?.getDay() as DiaSemana | undefined
  if (!materia || dia === undefined) return null
  const inicios = materia.horarios.filter((h) => h.dia === dia).map((h) => h.inicio)
  return inicios.length === 0 ? null : inicios.sort()[0]
}

/** "2026-10-04" + 7 -> "2026-10-11". */
export function somarDias(data: DataISO, dias: number): DataISO {
  const d = lerData(data)
  if (!d) throw new Error(`Data inválida: ${data}`)
  return paraDataISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias))
}

/**
 * O que falta fazer de `hoje` até `hoje + dias` (os dois dias entram), em ordem de
 * data, depois matéria e título. Entram:
 * - os eventos da agenda (provas, trabalhos, apresentações) não concluídos;
 * - as avaliações das matérias com data e sem nota, menos as que já têm um evento não
 *   concluído da mesma matéria no mesmo dia: aí o aviso vem pela agenda, uma vez só.
 * Atrasados (antes de hoje) ficam de fora: o aviso é do que vem pela frente.
 */
export function prazos(dados: Dados, hoje: DataISO, dias: number): Prazo[] {
  const dataHoje = lerData(hoje)
  if (!dataHoje) throw new Error(`Data inválida: ${hoje}`)
  const materias = new Map(dados.materias.map((m) => [m.id, m]))
  const naJanela = (n: number) => n >= 0 && n <= dias

  const lista: Prazo[] = []
  for (const evento of agenda(dados.eventos, dataHoje)) {
    if (evento.concluido || !naJanela(evento.dias)) continue
    const materia = evento.materiaId ? materias.get(evento.materiaId) : undefined
    lista.push({
      data: evento.data,
      diasRestantes: evento.dias,
      tipo: evento.tipo,
      tipoNome: NOMES_TIPO_PRAZO[evento.tipo],
      titulo: evento.titulo,
      materia: materia?.nome ?? null,
      horaAula: horaDaAula(materia, evento.data),
    })
  }

  // Só o que ainda falta fazer esconde a avaliação: evento concluído não avisa, e a prova sem nota ainda vem.
  const naAgenda = new Set(dados.eventos.filter((e) => !e.concluido).map((e) => `${e.materiaId ?? ''}|${e.data}`))
  for (const materia of dados.materias) {
    for (const ra of materia.ras) {
      for (const avaliacao of ra.avaliacoes) {
        if (!avaliacao.data || avaliacao.nota !== null) continue
        if (naAgenda.has(`${materia.id}|${avaliacao.data}`)) continue
        const n = diasAte(avaliacao.data, dataHoje)
        if (!naJanela(n)) continue
        lista.push({
          data: avaliacao.data,
          diasRestantes: n,
          tipo: 'avaliacao',
          tipoNome: NOMES_TIPO_PRAZO.avaliacao,
          titulo: `${avaliacao.nome} (${ra.nome})`,
          materia: materia.nome,
          horaAula: horaDaAula(materia, avaliacao.data),
        })
      }
    }
  }

  const texto = (a: string | null, b: string | null) => (a ?? '').localeCompare(b ?? '', 'pt-BR')
  return lista.sort(
    (a, b) => a.diasRestantes - b.diasRestantes || texto(a.materia, b.materia) || texto(a.titulo, b.titulo),
  )
}
