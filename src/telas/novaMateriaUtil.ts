import { AULAS_PUC, aulasDaTabela, aulasDoHorario, horariosSeChocam, intervaloHorario } from '../logica/aulasPUC'
import { dataValida } from '../logica/datas'
import { erroCargaHoraria, MAXIMO_AULAS_POR_DIA } from '../logica/faltas'
import { erroHorario, faixaHorario, HORA, sugerirAulas } from '../logica/horarios'
import { novoId } from '../logica/ids'
import { erroAvaliacao, erroRA, NOTA_MAXIMA } from '../logica/notas'
import { formatarNota, formatarPorcentagem, lerNumero, limpar } from '../logica/numeros'
import type { Avaliacao, DiaSemana, Horario, Materia, RegraAprovacao, ResultadoAprendizagem } from '../logica/tipos'
import { TAMANHO_MAXIMO_NOME } from '../logica/validacao'

// Lógica do formulário "Nova matéria", sem React. Os campos guardam o texto como
// foi digitado ("7,5"), e só viram número ao conferir e ao montar a matéria: assim
// voltar um passo mostra exatamente o que a pessoa escreveu.

export const PASSOS = ['Matéria', 'RAs', 'Avaliações', 'Regra de aprovação', 'Revisar e salvar'] as const

/** Segunda primeiro, como no plano de ensino; o valor é o do Date.getDay(). */
export const DIAS_SEMANA: { dia: DiaSemana; nome: string }[] = [
  { dia: 1, nome: 'Segunda-feira' },
  { dia: 2, nome: 'Terça-feira' },
  { dia: 3, nome: 'Quarta-feira' },
  { dia: 4, nome: 'Quinta-feira' },
  { dia: 5, nome: 'Sexta-feira' },
  { dia: 6, nome: 'Sábado' },
  { dia: 0, nome: 'Domingo' },
]

export function nomeDia(dia: DiaSemana): string {
  return DIAS_SEMANA.find((d) => d.dia === dia)?.nome ?? ''
}


export interface HorarioForm {
  /** Chave da lista no React e parte do id dos campos. */
  chave: string
  dia: DiaSemana
  inicio: string
  fim: string
  aulas: string
  /** Se a pessoa mexeu no número de aulas: aí mudar o início ou o fim não troca mais a sugestão. */
  aulasManual: boolean
  /**
   * 'aulas': escolhido pelas aulas da tabela da PUC-PR (da 2ª à 5ª); início, fim e
   * número de aulas saem delas. 'horas': digitado, para aulas fora da tabela.
   */
  modo: 'aulas' | 'horas'
}

export interface AvaliacaoForm {
  /** Chave da lista e parte do id dos campos. Numa avaliação nova, também vira o id dela. */
  chave: string
  /**
   * Id da avaliação na matéria, ao editar. Fica separado da chave porque ids de um JSON
   * importado podem ter espaços ou se repetir em RAs diferentes, e não servem de id de campo.
   */
  id?: string
  nome: string
  valorMaximo: string
  peso: string
  data: string
}

export interface RAForm {
  /** Chave da lista e parte do id dos campos. Num RA novo, também vira o id dele. */
  chave: string
  /** Id do RA na matéria, ao editar (veja AvaliacaoForm.id). */
  id?: string
  nome: string
  peso: string
  recuperacaoNoSemestre: boolean
  avaliacoes: AvaliacaoForm[]
}

export interface RegraForm {
  mediaMinima: string
  /** Em porcentagem ("75"), como está no plano de ensino. */
  frequenciaMinima: string
  temRecuperacao: boolean
  notaMinima: string
  teto: string
  arredondarUmaCasa: boolean
}

export interface Formulario {
  nome: string
  professor: string
  cargaHoraria: string
  horarios: HorarioForm[]
  ras: RAForm[]
  usarRegraPadrao: boolean
  regra: RegraForm
}

/** Erro de um campo: `campo` é o id do elemento na tela, para ligar a mensagem e pôr o foco. */
export interface ErroCampo {
  campo: string
  mensagem: string
}

// ---------- Ids dos campos ----------

export const ID_NOME = 'nm-nome'
export const ID_PROFESSOR = 'nm-professor'
export const ID_CARGA = 'nm-carga'

/** Ids dos campos da regra. O prefixo separa os do formulário de matéria dos da tela Dados. */
export interface IdsRegra {
  media: string
  frequencia: string
  notaMinima: string
  teto: string
}

export const idsRegra = (prefixo: string): IdsRegra => ({
  media: `${prefixo}-regra-media`,
  frequencia: `${prefixo}-regra-frequencia`,
  notaMinima: `${prefixo}-regra-nota-minima`,
  teto: `${prefixo}-regra-teto`,
})

export const IDS_REGRA_MATERIA = idsRegra('nm')
export const ID_MEDIA = IDS_REGRA_MATERIA.media
export const ID_FREQUENCIA = IDS_REGRA_MATERIA.frequencia
export const ID_NOTA_MINIMA = IDS_REGRA_MATERIA.notaMinima
export const ID_TETO = IDS_REGRA_MATERIA.teto

export const idHorario = (chave: string, campo: 'dia' | 'inicio' | 'fim' | 'aulas') => `nm-horario-${chave}-${campo}`
export const idRA = (chave: string, campo: 'nome' | 'peso') => `nm-ra-${chave}-${campo}`
export const idAvaliacao = (chave: string, campo: 'nome' | 'valor' | 'peso' | 'data') => `nm-av-${chave}-${campo}`

// ---------- Valores iniciais ----------

export function novoHorario(): HorarioForm {
  return { chave: novoId(), dia: 1, inicio: '', fim: '', aulas: '', aulasManual: false, modo: 'aulas' }
}

/** Posições (em AULAS_PUC) da primeira e da última aula escolhidas; -1 se ainda não escolheu. */
export function aulasEscolhidas(horario: HorarioForm): { primeira: number; ultima: number } {
  return {
    primeira: AULAS_PUC.findIndex((a) => a.inicio === horario.inicio),
    ultima: AULAS_PUC.findIndex((a) => a.fim === horario.fim),
  }
}

/**
 * Escolhe as aulas (posições em AULAS_PUC; -1 = nenhuma) e preenche início, fim e
 * número de aulas. Última antes da primeira vira a primeira (da 4ª até a 4ª), e
 * nunca passa de MAXIMO_AULAS_POR_DIA aulas (o máximo que uma falta aceita).
 */
export function escolherAulas(horario: HorarioForm, primeira: number, ultima: number): HorarioForm {
  let ate = ultima
  if (primeira !== -1 && ate !== -1) ate = Math.min(Math.max(ate, primeira), primeira + MAXIMO_AULAS_POR_DIA - 1)
  const inicio = primeira === -1 ? '' : AULAS_PUC[primeira].inicio
  const fim = ate === -1 ? '' : AULAS_PUC[ate].fim
  const aulas = primeira !== -1 && ate !== -1 ? String(ate - primeira + 1) : ''
  // aulasManual false: ninguém digitou o número; indo para horas, ele volta a acompanhar o horário.
  return { ...horario, inicio, fim, aulas, aulasManual: false }
}

/** Trocar a primeira aula: sem última escolhida, ela vem junto (quase toda aula tem mais de uma). */
export function escolherPrimeiraAula(horario: HorarioForm, primeira: number): HorarioForm {
  const { ultima } = aulasEscolhidas(horario)
  return escolherAulas(horario, primeira, ultima === -1 ? primeira : ultima)
}

/**
 * Troca entre escolher pelas aulas e digitar as horas. Nada é apagado: indo para
 * as aulas, o que não bate com a tabela aparece como "Escolha" (e a conferência
 * pede para escolher), e voltar para horas mostra as horas de antes. Quando as duas
 * aulas batem, o número de aulas passa a ser o da tabela.
 */
export function trocarModoHorario(horario: HorarioForm): HorarioForm {
  if (horario.modo === 'aulas') return { ...horario, modo: 'horas' }
  const { primeira, ultima } = aulasEscolhidas(horario)
  if (primeira === -1 || ultima < primeira) return { ...horario, modo: 'aulas' }
  return { ...horario, modo: 'aulas', aulas: String(ultima - primeira + 1) }
}

/**
 * O horário com os `campos` mudados. Enquanto a pessoa não mexe nas aulas, elas
 * acompanham o início e o fim (a sugestão de aulas de 45 min que cabem).
 */
export function mudarHorarioForm(horario: HorarioForm, campos: Partial<HorarioForm>): HorarioForm {
  const novo = { ...horario, ...campos }
  if ('aulas' in campos) return { ...novo, aulasManual: true }
  if (!novo.aulasManual && ('inicio' in campos || 'fim' in campos)) {
    const sugestao = sugerirAulas(novo.inicio, novo.fim)
    return { ...novo, aulas: sugestao === null ? '' : String(sugestao) }
  }
  return novo
}

/** Vale 10 e tem peso 1 (pesos iguais), como na maioria dos planos. */
export function novaAvaliacao(): AvaliacaoForm {
  return { chave: novoId(), nome: '', valorMaximo: '10', peso: '1', data: '' }
}

/** `numero` é a posição do RA (1, 2...), para o nome padrão "RA1", "RA2"... */
export function novoRA(numero: number): RAForm {
  return {
    chave: novoId(),
    nome: `RA${numero}`,
    peso: '',
    recuperacaoNoSemestre: false,
    avaliacoes: [novaAvaliacao()],
  }
}

/** Número como a pessoa escreveria: 7 -> "7", 0.75 * 100 -> "75", 6.5 -> "6,5". */
function paraTexto(n: number): string {
  return String(limpar(n)).replace('.', ',')
}

/** A regra própria começa igual à padrão: a pessoa só muda o que for diferente. */
export function regraParaForm(regra: RegraAprovacao): RegraForm {
  return {
    mediaMinima: paraTexto(regra.mediaMinima),
    frequenciaMinima: paraTexto(regra.frequenciaMinima * 100),
    temRecuperacao: regra.recuperacao !== undefined,
    notaMinima: paraTexto(regra.recuperacao?.notaMinima ?? 4),
    teto: paraTexto(regra.recuperacao?.teto ?? regra.mediaMinima),
    arredondarUmaCasa: regra.arredondarUmaCasa,
  }
}

export function formularioVazio(regraPadrao: RegraAprovacao): Formulario {
  return {
    nome: '',
    professor: '',
    cargaHoraria: '',
    horarios: [],
    ras: [novoRA(1)],
    usarRegraPadrao: true,
    regra: regraParaForm(regraPadrao),
  }
}

// ---------- Conferências de cada passo ----------
// Cada uma devolve o primeiro erro (na ordem da tela) ou null. Barram o mesmo que o
// carregamento (validacao.ts), para a matéria salva sempre abrir de novo.

function erroNome(texto: string, campo: string, vazio: string): ErroCampo | null {
  const nome = texto.trim()
  if (nome === '') return { campo, mensagem: vazio }
  if (nome.length > TAMANHO_MAXIMO_NOME) {
    return { campo, mensagem: `O nome pode ter no máximo ${TAMANHO_MAXIMO_NOME} caracteres.` }
  }
  return null
}

/** Um horário de outra matéria do painel, que o formulário não pode ocupar de novo. */
export interface HorarioOcupado {
  materia: string
  horario: Horario
}

/** Os horários das matérias do painel, menos os da matéria que está sendo editada. */
export function horariosOcupados(materias: Materia[], ignorarMateriaId?: string): HorarioOcupado[] {
  return materias
    .filter((m) => m.id !== ignorarMateriaId)
    .flatMap((m) => m.horarios.map((horario) => ({ materia: m.nome, horario })))
}

/** O horário do formulário como ele seria salvo (fim vazio = sem fim; aulas inválidas = sem número). */
function horarioDoForm(h: HorarioForm): Horario {
  return { dia: h.dia, inicio: h.inicio, fim: h.fim || undefined, aulas: lerNumero(h.aulas) ?? undefined }
}

/**
 * Mesmo dia e mesmo intervalo de verdade. Não compara campo a campo: um horário
 * salvo sem fim ganha o fim no formulário (que o exige), e o número de aulas não
 * muda o intervalo quando há fim.
 */
function mesmoHorario(a: Horario, b: Horario): boolean {
  const x = intervaloHorario(a)
  const y = intervaloHorario(b)
  return a.dia === b.dia && x !== null && y !== null && x[0] === y[0] && x[1] === y[1]
}

/**
 * "Choca com POO (terça-feira, 09:40 às 12:40)." para o primeiro horário do
 * formulário que cai em cima de outro (de outra matéria ou desta mesma), ou null.
 * Um horário igual a um de `jaSalvos` (o que a matéria já tinha ao abrir o
 * formulário) pode chocar com outra matéria: aula quinzenal, dependência em outra
 * turma. Assim um choque que já estava nos dados não impede de mudar só o nome.
 */
function erroChoque(horarios: HorarioForm[], ocupados: HorarioOcupado[], jaSalvos: HorarioForm[]): ErroCampo | null {
  const salvos = jaSalvos.map(horarioDoForm)
  for (const [i, h] of horarios.entries()) {
    const este = horarioDoForm(h)
    const campo = idHorario(h.chave, 'inicio')
    const outro = horarios.slice(0, i).findIndex((o) => horariosSeChocam(este, horarioDoForm(o)))
    if (outro !== -1) {
      return { campo, mensagem: `Choca com o horário ${outro + 1} desta matéria. Escolha outro horário.` }
    }
    if (salvos.some((s) => mesmoHorario(s, este))) continue
    const ocupado = ocupados.find((o) => horariosSeChocam(este, o.horario))
    if (ocupado) {
      const { dia, inicio, fim } = ocupado.horario
      const quando = `${nomeDia(dia).toLowerCase()}, ${faixaHorario({ inicio, fim })}`
      return { campo, mensagem: `Choca com ${ocupado.materia} (${quando}). Escolha outro horário.` }
    }
  }
  return null
}

/**
 * Posições das aulas da tabela (AULAS_PUC) já ocupadas num dia, com o nome de quem
 * ocupa: as outras matérias e os outros horários deste formulário ("horário 2").
 */
export function aulasOcupadasNoDia(
  dia: DiaSemana,
  ocupados: HorarioOcupado[],
  horarios: HorarioForm[],
  chaveAtual: string,
): Map<number, string> {
  const resultado = new Map<number, string>()
  const marcar = (h: Horario, nome: string) => {
    if (h.dia !== dia) return
    for (const i of aulasDoHorario(h)) if (!resultado.has(i)) resultado.set(i, nome)
  }
  ocupados.forEach((o) => marcar(o.horario, o.materia))
  horarios.forEach((h, i) => {
    if (h.chave !== chaveAtual) marcar(horarioDoForm(h), `horário ${i + 1}`)
  })
  return resultado
}

export function conferirMateria(
  form: Formulario,
  ocupados: HorarioOcupado[] = [],
  jaSalvos: HorarioForm[] = [],
): ErroCampo | null {
  const nome = erroNome(form.nome, ID_NOME, 'Dê um nome à matéria (ex.: "Programação Orientada a Objetos").')
  if (nome) return nome
  if (form.professor.trim().length > TAMANHO_MAXIMO_NOME) {
    return {
      campo: ID_PROFESSOR,
      mensagem: `O nome do professor pode ter no máximo ${TAMANHO_MAXIMO_NOME} caracteres.`,
    }
  }
  const carga = lerNumero(form.cargaHoraria)
  if (carga === null) {
    return { campo: ID_CARGA, mensagem: 'Informe a carga horária em aulas (0 se não souber).' }
  }
  const erroCarga = erroCargaHoraria(carga)
  if (erroCarga) return { campo: ID_CARGA, mensagem: erroCarga }
  for (const h of form.horarios) {
    if (h.modo === 'aulas') {
      // Os seletores das aulas usam os ids de início e fim, então o erro cai num seletor
      // que está na tela (o campo de aulas não existe neste modo).
      const { primeira, ultima } = aulasEscolhidas(h)
      if (primeira === -1) return { campo: idHorario(h.chave, 'inicio'), mensagem: 'Escolha a primeira aula.' }
      if (ultima < primeira) return { campo: idHorario(h.chave, 'fim'), mensagem: 'Escolha a última aula.' }
      if (ultima - primeira + 1 > MAXIMO_AULAS_POR_DIA) {
        return {
          campo: idHorario(h.chave, 'fim'),
          mensagem: `Escolha no máximo ${MAXIMO_AULAS_POR_DIA} aulas seguidas.`,
        }
      }
      continue
    }
    if (!HORA.test(h.inicio)) {
      return {
        campo: idHorario(h.chave, 'inicio'),
        mensagem: 'Informe a hora de início no formato HH:MM (ex.: 07:45).',
      }
    }
    if (!HORA.test(h.fim)) {
      return { campo: idHorario(h.chave, 'fim'), mensagem: 'Informe a hora do fim no formato HH:MM (ex.: 22:30).' }
    }
    const erroFim = erroHorario({ inicio: h.inicio, fim: h.fim })
    if (erroFim) return { campo: idHorario(h.chave, 'fim'), mensagem: erroFim }
    const aulas = lerNumero(h.aulas)
    const erroAulas = erroHorario({ inicio: h.inicio, aulas: aulas ?? Number.NaN })
    if (erroAulas) return { campo: idHorario(h.chave, 'aulas'), mensagem: erroAulas }
  }
  // Só depois de cada horário estar certo sozinho: aí dá para comparar os intervalos.
  return erroChoque(form.horarios, ocupados, jaSalvos)
}

export function conferirRAs(form: Formulario): ErroCampo | null {
  for (const ra of form.ras) {
    const nome = erroNome(ra.nome, idRA(ra.chave, 'nome'), 'Dê um nome ao RA (ex.: "RA1").')
    if (nome) return nome
    const campoPeso = idRA(ra.chave, 'peso')
    const peso = lerNumero(ra.peso)
    if (peso === null) {
      return { campo: campoPeso, mensagem: 'Informe o peso do RA na nota final (ex.: 40 para 40%).' }
    }
    const erro = erroRA({ peso, notaRecuperacao: null })
    if (erro) return { campo: campoPeso, mensagem: erro }
  }
  // Sem nenhum peso, a matéria nunca teria nota final.
  if (form.ras.length > 0 && somaPesos(form.ras) === 0) {
    return {
      campo: idRA(form.ras[0].chave, 'peso'),
      mensagem: 'Pelo menos um RA precisa ter peso maior que 0.',
    }
  }
  return null
}

export function conferirAvaliacoes(form: Formulario): ErroCampo | null {
  for (const ra of form.ras) {
    for (const av of ra.avaliacoes) {
      const nome = erroNome(av.nome, idAvaliacao(av.chave, 'nome'), 'Dê um nome à avaliação (ex.: "Prova 1").')
      if (nome) return nome
      const valorMaximo = lerNumero(av.valorMaximo)
      if (valorMaximo === null || valorMaximo <= 0) {
        return {
          campo: idAvaliacao(av.chave, 'valor'),
          mensagem: 'Informe quanto a avaliação vale, maior que 0 (ex.: 10 ou 3,0).',
        }
      }
      const peso = lerNumero(av.peso)
      if (peso === null) {
        return {
          campo: idAvaliacao(av.chave, 'peso'),
          mensagem: 'Informe o peso da avaliação no RA (1 se todas valem igual).',
        }
      }
      const erro = erroAvaliacao({ peso, valorMaximo, nota: null })
      if (erro) return { campo: idAvaliacao(av.chave, 'peso'), mensagem: erro }
      if (av.data !== '' && !dataValida(av.data)) {
        return { campo: idAvaliacao(av.chave, 'data'), mensagem: 'Informe uma data válida ou deixe em branco.' }
      }
    }
  }
  return null
}

export function conferirRegra(form: Formulario): ErroCampo | null {
  return form.usarRegraPadrao ? null : erroRegra(form.regra)
}

/**
 * Primeiro erro dos campos de uma regra (a própria da matéria ou a padrão do painel).
 * Barra o mesmo que lerRegra, no carregamento. `ids` diz a que campos o erro aponta.
 */
export function erroRegra(r: RegraForm, ids: IdsRegra = IDS_REGRA_MATERIA): ErroCampo | null {
  const media = lerNumero(r.mediaMinima)
  if (media === null || media > NOTA_MAXIMA) {
    return { campo: ids.media, mensagem: `Informe a média mínima, de 0 a ${NOTA_MAXIMA} (ex.: 7,0).` }
  }
  const frequencia = lerNumero(r.frequenciaMinima)
  if (frequencia === null || frequencia > 100) {
    return { campo: ids.frequencia, mensagem: 'Informe a frequência mínima em %, de 0 a 100 (ex.: 75).' }
  }
  if (r.temRecuperacao) {
    const notaMinima = lerNumero(r.notaMinima)
    if (notaMinima === null || notaMinima > media) {
      return {
        campo: ids.notaMinima,
        mensagem: 'Informe a nota mínima para a recuperação, de 0 até a média mínima (ex.: 4,0).',
      }
    }
    const teto = lerNumero(r.teto)
    if (teto === null || teto > NOTA_MAXIMA) {
      return { campo: ids.teto, mensagem: `Informe a nota máxima da recuperação, de 0 a ${NOTA_MAXIMA} (ex.: 7,0).` }
    }
  }
  return null
}

/**
 * Conferência de cada passo, na ordem de PASSOS (o último, revisar, confere tudo).
 * `ocupados` e `jaSalvos` vão para a conferência do choque de horários.
 */
export function conferirPasso(
  passo: number,
  form: Formulario,
  ocupados: HorarioOcupado[] = [],
  jaSalvos: HorarioForm[] = [],
): ErroCampo | null {
  switch (passo) {
    case 0:
      return conferirMateria(form, ocupados, jaSalvos)
    case 1:
      return conferirRAs(form)
    case 2:
      return conferirAvaliacoes(form)
    case 3:
      return conferirRegra(form)
    default:
      return conferirMateria(form, ocupados, jaSalvos) ?? conferirRAs(form) ?? conferirAvaliacoes(form) ?? conferirRegra(form)
  }
}

/** Em que passo está o campo do erro (para o revisar levar até ele). */
export function passoDoErro(
  form: Formulario,
  ocupados: HorarioOcupado[] = [],
  jaSalvos: HorarioForm[] = [],
): number | null {
  for (let passo = 0; passo < 4; passo++) {
    if (conferirPasso(passo, form, ocupados, jaSalvos)) return passo
  }
  return null
}

// ---------- Pesos ----------

/** Soma dos pesos que já são números; os inválidos contam 0. */
export function somaPesos(ras: Pick<RAForm, 'peso'>[]): number {
  return limpar(ras.reduce((soma, ra) => soma + (lerNumero(ra.peso) ?? 0), 0))
}

/** "40%" (fração da nota final), ou null se o peso ainda não é um número ou a soma é 0. */
export function porcentagemRA(ra: Pick<RAForm, 'peso'>, ras: Pick<RAForm, 'peso'>[]): string | null {
  const peso = lerNumero(ra.peso)
  const soma = somaPesos(ras)
  if (peso === null || soma === 0) return null
  return formatarPorcentagem(peso / soma)
}

/** Se as duas regras dizem o mesmo (a ordem dos campos no JSON não importa). */
export function regrasIguais(a: RegraAprovacao, b: RegraAprovacao): boolean {
  return (
    a.mediaMinima === b.mediaMinima &&
    a.frequenciaMinima === b.frequenciaMinima &&
    a.arredondarUmaCasa === b.arredondarUmaCasa &&
    a.recuperacao?.notaMinima === b.recuperacao?.notaMinima &&
    a.recuperacao?.teto === b.recuperacao?.teto
  )
}

// ---------- Montar a matéria ----------

/** Número de um campo já conferido. */
function numero(texto: string): number {
  return lerNumero(texto) ?? 0
}

export function montarRegra(r: RegraForm): RegraAprovacao {
  const regra: RegraAprovacao = {
    mediaMinima: numero(r.mediaMinima),
    frequenciaMinima: limpar(numero(r.frequenciaMinima) / 100),
    arredondarUmaCasa: r.arredondarUmaCasa,
  }
  if (r.temRecuperacao) regra.recuperacao = { notaMinima: numero(r.notaMinima), teto: numero(r.teto) }
  return regra
}

/**
 * A matéria pronta para a ação 'materia/adicionar'. Só chamar depois de conferirPasso(4)
 * dar null. Sem notas, faltas nem pontos extras; com a regra padrão, fica sem o campo `regra`.
 */
export function montarMateria(form: Formulario, id: string = novoId()): Materia {
  const ras: ResultadoAprendizagem[] = form.ras.map((ra) => ({
    id: ra.id ?? ra.chave,
    nome: ra.nome.trim(),
    peso: numero(ra.peso),
    avaliacoes: ra.avaliacoes.map((av) => {
      const avaliacao: Avaliacao = {
        id: av.id ?? av.chave,
        nome: av.nome.trim(),
        peso: numero(av.peso),
        valorMaximo: numero(av.valorMaximo),
        nota: null,
      }
      if (av.data !== '') avaliacao.data = av.data
      return avaliacao
    }),
    recuperacaoNoSemestre: ra.recuperacaoNoSemestre,
    notaRecuperacao: null,
  }))
  const materia: Materia = {
    id,
    nome: form.nome.trim(),
    professor: form.professor.trim(),
    horarios: form.horarios.map((h) => ({ dia: h.dia, inicio: h.inicio, fim: h.fim, aulas: numero(h.aulas) })),
    cargaHoraria: numero(form.cargaHoraria),
    ras,
    pontosExtras: [],
    faltas: [],
  }
  if (!form.usarRegraPadrao) materia.regra = montarRegra(form.regra)
  return materia
}

// ---------- Editar uma matéria que já existe ----------
// O formulário começa com a matéria e guarda os ids dela: ao salvar, dá para saber
// que RA e que avaliação continuam lá e manter as notas deles. Os ids de avaliação só
// são únicos dentro do RA, então a avaliação é sempre procurada dentro do RA dela.

/**
 * Um horário salvo nos campos do formulário. Se bate com a tabela da PUC-PR, abre
 * nas aulas, com o número de aulas da tabela (horário antigo pode não ter o número).
 */
function horarioParaForm(h: Horario): Pick<HorarioForm, 'aulas' | 'aulasManual' | 'modo'> {
  const bate = aulasDaTabela(h)
  if (bate) return { aulas: String(bate.ultima - bate.primeira + 1), aulasManual: false, modo: 'aulas' }
  return { aulas: h.aulas === undefined ? '' : String(h.aulas), aulasManual: h.aulas !== undefined, modo: 'horas' }
}

/** O formulário preenchido com a matéria, para editar. */
export function materiaParaForm(materia: Materia, regraPadrao: RegraAprovacao): Formulario {
  return {
    nome: materia.nome,
    professor: materia.professor,
    cargaHoraria: String(materia.cargaHoraria),
    horarios: materia.horarios.map((h) => ({
      chave: novoId(),
      dia: h.dia,
      inicio: h.inicio,
      // Horário salvo antes de existir o fim: fica vazio, e o formulário pede para completar.
      fim: h.fim ?? '',
      ...horarioParaForm(h),
    })),
    ras: materia.ras.map((ra) => ({
      chave: novoId(),
      id: ra.id,
      nome: ra.nome,
      peso: paraTexto(ra.peso),
      recuperacaoNoSemestre: ra.recuperacaoNoSemestre,
      avaliacoes: ra.avaliacoes.map((av) => ({
        chave: novoId(),
        id: av.id,
        nome: av.nome,
        valorMaximo: paraTexto(av.valorMaximo),
        peso: paraTexto(av.peso),
        data: av.data ?? '',
      })),
    })),
    usarRegraPadrao: materia.regra === undefined,
    regra: regraParaForm(materia.regra ?? regraPadrao),
  }
}

/**
 * A matéria editada, pronta para 'materia/substituir'. Mantém as notas dos RAs e das
 * avaliações que continuam, e as faltas e os pontos extras (que o formulário não mexe).
 * Só chamar depois de conferirPasso(4) e erroNotasNaEdicao darem null.
 */
export function aplicarEdicao(original: Materia, form: Formulario): Materia {
  const nova = montarMateria(form, original.id)
  const rasAntes = new Map(original.ras.map((ra) => [ra.id, ra]))
  const idsQueFicam = new Set(nova.ras.map((ra) => ra.id))
  return {
    ...nova,
    ras: nova.ras.map((ra) => {
      const antes = rasAntes.get(ra.id)
      const notas = new Map(antes?.avaliacoes.map((av) => [av.id, av.nota]))
      return {
        ...ra,
        notaRecuperacao: antes?.notaRecuperacao ?? null,
        avaliacoes: ra.avaliacoes.map((av) => ({ ...av, nota: notas.get(av.id) ?? null })),
      }
    }),
    faltas: original.faltas,
    // Os extras de um RA removido saem junto com ele (perdasDaEdicao avisa).
    pontosExtras: original.pontosExtras.filter((e) => e.raId === undefined || idsQueFicam.has(e.raId)),
  }
}

/** As notas que somem ao salvar, porque a avaliação ou o RA delas foi removido. */
export function perdasDaEdicao(original: Materia, form: Formulario): string[] {
  const rasQueFicam = new Map(form.ras.flatMap((ra) => (ra.id === undefined ? [] : [[ra.id, ra] as const])))
  const perdas: string[] = []
  for (const ra of original.ras) {
    const fica = rasQueFicam.get(ra.id)
    const avaliacoesQueFicam = new Set(fica?.avaliacoes.map((av) => av.id))
    for (const av of ra.avaliacoes) {
      if (av.nota !== null && !avaliacoesQueFicam.has(av.id)) {
        perdas.push(`Nota ${formatarNota(av.nota)} de ${av.nome} (${ra.nome})`)
      }
    }
    if (ra.notaRecuperacao !== null && !fica) {
      perdas.push(`Recuperação ${formatarNota(ra.notaRecuperacao)} de ${ra.nome}`)
    }
    if (!fica) {
      for (const extra of original.pontosExtras.filter((e) => e.raId === ra.id)) {
        perdas.push(`Ponto extra +${formatarNota(extra.pontos)} de ${ra.nome} (${extra.comentario})`)
      }
    }
  }
  return perdas
}

/**
 * A avaliação que já tem nota não pode passar a valer menos que ela: a nota 8,0 de
 * uma prova de 10 não cabe numa prova de 3,0. Aponta o campo do valor.
 */
export function erroNotasNaEdicao(original: Materia, form: Formulario): ErroCampo | null {
  const rasAntes = new Map(original.ras.map((ra) => [ra.id, ra]))
  for (const ra of form.ras) {
    const antes = ra.id === undefined ? undefined : rasAntes.get(ra.id)
    for (const av of ra.avaliacoes) {
      const nota = antes?.avaliacoes.find((a) => a.id === av.id)?.nota
      const valor = lerNumero(av.valorMaximo)
      if (nota != null && valor !== null && nota > valor) {
        return {
          campo: idAvaliacao(av.chave, 'valor'),
          mensagem: `Esta avaliação já tem nota ${formatarNota(nota)}; ela não pode valer menos que isso.`,
        }
      }
    }
  }
  return null
}

// ---------- Textos ----------

/** Resumo de uma regra em frases, para a escolha e o revisar. */
export function textoRegra(regra: RegraAprovacao): string[] {
  const frases = [
    `Média mínima ${formatarNota(regra.mediaMinima)} e frequência mínima de ${formatarPorcentagem(regra.frequenciaMinima)}.`,
  ]
  const rec = regra.recuperacao
  if (rec) {
    // "de 4,0 a 6,9": como os planos de ensino escrevem a faixa.
    const ate = limpar(Math.max(rec.notaMinima, regra.mediaMinima - 0.1))
    frases.push(
      `Recuperação para quem fica com nota final de ${formatarNota(rec.notaMinima)} a ${formatarNota(ate)}; ` +
        `a nota da recuperação vale no máximo ${formatarNota(rec.teto)}.`,
    )
  } else {
    frases.push('Sem recuperação.')
  }
  frases.push(
    regra.arredondarUmaCasa
      ? 'A nota final é arredondada para 1 casa antes de comparar.'
      : 'A nota final não é arredondada.',
  )
  return frases
}
