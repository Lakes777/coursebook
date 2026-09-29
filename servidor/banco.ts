import type { Banco } from './contexto'
import { ESQUEMA } from './esquema'

// O driver HTTP do Neon roda um comando por chamada, então o esquema vai comando a
// comando. O corte é no ";" do fim da linha: os comentários do esquema têm ";" no meio.
export const COMANDOS_ESQUEMA = ESQUEMA.split(/;\s*\n/)
  .map((comando) => comando.trim())
  .filter((comando) => comando.replace(/--.*$/gm, '').trim() !== '')

export async function aplicarEsquema(banco: Banco): Promise<void> {
  for (const comando of COMANDOS_ESQUEMA) await banco.consultar(comando)
}

/**
 * Embrulha um banco para aplicar o esquema antes da primeira consulta (uma vez por
 * instância). Se aplicar falhar, a próxima consulta tenta de novo.
 */
export function comEsquema(banco: Banco): Banco {
  let pronto: Promise<void> | null = null
  return {
    async consultar(sql, parametros) {
      pronto ??= aplicarEsquema(banco).catch((erro: unknown) => {
        pronto = null
        throw erro
      })
      await pronto
      return banco.consultar(sql, parametros)
    },
  }
}
