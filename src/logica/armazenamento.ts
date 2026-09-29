import { REGRA_PUCPR, VERSAO_ATUAL, type Dados } from './tipos'
import { validarDados, type Resultado } from './validacao'

// Guarda os dados no localStorage do navegador. Os testes passam um falso
// (Pick<Storage, ...>); sem ele, vale o localStorage de verdade.

export const CHAVE = 'painel-estudos:dados'
/** Dados que não deu para ler são guardados em "painel-estudos:copia-<data e hora>". */
export const PREFIXO_COPIA = 'painel-estudos:copia-'

type Armazenamento = Pick<Storage, 'getItem' | 'setItem'>
type Migracao = (dados: Record<string, unknown>) => Record<string, unknown>

/**
 * MIGRACOES[n] leva os dados da versão n para a n + 1. Ao mudar o formato de
 * tipos.ts: aumentar VERSAO_ATUAL (lá mesmo; validacao.ts passa a exigir a versão
 * nova) e escrever a migração da versão anterior aqui, com teste, para quem já
 * tem dados salvos não perder nada.
 */
export const MIGRACOES: Record<number, Migracao> = {}

export interface Carregamento {
  dados: Dados
  /** Mensagem para mostrar na tela quando algo deu errado ao carregar. */
  aviso: string | null
  /** false quando salvar poderia apagar dados que não foram lidos nem copiados. */
  podeSalvar: boolean
}

export function dadosVazios(): Dados {
  return { versao: VERSAO_ATUAL, materias: [], eventos: [], regraPadrao: structuredClone(REGRA_PUCPR) }
}

/** Leva dados de uma versão antiga até a atual. */
export function migrar(
  bruto: unknown,
  migracoes: Record<number, Migracao> = MIGRACOES,
  versaoAtual: number = VERSAO_ATUAL,
): Resultado<unknown> {
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) {
    return { ok: false, erro: 'O arquivo não tem os dados do painel.' }
  }
  let dados = bruto as Record<string, unknown>
  const versao = dados.versao
  if (typeof versao !== 'number' || !Number.isInteger(versao) || versao < 1) {
    return { ok: false, erro: 'O arquivo não diz a versão dos dados (campo "versao").' }
  }
  if (versao > versaoAtual) {
    return {
      ok: false,
      erro: `Os dados são da versão ${versao}, de um painel mais novo que este (versão ${versaoAtual}).`,
    }
  }
  for (let v = versao; v < versaoAtual; v++) {
    const migracao = migracoes[v]
    if (!migracao) return { ok: false, erro: `Não sei atualizar dados da versão ${v}.` }
    try {
      dados = { ...migracao(dados), versao: v + 1 }
    } catch {
      // Dado antigo estranho demais para a migração: melhor recusar (e copiar) do que quebrar a tela.
      return { ok: false, erro: `Não deu para atualizar os dados da versão ${v}.` }
    }
  }
  return { ok: true, valor: dados }
}

/** Texto em JSON -> dados conferidos na versão atual. Serve também para importar. */
export function lerDados(texto: string): Resultado<Dados> {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return { ok: false, erro: 'O texto não é um JSON válido.' }
  }
  const migrado = migrar(bruto)
  return migrado.ok ? validarDados(migrado.valor) : migrado
}

/**
 * Lê os dados salvos. Chame uma vez só, fora dos componentes: ela pode gravar
 * (a cópia do que não leu), e o React chama inicializadores duas vezes no StrictMode.
 */
export function carregar(armazenamento?: Armazenamento, agora = new Date()): Carregamento {
  let texto: string | null
  // Com cookies bloqueados, o Chrome dá erro já ao acessar window.localStorage.
  let nav: Armazenamento
  try {
    nav = armazenamento ?? localStorage
    texto = nav.getItem(CHAVE)
  } catch {
    return {
      dados: dadosVazios(),
      aviso: 'O navegador não deixou ler os dados salvos (modo anônimo ou bloqueio de cookies?). Nada será salvo.',
      podeSalvar: false,
    }
  }
  if (texto === null) return { dados: dadosVazios(), aviso: null, podeSalvar: true }

  const lido = lerDados(texto)
  if (lido.ok) return { dados: lido.valor, aviso: null, podeSalvar: true }

  // O erro vai entre parênteses no meio da frase, então sem o ponto final dele.
  const motivo = lido.erro.replace(/\.$/, '')
  // Nunca apaga o que não conseguiu ler: primeiro guarda uma cópia.
  const chave = PREFIXO_COPIA + agora.toISOString()
  try {
    nav.setItem(chave, texto)
  } catch {
    return {
      dados: dadosVazios(),
      aviso: `Não deu para ler os dados salvos (${motivo}) nem guardar uma cópia deles. Para não apagá-los, nada será salvo.`,
      podeSalvar: false,
    }
  }
  // Com a cópia feita, grava o painel vazio no lugar, para a próxima visita não copiar de novo.
  const dados = dadosVazios()
  salvar(dados, nav)
  return {
    dados,
    aviso: `Não deu para ler os dados salvos (${motivo}). Uma cópia foi guardada no navegador com o nome "${chave}", e o painel começou vazio.`,
    podeSalvar: true,
  }
}

/**
 * Relê os dados que outra aba acabou de salvar. Ao contrário de carregar(), nunca
 * grava: o que não der para ler (ex.: salvo por uma versão mais nova do site, aberta
 * na outra aba) volta como null, e quem chamou decide o que fazer.
 * Sem nada salvo (a outra aba limpou os dados do site), é um painel vazio, como seria ao recarregar.
 */
export function releer(armazenamento?: Armazenamento): Dados | null {
  let texto: string | null
  try {
    texto = (armazenamento ?? localStorage).getItem(CHAVE)
  } catch {
    return null
  }
  if (texto === null) return dadosVazios()
  const lido = lerDados(texto)
  return lido.ok ? lido.valor : null
}

/** Salva os dados. Devolve null se deu certo, ou a mensagem de erro. */
export function salvar(dados: Dados, armazenamento?: Armazenamento): string | null {
  try {
    const nav = armazenamento ?? localStorage
    nav.setItem(CHAVE, JSON.stringify(dados))
    return null
  } catch {
    return 'Não deu para salvar no navegador (sem espaço ou bloqueado). Exporte seus dados em JSON para não perdê-los.'
  }
}
