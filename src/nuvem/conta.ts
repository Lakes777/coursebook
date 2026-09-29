// O que este aparelho guarda sobre a conta da nuvem, ao lado dos dados do painel.
// Sem esta chave o painel está sem conta, e nada da nuvem acontece (nenhuma chamada à API).

export const CHAVE_NUVEM = 'painel-estudos:nuvem'
/** Tudo o que o painel guarda no navegador começa com isto (o "Sair e apagar" limpa tudo). */
export const PREFIXO_PAINEL = 'painel-estudos:'

export interface ContaGuardada {
  email: string
  /** A última revisão da nuvem que este aparelho baixou ou salvou (0 se nunca). */
  revisao: number
  /** Há mudança feita aqui que ainda não foi para a nuvem. */
  pendente: boolean
  /**
   * Acabou de entrar e ainda não decidiu o que fazer com os dados que já estavam no
   * aparelho (ver "Primeira vez que entra" em docs/nuvem.md). Fica guardado para um
   * recarregar no meio não tratar os dados do aparelho como se já tivessem vindo da nuvem.
   */
  primeiraVez?: true
}

export type ArmazenamentoNuvem = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

/** A conta guardada, ou null quando não há ou não dá para ler (melhor sem conta do que com a conta errada). */
export function lerConta(armazenamento: ArmazenamentoNuvem): ContaGuardada | null {
  let bruto: unknown
  try {
    const texto = armazenamento.getItem(CHAVE_NUVEM)
    if (texto === null) return null
    bruto = JSON.parse(texto)
  } catch {
    return null
  }
  if (typeof bruto !== 'object' || bruto === null) return null
  const { email, revisao, pendente, primeiraVez } = bruto as Record<string, unknown>
  if (typeof email !== 'string' || email === '') return null
  if (typeof revisao !== 'number' || !Number.isInteger(revisao) || revisao < 0) return null
  if (typeof pendente !== 'boolean') return null
  return { email, revisao, pendente, ...(primeiraVez === true ? { primeiraVez: true } : {}) }
}

/** Grava a conta (ou apaga, com null). Um navegador que não deixa gravar só perde a sincronização entre recargas. */
export function gravarConta(armazenamento: ArmazenamentoNuvem, conta: ContaGuardada | null): void {
  try {
    if (conta) armazenamento.setItem(CHAVE_NUVEM, JSON.stringify(conta))
    else armazenamento.removeItem(CHAVE_NUVEM)
  } catch {
    // Sem espaço ou bloqueado: a conta continua valendo na memória desta aba.
  }
}

/** Apaga tudo o que o painel guardou neste navegador (dados, cópias e conta): computador emprestado. */
export function apagarDoAparelho(armazenamento: ArmazenamentoNuvem): void {
  try {
    const chaves: string[] = []
    for (let i = 0; i < armazenamento.length; i++) {
      const chave = armazenamento.key(i)
      if (chave?.startsWith(PREFIXO_PAINEL)) chaves.push(chave)
    }
    // Junta antes e apaga depois: apagar muda os índices de key().
    for (const chave of chaves) armazenamento.removeItem(chave)
  } catch {
    // Bloqueado: não havia o que apagar.
  }
}

/** Mesmo e-mail, sem diferenciar maiúsculas (como a API compara). */
export const mesmoEmail = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
