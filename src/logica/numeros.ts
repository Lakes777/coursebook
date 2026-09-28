/**
 * Tira o "lixo" do ponto flutuante antes de arredondar ou comparar. No JavaScript,
 * (0.1 + 5.8) / 2 dá 2.9499999999999997 e (1 - 0.9) * 80 dá 7.999999999999998;
 * com 12 algarismos significativos eles voltam a ser 2,95 e 8.
 */
export function limpar(n: number): number {
  return Number(n.toPrecision(12))
}

const NOTA = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
const PORCENTAGEM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const INTEIRO_OU_DECIMAL = /^\d+([.,]\d+)?$/

/**
 * Nota ou peso como aparece na tela, com vírgula e pelo menos 1 casa: 7 -> "7,0",
 * 6.99 -> "6,99". Não arredonda por conta própria além de 2 casas: a lógica de notas
 * já devolve o valor arredondado ou truncado conforme a regra.
 */
export function formatarNota(n: number): string {
  return NOTA.format(n)
}

/**
 * Porcentagem com até 1 casa, cortada (sem arredondar): 0.75 -> "75%", 0.925 -> "92,5%".
 * Arredondar mostraria 74,96% como "75%" ao lado de "reprovado por faltas".
 */
export function formatarPorcentagem(fracao: number): string {
  return `${PORCENTAGEM.format(Math.floor(limpar(fracao * 1000)) / 10)}%`
}

/**
 * Lê o número digitado num campo: aceita "7,5", "7.5" e espaços nas pontas.
 * Devolve null se não for um número simples (vazio, "7,5,1", "1.000,5", "-1", "abc").
 */
export function lerNumero(texto: string): number | null {
  const limpo = texto.trim()
  if (!INTEIRO_OU_DECIMAL.test(limpo)) return null
  return Number(limpo.replace(',', '.'))
}
