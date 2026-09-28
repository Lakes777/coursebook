import { lerDados } from './armazenamento'
import { novoId } from './ids'
import { VERSAO_ATUAL, type Dados, type RegraAprovacao } from './tipos'
import type { Resultado } from './validacao'

// Exportar (backup) e importar dados: de um backup do próprio painel ou de um JSON
// feito à mão ou por uma IA a partir do plano de ensino.

/** O backup, legível (com recuo), para quem quiser abrir e conferir. */
export function textoExportacao(dados: Dados): string {
  return `${JSON.stringify(dados, null, 2)}\n`
}

/** "painel-estudos-2026-09-28.json": a data no nome ajuda a achar o backup mais novo. */
export function nomeArquivo(agora: Date): string {
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `painel-estudos-${agora.getFullYear()}-${mes}-${dia}.json`
}

/** Maior arquivo que a importação aceita: um backup de verdade tem poucos KB. */
export const TAMANHO_MAXIMO_IMPORTACAO = 5 * 1024 * 1024

/** Até quantos caracteres vale procurar o JSON no meio do texto (uma resposta de IA tem bem menos). */
const LIMITE_BUSCA = 50_000
/** Quantos trechos testar no máximo: a resposta de uma IA acerta nos primeiros. */
const MAXIMO_TENTATIVAS = 500

function ehJson(texto: string): boolean {
  try {
    JSON.parse(texto)
    return true
  } catch {
    return false
  }
}

/** Posições de um caractere de abertura ou fechamento ({ [ ou } ]), em ordem. */
function posicoes(texto: string, caracteres: string): number[] {
  const achadas: number[] = []
  for (let i = 0; i < texto.length; i++) if (caracteres.includes(texto[i])) achadas.push(i)
  return achadas
}

/**
 * Tira o que as IAs costumam pôr em volta do JSON: o bloco ```json ... ``` e frases
 * antes ou depois dele, que podem ter chaves também ("Atenção: a fórmula cita {RA4}").
 * Sem bloco, procura o maior trecho que é um JSON: começa no primeiro "{" ou "[" e
 * tenta os fechamentos do fim para o começo. Se nada servir, devolve o texto como veio,
 * para o erro de JSON aparecer.
 */
export function extrairJson(texto: string): string {
  const bloco = /```(?:json)?\s*([\s\S]*?)```/i.exec(texto)
  if (bloco) return bloco[1].trim()
  const limpo = texto.trim()
  // A busca abaixo testa muitos trechos: só vale para uma resposta colada, não para um arquivo grande quebrado.
  if (ehJson(limpo) || limpo.length > LIMITE_BUSCA) return limpo
  const fins = posicoes(limpo, '}]').reverse()
  let tentativas = 0
  for (const inicio of posicoes(limpo, '{[')) {
    for (const fim of fins) {
      if (fim <= inicio || ++tentativas > MAXIMO_TENTATIVAS) break
      const trecho = limpo.slice(inicio, fim + 1)
      if (ehJson(trecho)) return trecho
    }
  }
  return limpo
}

/**
 * Completa o que um JSON de IA costuma esquecer: sem "versao", vale a atual; uma
 * matéria sozinha ("materia", no singular, ou solta) ou uma lista de matérias viram
 * { materias: [...] }. Sem "regraPadrao", fica a `regraAtual` (e não a da PUC-PR, que
 * trocaria a regra de quem já usa o painel). Recusa o que não parece dados do painel:
 * um "{}" viraria um painel vazio, e "Substituir tudo" apagaria tudo.
 */
function completar(bruto: unknown, regraAtual?: RegraAprovacao): Resultado<unknown> {
  let objeto: Record<string, unknown>
  if (Array.isArray(bruto)) objeto = { materias: bruto }
  else if (typeof bruto !== 'object' || bruto === null) {
    return { ok: false, erro: 'O JSON não tem os dados do painel (era esperado um objeto { ... }).' }
  } else objeto = bruto as Record<string, unknown>

  if (!('materias' in objeto) && !('eventos' in objeto)) {
    if ('materia' in objeto) objeto = { ...objeto, materias: [objeto.materia] }
    else if ('nome' in objeto) objeto = { materias: [objeto] }
    else {
      return {
        ok: false,
        erro: 'O JSON não tem "materias" nem "eventos", então não parece ter dados do painel.',
      }
    }
    delete objeto.materia
  }
  return {
    ok: true,
    valor: {
      ...objeto,
      versao: objeto.versao ?? VERSAO_ATUAL,
      ...(objeto.regraPadrao === undefined && regraAtual ? { regraPadrao: regraAtual } : {}),
    },
  }
}

/**
 * Lê o texto colado ou o arquivo escolhido, já conferido como os dados salvos.
 * `regraAtual` é a regra padrão de agora, que fica quando o JSON não traz uma.
 */
export function lerImportacao(texto: string, regraAtual?: RegraAprovacao): Resultado<Dados> {
  if (texto.trim() === '') return { ok: false, erro: 'Não há nada para importar.' }
  let bruto: unknown
  try {
    bruto = JSON.parse(extrairJson(texto))
  } catch {
    return { ok: false, erro: 'O texto não é um JSON válido. Confira se copiou a resposta inteira.' }
  }
  const completo = completar(bruto, regraAtual)
  return completo.ok ? lerDados(JSON.stringify(completo.valor)) : completo
}

/**
 * Junta as matérias e os eventos importados aos atuais. Tudo o que chega ganha id
 * novo (e os eventos, o id novo da matéria deles): o JSON de uma IA pode repetir um
 * id que já existe aqui. A regra padrão atual continua valendo.
 */
export function mesclar(atual: Dados, importado: Dados): Dados {
  const idNovo = new Map(importado.materias.map((m) => [m.id, novoId()]))
  return {
    ...atual,
    materias: [...atual.materias, ...importado.materias.map((m) => ({ ...m, id: idNovo.get(m.id)! }))],
    eventos: [
      ...atual.eventos,
      ...importado.eventos.map((e) => {
        const evento = { ...e, id: novoId() }
        if (e.materiaId !== undefined) evento.materiaId = idNovo.get(e.materiaId)!
        return evento
      }),
    ],
  }
}

/** Nomes das matérias importadas que já existem no painel (para avisar antes de juntar). */
export function nomesRepetidos(atual: Dados, importado: Dados): string[] {
  const existentes = new Set(atual.materias.map((m) => m.nome.toLocaleLowerCase('pt-BR')))
  return importado.materias.map((m) => m.nome).filter((n) => existentes.has(n.toLocaleLowerCase('pt-BR')))
}

/** "2 matérias e 3 eventos na agenda". */
export function resumoDados(dados: Pick<Dados, 'materias' | 'eventos'>): string {
  const m = dados.materias.length
  const e = dados.eventos.length
  const materias = m === 1 ? '1 matéria' : `${m} matérias`
  const eventos = e === 1 ? '1 evento na agenda' : `${e} eventos na agenda`
  return `${materias} e ${eventos}`
}

/** Se o painel não tem nada que se perderia ao substituir. */
export function vazio(dados: Pick<Dados, 'materias' | 'eventos'>): boolean {
  return dados.materias.length === 0 && dados.eventos.length === 0
}
