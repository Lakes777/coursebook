import { AULAS_PUC, aulasDoHorario, intervaloHorario } from '../logica/aulasPUC'
import { textoPrazo, type EventoNaAgenda } from '../logica/eventos'
import { minutos } from '../logica/horarios'
import type { Materia } from '../logica/tipos'
import type { Resumo } from '../tema/textos'
import { pedeAtencao } from '../tema/textos'

// O que o Início mostra: a frase do dia, os números do semestre e a régua com as
// aulas de hoje. Sem React, para os cálculos poderem ser testados sozinhos.

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** "Quinta, 29 de outubro". Montado à mão para não depender do Intl do navegador. */
export function textoDoDia(data: Date): string {
  return `${DIAS[data.getDay()]}, ${data.getDate()} de ${MESES[data.getMonth()]}`
}

/** "uma", "duas" ... "dez" (matéria é feminino); de 11 em diante, o número. */
export function porExtenso(n: number): string {
  const nomes = ['zero', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez']
  return nomes[n] ?? String(n)
}

/** Uma aula de hoje na régua. Os horários vão em minutos desde a meia-noite. */
export interface AulaDeHoje {
  materiaId: string
  materia: string
  professor: string
  de: number
  ate: number
  /** Início de cada aula da tabela da PUC dentro do horário, menos a primeira (as divisões do bloco). */
  divisoes: number[]
  /** Quantas aulas de 45 min o horário tem (as da tabela; sem tabela, as informadas). */
  aulas: number
  /** A linha da régua (0, 1...): dois horários que se cruzam não ficam um em cima do outro. */
  faixa: number
}

/** As aulas do dia de `agora`, da mais cedo para a mais tarde. */
export function aulasDeHoje(materias: Materia[], agora: Date): AulaDeHoje[] {
  const dia = agora.getDay()
  const aulas: Omit<AulaDeHoje, 'faixa'>[] = []
  for (const m of materias) {
    for (const h of m.horarios) {
      if (h.dia !== dia) continue
      const intervalo = intervaloHorario(h)
      if (!intervalo) continue
      // Um horário antigo (sem fim) pode passar da meia-noite: a régua para no fim do dia.
      const de = intervalo[0]
      const ate = Math.min(intervalo[1], 24 * 60)
      if (de >= ate) continue
      const daTabela = aulasDoHorario(h)
      // Quantas aulas: a do cadastro manda (é a que a matéria e o "Faltei hoje" usam);
      // a tabela da PUC só vale quando o horário não diz.
      const quantas = h.aulas ?? Math.max(1, daTabela.length)
      aulas.push({
        materiaId: m.id,
        materia: m.nome,
        professor: m.professor,
        de,
        ate,
        // As divisões só aparecem se a tabela concorda com o cadastro.
        divisoes:
          daTabela.length === quantas ? daTabela.slice(1).map((i) => minutos(AULAS_PUC[i].inicio)!) : [],
        aulas: quantas,
      })
    }
  }
  aulas.sort((a, b) => a.de - b.de || a.materia.localeCompare(b.materia, 'pt-BR'))
  // Cada aula vai para a primeira linha onde a anterior já terminou.
  const fimDaFaixa: number[] = []
  return aulas.map((aula) => {
    let faixa = fimDaFaixa.findIndex((fim) => fim <= aula.de)
    if (faixa === -1) faixa = fimDaFaixa.length
    fimDaFaixa[faixa] = aula.ate
    return { ...aula, faixa }
  })
}

/**
 * De que hora a que hora vai a régua: da hora cheia antes da primeira aula à hora
 * cheia depois da última (19:00 a 22:15 vira 18h a 23h), sempre com folga antes e
 * depois e dentro do dia. Null num dia sem aulas.
 */
export function limitesDaRegua(aulas: AulaDeHoje[]): { de: number; ate: number } | null {
  if (aulas.length === 0) return null
  const primeira = Math.min(...aulas.map((a) => a.de))
  const ultima = Math.max(...aulas.map((a) => a.ate))
  return {
    de: Math.max(0, Math.ceil(primeira / 60) * 60 - 60),
    ate: Math.min(24 * 60, Math.floor(ultima / 60) * 60 + 60),
  }
}

/** "19:00" a partir dos minutos. */
export function hora(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/** Um pedaço da frase do dia; os fortes aparecem em destaque. */
export interface TrechoFrase {
  texto: string
  forte?: boolean
}

/** O que a aula diz na frase: a de agora, a próxima ou que o dia acabou. */
function trechoAulas(aulas: AulaDeHoje[], minutoAgora: number): TrechoFrase[] {
  const agora = aulas.find((a) => a.de <= minutoAgora && minutoAgora < a.ate)
  if (agora) return [{ texto: `${agora.materia} agora`, forte: true }]
  const proxima = aulas.find((a) => a.de > minutoAgora)
  if (proxima) return [{ texto: `${proxima.materia} às ${hora(proxima.de)}`, forte: true }]
  if (aulas.length > 0) return [{ texto: 'Aulas de hoje encerradas' }]
  return [{ texto: 'Sem aulas hoje' }]
}

/**
 * A frase do dia, o título do Início: "Quinta, 29 de outubro. POO agora, Prova do RA2
 * em 5 dias e duas matérias pedindo atenção." Cada parte sai dos dados: a aula de
 * agora (ou a próxima), o próximo prazo e quantas matérias pedem atenção.
 */
export function fraseDoDia(
  agora: Date,
  aulas: AulaDeHoje[],
  pendentes: EventoNaAgenda[],
  atencao: number,
): TrechoFrase[] {
  const minutoAgora = agora.getHours() * 60 + agora.getMinutes()
  const proximo = pendentes.find((e) => e.dias >= 0)
  const trechos: TrechoFrase[] = [{ texto: `${textoDoDia(agora)}. ` }, ...trechoAulas(aulas, minutoAgora)]
  trechos.push({ texto: ', ' })
  if (proximo) {
    trechos.push({ texto: proximo.titulo, forte: true }, { texto: ` ${textoPrazo(proximo.dias)}` })
  } else {
    trechos.push({ texto: 'nenhum prazo pela frente' })
  }
  trechos.push({ texto: ' e ' })
  if (atencao === 0) {
    trechos.push({ texto: 'tudo em dia nas matérias' })
  } else {
    trechos.push(
      { texto: `${porExtenso(atencao)} ${atencao === 1 ? 'matéria' : 'matérias'}`, forte: true },
      { texto: ' pedindo atenção' },
    )
  }
  trechos.push({ texto: '.' })
  return trechos
}

/** Quantas matérias pedem atenção (nota ou faltas em amarelo ou vermelho). */
export function contarAtencao(resumos: Resumo[]): number {
  return resumos.filter(pedeAtencao).length
}

/**
 * A matéria mais perto do limite de faltas (a maior fração usada). Uma matéria curta
 * com limite 0 e alguma falta já reprovou: conta como a pior de todas. Null se
 * ninguém tem falta (não há o que mostrar) ou nenhuma tem carga horária.
 */
export function piorFalta(
  materias: { materia: Materia; resumo: Resumo }[],
): { materia: Materia; total: number; limite: number } | null {
  let pior: { materia: Materia; total: number; limite: number; fracao: number } | null = null
  for (const { materia, resumo } of materias) {
    const { total, limite, nivel } = resumo.faltas
    if (nivel === 'sem-carga-horaria' || total === 0) continue
    const fracao = limite === 0 ? Infinity : total / limite
    if (!pior || fracao > pior.fracao) pior = { materia, total, limite, fracao }
  }
  return pior && { materia: pior.materia, total: pior.total, limite: pior.limite }
}
