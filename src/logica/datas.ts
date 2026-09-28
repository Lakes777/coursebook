import type { DataISO } from './tipos'

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Transforma "AAAA-MM-DD" numa data à meia-noite do horário LOCAL.
 * Cuidado: new Date("2026-10-05") lê a data como UTC, e no Brasil (UTC-3)
 * ela vira 04/10 às 21h. Por isso a data é montada pelas partes.
 * Devolve null se o texto não for uma data que existe (ex.: "2026-02-30").
 */
export function lerData(texto: DataISO): Date | null {
  const partes = FORMATO.exec(texto)
  if (!partes) return null
  const [ano, mes, dia] = partes.slice(1).map(Number)
  const data = new Date(ano, mes - 1, dia)
  // O Date "conserta" datas inválidas (30/02 vira 02/03); se mudou, era inválida.
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return null
  }
  return data
}

export function dataValida(texto: string): boolean {
  return lerData(texto) !== null
}

/** Data (no horário local) -> "AAAA-MM-DD". */
export function paraDataISO(data: Date): DataISO {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

/**
 * Quantos dias de calendário faltam de `hoje` até `data` (negativo se já passou).
 * Usa só dia/mês/ano, então a hora do `hoje` não importa: às 23h59, amanhã ainda é 1.
 */
export function diasAte(data: DataISO, hoje: Date): number {
  const alvo = lerData(data)
  if (!alvo) throw new Error(`Data inválida: ${data}`)
  // Date.UTC não tem horário de verão, então a divisão por 1 dia é sempre exata.
  const utcAlvo = Date.UTC(alvo.getFullYear(), alvo.getMonth(), alvo.getDate())
  const utcHoje = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((utcAlvo - utcHoje) / 86_400_000)
}

/** "2026-10-05" -> "05/10/2026". */
export function formatarData(data: DataISO): string {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}
