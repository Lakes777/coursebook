/**
 * Tira o "lixo" do ponto flutuante antes de arredondar ou comparar. No JavaScript,
 * (0.1 + 5.8) / 2 dá 2.9499999999999997 e (1 - 0.9) * 80 dá 7.999999999999998;
 * com 12 algarismos significativos eles voltam a ser 2,95 e 8.
 */
export function limpar(n: number): number {
  return Number(n.toPrecision(12))
}
