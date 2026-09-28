import { dataValida } from './datas'
import { erroEvento } from './eventos'
import { erroCargaHoraria, erroFalta } from './faltas'
import { erroHorario, HORA } from './horarios'
import { novoId } from './ids'
import { erroAvaliacao, erroPontoExtra, erroRA, NOTA_MAXIMA } from './notas'
import type {
  Avaliacao,
  Dados,
  DiaSemana,
  Evento,
  Falta,
  Horario,
  Materia,
  PontoExtra,
  RegraAprovacao,
  ResultadoAprendizagem,
  TipoEvento,
} from './tipos'
import { REGRA_PUCPR, VERSAO_ATUAL } from './tipos'

// Confere dados que vieram de fora do código (localStorage ou um JSON importado)
// e devolve uma cópia limpa, no formato de tipos.ts. Campos opcionais que faltam
// ganham o valor padrão (lista vazia, texto vazio), para aceitar dados antigos e
// JSONs escritos à mão ou por uma IA. Qualquer outro problema recusa tudo, com uma
// mensagem que diz onde está o erro.

export const TAMANHO_MAXIMO_NOME = 100

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string }

/** Erro com o caminho até o campo (ex.: "Matéria 2 (POO) > RA1 > Avaliação 1"). */
class ErroDados extends Error {}

function falhar(onde: string, mensagem: string): never {
  throw new ErroDados(onde ? `${onde}: ${mensagem}` : mensagem)
}

function conferir(onde: string, erro: string | null): void {
  if (erro !== null) falhar(onde, erro)
}

function objeto(valor: unknown, onde: string): Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    falhar(onde, 'era esperado um objeto { ... }.')
  }
  return valor as Record<string, unknown>
}

/** Lista obrigatória, ou vazia quando o campo não existe. */
function lista(valor: unknown, onde: string): unknown[] {
  if (valor === undefined) return []
  if (!Array.isArray(valor)) falhar(onde, 'era esperada uma lista [ ... ].')
  return valor
}

function numero(valor: unknown, onde: string): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    falhar(onde, 'era esperado um número (com ponto, ex.: 7.5).')
  }
  return valor
}

function numeroOuNull(valor: unknown, onde: string): number | null {
  return valor === null || valor === undefined ? null : numero(valor, onde)
}

/** `null` conta como campo ausente quando existe padrão. */
function texto(valor: unknown, onde: string, padrao?: string): string {
  if ((valor === undefined || valor === null) && padrao !== undefined) return padrao
  if (typeof valor !== 'string') falhar(onde, 'era esperado um texto entre aspas.')
  return valor.trim()
}

function nome(valor: unknown, onde: string): string {
  const n = texto(valor, `${onde} > nome`)
  if (n === '') falhar(onde, 'o nome não pode ficar vazio.')
  if (n.length > TAMANHO_MAXIMO_NOME) {
    falhar(onde, `o nome pode ter no máximo ${TAMANHO_MAXIMO_NOME} caracteres.`)
  }
  return n
}

function booleano(valor: unknown, onde: string, padrao: boolean): boolean {
  if (valor === undefined) return padrao
  if (typeof valor !== 'boolean') falhar(onde, 'era esperado true ou false.')
  return valor
}

function dataOpcional(valor: unknown, onde: string): string | undefined {
  if (valor === undefined || valor === null || valor === '') return undefined
  const d = texto(valor, onde)
  if (!dataValida(d)) falhar(onde, 'a data precisa existir e estar no formato AAAA-MM-DD.')
  return d
}

/**
 * Ids ficam únicos dentro de cada lista. Sem id, ganha um novo (JSON feito à mão
 * ou por IA costuma não ter). Id repetido é erro, porque não dá para saber qual
 * dos dois um evento ou a tela quer dizer.
 */
function criarIds() {
  const vistos = new Set<string>()
  return (valor: unknown, onde: string): string => {
    const id = valor === undefined || valor === null ? novoId() : texto(valor, `${onde} > id`)
    if (id === '') falhar(onde, 'o id não pode ficar vazio.')
    if (vistos.has(id)) falhar(onde, `o id "${id}" aparece mais de uma vez.`)
    vistos.add(id)
    return id
  }
}

function lerRegra(valor: unknown, onde: string): RegraAprovacao {
  const r = objeto(valor, onde)
  const mediaMinima = numero(r.mediaMinima, `${onde} > mediaMinima`)
  if (mediaMinima < 0 || mediaMinima > NOTA_MAXIMA) {
    falhar(onde, `a média mínima precisa estar entre 0 e ${NOTA_MAXIMA}.`)
  }
  const frequenciaMinima = numero(r.frequenciaMinima, `${onde} > frequenciaMinima`)
  if (frequenciaMinima < 0 || frequenciaMinima > 1) {
    falhar(onde, 'a frequência mínima vai de 0 a 1 (0.75 = 75%).')
  }
  const regra: RegraAprovacao = {
    mediaMinima,
    frequenciaMinima,
    arredondarUmaCasa: booleano(r.arredondarUmaCasa, `${onde} > arredondarUmaCasa`, false),
  }
  if (r.recuperacao !== undefined && r.recuperacao !== null) {
    const rec = objeto(r.recuperacao, `${onde} > recuperacao`)
    const notaMinima = numero(rec.notaMinima, `${onde} > recuperacao > notaMinima`)
    const teto = numero(rec.teto, `${onde} > recuperacao > teto`)
    if (notaMinima < 0 || notaMinima > mediaMinima) {
      falhar(onde, 'a nota mínima para a recuperação precisa estar entre 0 e a média mínima.')
    }
    if (teto < 0 || teto > NOTA_MAXIMA) {
      falhar(onde, `o teto da recuperação precisa estar entre 0 e ${NOTA_MAXIMA}.`)
    }
    regra.recuperacao = { notaMinima, teto }
  }
  return regra
}

function lerHorario(valor: unknown, onde: string): Horario {
  const h = objeto(valor, onde)
  const dia = numero(h.dia, `${onde} > dia`)
  if (!Number.isInteger(dia) || dia < 0 || dia > 6) {
    falhar(onde, 'o dia vai de 0 (domingo) a 6 (sábado).')
  }
  const inicio = texto(h.inicio, `${onde} > inicio`)
  if (!HORA.test(inicio)) falhar(onde, 'o horário precisa estar no formato HH:MM (ex.: 07:45).')
  const horario: Horario = { dia: dia as DiaSemana, inicio }
  if (h.fim !== undefined && h.fim !== null && h.fim !== '') horario.fim = texto(h.fim, `${onde} > fim`)
  if (h.aulas !== undefined && h.aulas !== null) horario.aulas = numero(h.aulas, `${onde} > aulas`)
  conferir(onde, erroHorario(horario))
  return horario
}

function lerAvaliacao(valor: unknown, onde: string, id: ReturnType<typeof criarIds>): Avaliacao {
  const a = objeto(valor, onde)
  const avaliacao: Avaliacao = {
    id: id(a.id, onde),
    nome: nome(a.nome, onde),
    // Planos que não dizem os pesos: pesos iguais; a maioria vale 10.
    peso: a.peso === undefined ? 1 : numero(a.peso, `${onde} > peso`),
    valorMaximo: a.valorMaximo === undefined ? NOTA_MAXIMA : numero(a.valorMaximo, `${onde} > valorMaximo`),
    nota: numeroOuNull(a.nota, `${onde} > nota`),
  }
  conferir(onde, erroAvaliacao(avaliacao))
  const data = dataOpcional(a.data, `${onde} > data`)
  if (data) avaliacao.data = data
  return avaliacao
}

function lerRA(valor: unknown, onde: string, id: ReturnType<typeof criarIds>): ResultadoAprendizagem {
  const r = objeto(valor, onde)
  const idAvaliacao = criarIds()
  const ra: ResultadoAprendizagem = {
    id: id(r.id, onde),
    nome: nome(r.nome, onde),
    peso: numero(r.peso, `${onde} > peso`),
    avaliacoes: lista(r.avaliacoes, `${onde} > avaliacoes`).map((a, i) =>
      lerAvaliacao(a, `${onde} > Avaliação ${i + 1}`, idAvaliacao),
    ),
    recuperacaoNoSemestre: booleano(r.recuperacaoNoSemestre, `${onde} > recuperacaoNoSemestre`, false),
    notaRecuperacao: numeroOuNull(r.notaRecuperacao, `${onde} > notaRecuperacao`),
  }
  conferir(onde, erroRA(ra))
  return ra
}

function lerPontoExtra(valor: unknown, onde: string, id: ReturnType<typeof criarIds>): PontoExtra {
  const p = objeto(valor, onde)
  const extra: PontoExtra = {
    id: id(p.id, onde),
    pontos: numero(p.pontos, `${onde} > pontos`),
    comentario: texto(p.comentario, `${onde} > comentario`),
  }
  conferir(onde, erroPontoExtra(extra))
  const data = dataOpcional(p.data, `${onde} > data`)
  if (data) extra.data = data
  return extra
}

function lerFalta(valor: unknown, onde: string, id: ReturnType<typeof criarIds>): Falta {
  const f = objeto(valor, onde)
  const falta: Falta = {
    id: id(f.id, onde),
    data: texto(f.data, `${onde} > data`),
    quantidade: f.quantidade === undefined ? 1 : numero(f.quantidade, `${onde} > quantidade`),
  }
  conferir(onde, erroFalta(falta))
  return falta
}

function lerMateria(valor: unknown, onde: string, id: ReturnType<typeof criarIds>): Materia {
  const m = objeto(valor, onde)
  // O nome entra no caminho dos erros de dentro, para achar a matéria mais fácil.
  const n = nome(m.nome, onde)
  const aqui = `${onde} (${n})`
  const cargaHoraria = m.cargaHoraria === undefined ? 0 : numero(m.cargaHoraria, `${aqui} > cargaHoraria`)
  conferir(aqui, erroCargaHoraria(cargaHoraria))
  const idRA = criarIds()
  const idExtra = criarIds()
  const idFalta = criarIds()
  const materia: Materia = {
    id: id(m.id, aqui),
    nome: n,
    professor: texto(m.professor, `${aqui} > professor`, ''),
    horarios: lista(m.horarios, `${aqui} > horarios`).map((h, i) =>
      lerHorario(h, `${aqui} > Horário ${i + 1}`),
    ),
    cargaHoraria,
    ras: lista(m.ras, `${aqui} > ras`).map((r, i) => lerRA(r, `${aqui} > RA ${i + 1}`, idRA)),
    pontosExtras: lista(m.pontosExtras, `${aqui} > pontosExtras`).map((p, i) =>
      lerPontoExtra(p, `${aqui} > Ponto extra ${i + 1}`, idExtra),
    ),
    faltas: lista(m.faltas, `${aqui} > faltas`).map((f, i) => lerFalta(f, `${aqui} > Falta ${i + 1}`, idFalta)),
  }
  if (materia.professor.length > TAMANHO_MAXIMO_NOME) {
    falhar(aqui, `o nome do professor pode ter no máximo ${TAMANHO_MAXIMO_NOME} caracteres.`)
  }
  if (m.regra !== undefined && m.regra !== null) materia.regra = lerRegra(m.regra, `${aqui} > regra`)
  return materia
}

function lerEvento(
  valor: unknown,
  onde: string,
  id: ReturnType<typeof criarIds>,
  materias: Set<string>,
): Evento {
  const e = objeto(valor, onde)
  const evento: Evento = {
    id: id(e.id, onde),
    titulo: texto(e.titulo, `${onde} > titulo`),
    tipo: texto(e.tipo, `${onde} > tipo`) as TipoEvento,
    data: texto(e.data, `${onde} > data`),
    concluido: booleano(e.concluido, `${onde} > concluido`, false),
  }
  conferir(onde, erroEvento(evento))
  // Sem matéria: campo ausente, null ou "".
  const materiaId = texto(e.materiaId, `${onde} > materiaId`, '')
  if (materiaId !== '') {
    if (!materias.has(materiaId)) falhar(onde, `não existe matéria com o id "${materiaId}".`)
    evento.materiaId = materiaId
  }
  return evento
}

/**
 * Confere os dados já na versão atual (depois da migração) e devolve uma cópia
 * limpa. Sem `regraPadrao`, vale a da PUC-PR.
 */
export function validarDados(bruto: unknown): Resultado<Dados> {
  try {
    const d = objeto(bruto, '')
    if (d.versao === undefined) falhar('', `falta o campo "versao" (use ${VERSAO_ATUAL}).`)
    if (d.versao !== VERSAO_ATUAL) falhar('', `versão ${String(d.versao)} desconhecida.`)
    const idMateria = criarIds()
    const materias = lista(d.materias, 'materias').map((m, i) =>
      lerMateria(m, `Matéria ${i + 1}`, idMateria),
    )
    const ids = new Set(materias.map((m) => m.id))
    const idEvento = criarIds()
    const eventos = lista(d.eventos, 'eventos').map((e, i) =>
      lerEvento(e, `Evento ${i + 1}`, idEvento, ids),
    )
    const regraPadrao =
      d.regraPadrao === undefined || d.regraPadrao === null
        ? structuredClone(REGRA_PUCPR)
        : lerRegra(d.regraPadrao, 'Regra padrão')
    return { ok: true, valor: { versao: VERSAO_ATUAL, materias, eventos, regraPadrao } }
  } catch (e) {
    if (e instanceof ErroDados) return { ok: false, erro: e.message }
    throw e
  }
}
