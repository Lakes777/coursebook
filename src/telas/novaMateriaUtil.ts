import { dataValida } from '../logica/datas'
import { erroCargaHoraria } from '../logica/faltas'
import { novoId } from '../logica/ids'
import { erroAvaliacao, erroRA, NOTA_MAXIMA } from '../logica/notas'
import { formatarNota, formatarPorcentagem, lerNumero, limpar } from '../logica/numeros'
import type { Avaliacao, DiaSemana, Materia, RegraAprovacao, ResultadoAprendizagem } from '../logica/tipos'
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

/** O mesmo formato que o carregamento aceita (validacao.ts). */
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

export interface HorarioForm {
  /** Chave da lista no React e parte do id dos campos. */
  chave: string
  dia: DiaSemana
  inicio: string
}

export interface AvaliacaoForm {
  /** Também vira o id da avaliação salva. */
  chave: string
  nome: string
  valorMaximo: string
  peso: string
  data: string
}

export interface RAForm {
  /** Também vira o id do RA salvo. */
  chave: string
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
export const ID_MEDIA = 'nm-regra-media'
export const ID_FREQUENCIA = 'nm-regra-frequencia'
export const ID_NOTA_MINIMA = 'nm-regra-nota-minima'
export const ID_TETO = 'nm-regra-teto'

export const idHorario = (chave: string, campo: 'dia' | 'inicio') => `nm-horario-${chave}-${campo}`
export const idRA = (chave: string, campo: 'nome' | 'peso') => `nm-ra-${chave}-${campo}`
export const idAvaliacao = (chave: string, campo: 'nome' | 'valor' | 'peso' | 'data') => `nm-av-${chave}-${campo}`

// ---------- Valores iniciais ----------

export function novoHorario(): HorarioForm {
  return { chave: novoId(), dia: 1, inicio: '' }
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

export function conferirMateria(form: Formulario): ErroCampo | null {
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
    if (!HORA.test(h.inicio)) {
      return {
        campo: idHorario(h.chave, 'inicio'),
        mensagem: 'Informe a hora de início no formato HH:MM (ex.: 07:45).',
      }
    }
  }
  return null
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
  if (form.usarRegraPadrao) return null
  const r = form.regra
  const media = lerNumero(r.mediaMinima)
  if (media === null || media > NOTA_MAXIMA) {
    return { campo: ID_MEDIA, mensagem: `Informe a média mínima, de 0 a ${NOTA_MAXIMA} (ex.: 7,0).` }
  }
  const frequencia = lerNumero(r.frequenciaMinima)
  if (frequencia === null || frequencia > 100) {
    return { campo: ID_FREQUENCIA, mensagem: 'Informe a frequência mínima em %, de 0 a 100 (ex.: 75).' }
  }
  if (r.temRecuperacao) {
    const notaMinima = lerNumero(r.notaMinima)
    if (notaMinima === null || notaMinima > media) {
      return {
        campo: ID_NOTA_MINIMA,
        mensagem: 'Informe a nota mínima para a recuperação, de 0 até a média mínima (ex.: 4,0).',
      }
    }
    const teto = lerNumero(r.teto)
    if (teto === null || teto > NOTA_MAXIMA) {
      return { campo: ID_TETO, mensagem: `Informe a nota máxima da recuperação, de 0 a ${NOTA_MAXIMA} (ex.: 7,0).` }
    }
  }
  return null
}

/** Conferência de cada passo, na ordem de PASSOS (o último, revisar, confere tudo). */
export function conferirPasso(passo: number, form: Formulario): ErroCampo | null {
  switch (passo) {
    case 0:
      return conferirMateria(form)
    case 1:
      return conferirRAs(form)
    case 2:
      return conferirAvaliacoes(form)
    case 3:
      return conferirRegra(form)
    default:
      return conferirMateria(form) ?? conferirRAs(form) ?? conferirAvaliacoes(form) ?? conferirRegra(form)
  }
}

/** Em que passo está o campo do erro (para o revisar levar até ele). */
export function passoDoErro(form: Formulario): number | null {
  for (let passo = 0; passo < 4; passo++) {
    if (conferirPasso(passo, form)) return passo
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
    id: ra.chave,
    nome: ra.nome.trim(),
    peso: numero(ra.peso),
    avaliacoes: ra.avaliacoes.map((av) => {
      const avaliacao: Avaliacao = {
        id: av.chave,
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
    horarios: form.horarios.map((h) => ({ dia: h.dia, inicio: h.inicio })),
    cargaHoraria: numero(form.cargaHoraria),
    ras,
    pontosExtras: [],
    faltas: [],
  }
  if (!form.usarRegraPadrao) materia.regra = montarRegra(form.regra)
  return materia
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
