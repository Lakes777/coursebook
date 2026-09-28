import { describe, expect, it } from 'vitest'
import {
  arredondar,
  arredondarParaCima,
  erroAvaliacao,
  erroPontoExtra,
  erroRA,
  naEscala,
  notaDe0a10,
  notaRA,
  situacaoNota,
  totalPontosExtras,
  truncar,
} from '../../src/logica/notas'
import {
  REGRA_PUCPR,
  type Avaliacao,
  type PontoExtra,
  type RegraAprovacao,
  type ResultadoAprendizagem,
} from '../../src/logica/tipos'

let contador = 0
function proximoId(prefixo: string): string {
  contador += 1
  return `${prefixo}${contador}`
}

function av(peso: number, nota: number | null, valorMaximo = 10): Avaliacao {
  const id = proximoId('a')
  return { id, nome: `Avaliação ${id}`, peso, valorMaximo, nota }
}

function ra(
  peso: number,
  avaliacoes: Avaliacao[],
  outros: Partial<ResultadoAprendizagem> = {},
): ResultadoAprendizagem {
  const id = proximoId('ra')
  return {
    id,
    nome: `RA ${id}`,
    peso,
    avaliacoes,
    recuperacaoNoSemestre: false,
    notaRecuperacao: null,
    ...outros,
  }
}

/** Atalho: uma matéria de um RA só, com essas avaliações de peso 1. */
function umRA(...notas: (number | null)[]): ResultadoAprendizagem[] {
  return [ra(1, notas.map((n) => av(1, n)))]
}

const ARREDONDA: RegraAprovacao = { ...REGRA_PUCPR, arredondarUmaCasa: true }
const SEM_RECUPERACAO: RegraAprovacao = {
  mediaMinima: 7,
  frequenciaMinima: 0.75,
  arredondarUmaCasa: false,
}

describe('arredondamento', () => {
  it('arredonda x,x5 para cima apesar do ponto flutuante', () => {
    const media = (0.1 + 5.8) / 2 // deveria ser 2,95
    expect(media).toBe(2.9499999999999997) // o problema existe de verdade
    expect(Math.round(media * 10) / 10).toBe(2.9) // o jeito ingênuo erra
    expect(arredondar(media)).toBe(3)
    expect(arredondar(6.95)).toBe(7)
    expect(arredondar(6.94)).toBe(6.9)
    expect(arredondar(8.25)).toBe(8.3)
  })

  it('arredonda para cima só quando sobra alguma coisa', () => {
    expect(arredondarParaCima(6.01)).toBe(6.1)
    expect(arredondarParaCima(6)).toBe(6)
    expect(arredondarParaCima(0.1 + 0.2)).toBe(0.3) // 0.30000000000000004 não vira 0,4
  })

  it('trunca em 2 casas sem nunca subir', () => {
    expect(truncar(6.996)).toBe(6.99)
    expect(truncar(7)).toBe(7)
    expect(truncar(0.1 + 0.2)).toBe(0.3)
  })
})

describe('escala das avaliações', () => {
  it('converte a nota para 0 a 10', () => {
    expect(notaDe0a10({ nota: 2.4, valorMaximo: 3 })).toBe(8) // sem 7,999...
    expect(notaDe0a10({ nota: 7, valorMaximo: 10 })).toBe(7)
    expect(notaDe0a10({ nota: null, valorMaximo: 3 })).toBeNull()
  })

  it('leva uma nota de 0 a 10 para a escala da avaliação', () => {
    expect(naEscala(7, 3)).toBe(2.1)
    expect(naEscala(6.3, 4)).toBe(2.52)
  })
})

describe('notaRA', () => {
  it('é a média ponderada das avaliações do RA', () => {
    expect(notaRA(ra(1, [av(1, 10), av(3, 6)]), REGRA_PUCPR)).toBe(7)
  })

  it('usa a escala de cada avaliação (POO: 2,5 de 3,0)', () => {
    expect(notaRA(ra(30, [av(1, 2.5, 3)]), REGRA_PUCPR)).toBe(8.33)
    expect(notaRA(ra(30, [av(1, 2.5, 3)]), ARREDONDA)).toBe(8.3)
  })

  it('ignora avaliações sem nota', () => {
    expect(notaRA(ra(1, [av(2, 8), av(2, null)]), REGRA_PUCPR)).toBe(8)
  })

  it('é null sem nenhuma nota', () => {
    expect(notaRA(ra(1, []), REGRA_PUCPR)).toBeNull()
    expect(notaRA(ra(1, [av(1, null)]), REGRA_PUCPR)).toBeNull()
  })

  describe('recuperação: vale a maior nota, com teto', () => {
    it('sobe quando a recuperação é maior', () => {
      expect(notaRA(ra(1, [av(1, 5)], { notaRecuperacao: 6 }), REGRA_PUCPR)).toBe(6)
    })

    it('não desce quando a recuperação é menor', () => {
      expect(notaRA(ra(1, [av(1, 5)], { notaRecuperacao: 4 }), REGRA_PUCPR)).toBe(5)
    })

    it('para no teto de 7,0', () => {
      expect(notaRA(ra(1, [av(1, 5)], { notaRecuperacao: 9 }), REGRA_PUCPR)).toBe(7)
    })

    it('RA recuperado conta 0 na avaliação que ficou sem nota', () => {
      // (8 + 0) / 2 = 4; a recuperação 5 é maior. Na tela e na conta, o RA vale 5.
      expect(notaRA(ra(1, [av(1, 8), av(1, null)], { notaRecuperacao: 5 }), REGRA_PUCPR)).toBe(5)
    })

    it('não vale se a regra não tem recuperação', () => {
      expect(notaRA(ra(1, [av(1, 5)], { notaRecuperacao: 9 }), SEM_RECUPERACAO)).toBe(5)
    })
  })
})

describe('erroAvaliacao', () => {
  it('aceita nota dentro do valor da avaliação e nota ainda não lançada', () => {
    expect(erroAvaliacao({ peso: 1, valorMaximo: 10, nota: 0 })).toBeNull()
    expect(erroAvaliacao({ peso: 1, valorMaximo: 10, nota: 10 })).toBeNull()
    expect(erroAvaliacao({ peso: 1, valorMaximo: 3, nota: 2.5 })).toBeNull()
    expect(erroAvaliacao({ peso: 0, valorMaximo: 10, nota: null })).toBeNull()
  })

  it('recusa nota acima do valor da avaliação', () => {
    expect(erroAvaliacao({ peso: 1, valorMaximo: 3, nota: 3.5 })).toMatch('entre 0 e 3')
  })

  it.each([12, -1, NaN])('recusa a nota %s', (nota) => {
    expect(erroAvaliacao({ peso: 1, valorMaximo: 10, nota })).toMatch('entre 0 e 10')
  })

  it.each([0, -3, NaN])('recusa o valor %s', (valorMaximo) => {
    expect(erroAvaliacao({ peso: 1, valorMaximo, nota: null })).toMatch('valor')
  })

  it.each([-1, NaN, Infinity])('recusa o peso %s', (peso) => {
    expect(erroAvaliacao({ peso, valorMaximo: 10, nota: 5 })).toMatch('peso')
  })
})

describe('erroRA', () => {
  it('aceita peso e recuperação válidos', () => {
    expect(erroRA({ peso: 40, notaRecuperacao: null })).toBeNull()
    expect(erroRA({ peso: 40, notaRecuperacao: 6.5 })).toBeNull()
  })

  it('recusa peso negativo e recuperação fora de 0 a 10', () => {
    expect(erroRA({ peso: -1, notaRecuperacao: null })).toMatch('peso do RA')
    expect(erroRA({ peso: 1, notaRecuperacao: 11 })).toMatch('recuperação')
  })
})

describe('situacaoNota', () => {
  it('sem RAs com peso', () => {
    expect(situacaoNota([], REGRA_PUCPR)).toEqual({ tipo: 'sem-avaliacoes' })
    expect(situacaoNota([ra(0, [av(1, 5)])], REGRA_PUCPR)).toEqual({ tipo: 'sem-avaliacoes' })
  })

  it('RAs ainda sem avaliações: precisa da média em tudo', () => {
    expect(situacaoNota([ra(1, []), ra(1, [])], REGRA_PUCPR)).toEqual({
      tipo: 'possivel',
      media: null,
      notaNecessaria: 7,
    })
  })

  it('POO: soma de RA1 (até 3,0) + RA2 (até 3,0) + RA3 (até 4,0)', () => {
    const ras = [ra(30, [av(1, 2.4, 3)]), ra(30, [av(1, 2.1, 3)]), ra(40, [av(1, null, 4)])]
    // Já tem 2,4 + 2,1 = 4,5 pontos; faltam 2,5 dos 4,0 do RA3 = 6,25 de 10 -> 6,3.
    expect(situacaoNota(ras, REGRA_PUCPR)).toEqual({
      tipo: 'possivel',
      media: 7.5,
      notaNecessaria: 6.3,
    })
    expect(naEscala(6.3, 4)).toBe(2.52) // na prova do RA3: 2,52 de 4,0
  })

  it('com arredondamento ligado, mira em 6,95', () => {
    const ras = [ra(30, [av(1, 2.4, 3)]), ra(30, [av(1, 2.1, 3)]), ra(40, [av(1, null, 4)])]
    // (6,95 - 4,5) / 0,4 = 6,125 -> 6,2
    expect(situacaoNota(ras, ARREDONDA)).toMatchObject({ notaNecessaria: 6.2 })
  })

  it('Filosofia: RAs com pesos 40, 40 e 20', () => {
    const ras = [ra(40, [av(1, 8)]), ra(40, [av(1, null)]), ra(20, [av(1, null)])]
    // 0,4 * 8 = 3,2; faltam 60%: (7 - 3,2) / 0,6 = 6,33 -> 6,4
    expect(situacaoNota(ras, REGRA_PUCPR)).toEqual({
      tipo: 'possivel',
      media: 8,
      notaNecessaria: 6.4,
    })
  })

  it('PSCF: pesos dentro do RA (prova 20% + projeto 80%)', () => {
    const ras = [ra(50, [av(1, 6)]), ra(50, [av(20, 10), av(80, null)])]
    // 0,5*6 + 0,1*10 = 4; o projeto vale 40% da nota final: (7 - 4) / 0,4 = 7,5
    expect(situacaoNota(ras, REGRA_PUCPR)).toEqual({
      tipo: 'possivel',
      media: 6.66,
      notaNecessaria: 7.5,
    })
  })

  it('arredonda a nota necessária para cima', () => {
    // (7*3 - 6,45 - 8) = 6,55 -> 6,6. Com 6,5 a média seria 6,98 e não passaria.
    expect(situacaoNota(umRA(6.45, 8, null), REGRA_PUCPR)).toMatchObject({ notaNecessaria: 6.6 })
  })

  it('aceita precisar de 10 exato', () => {
    expect(situacaoNota([ra(1, [av(1, 4)]), ra(1, [av(1, null)])], REGRA_PUCPR)).toMatchObject({
      tipo: 'possivel',
      notaNecessaria: 10,
    })
  })

  it('quando não dá para passar direto, diz quanto precisa para a recuperação', () => {
    // (7 - 1,5) / 0,5 = 11; para a recuperação: (4 - 1,5) / 0,5 = 5
    expect(situacaoNota([ra(1, [av(1, 3)]), ra(1, [av(1, null)])], REGRA_PUCPR)).toEqual({
      tipo: 'impossivel',
      media: 3,
      notaNecessaria: 11,
      notaParaRecuperacao: 5,
    })
  })

  it('com arredondamento, a meta da recuperação é 3,95', () => {
    // (6,95 - 1,5) / 0,5 = 10,9; (3,95 - 1,5) / 0,5 = 4,9
    expect(situacaoNota([ra(1, [av(1, 3)]), ra(1, [av(1, null)])], ARREDONDA)).toEqual({
      tipo: 'impossivel',
      media: 3,
      notaNecessaria: 10.9,
      notaParaRecuperacao: 4.9,
    })
  })

  it('RA recuperado não tem mais avaliação pendente', () => {
    // O RA recuperado vale 5 (o 8 e o pendente contam 8 e 0 = 4; a recuperação é maior).
    // Só falta o outro RA: (7 - 2,5) / 0,5 = 9
    const ras = [
      ra(1, [av(1, 8), av(1, null)], { notaRecuperacao: 5 }),
      ra(1, [av(1, null)]),
    ]
    expect(situacaoNota(ras, REGRA_PUCPR)).toMatchObject({ tipo: 'possivel', notaNecessaria: 9 })
  })

  it('não fala em recuperação quando nem ela dá mais', () => {
    const situacao = situacaoNota([ra(9, [av(1, 0)]), ra(1, [av(1, null)])], REGRA_PUCPR)
    expect(situacao).toMatchObject({ tipo: 'impossivel' })
    expect(situacao).not.toHaveProperty('notaParaRecuperacao')
  })

  it('não fala em recuperação quando a regra não tem', () => {
    const situacao = situacaoNota([ra(1, [av(1, 3)]), ra(1, [av(1, null)])], SEM_RECUPERACAO)
    expect(situacao).not.toHaveProperty('notaParaRecuperacao')
  })

  it('já aprovado mesmo tirando 0 no que falta', () => {
    // 0,75 * 10 = 7,5 mesmo com 0 no último RA
    expect(situacaoNota([ra(3, [av(1, 10)]), ra(1, [av(1, null)])], REGRA_PUCPR)).toEqual({
      tipo: 'aprovado',
      media: 10,
    })
  })

  it('avaliação de peso 0 sem nota não conta como pendente', () => {
    const ras = [ra(1, [av(1, 5), av(0, null)])]
    expect(situacaoNota(ras, REGRA_PUCPR)).toEqual({
      tipo: 'recuperacao',
      media: 5,
      teto: 7,
      ras: [ras[0].id],
    })
  })

  describe('com todas as notas lançadas', () => {
    it('aprovado com a média', () => {
      expect(situacaoNota(umRA(7, 7), REGRA_PUCPR)).toEqual({ tipo: 'aprovado', media: 7 })
    })

    it('6,95 não passa sem arredondamento...', () => {
      expect(situacaoNota(umRA(6.95), REGRA_PUCPR)).toMatchObject({
        tipo: 'recuperacao',
        media: 6.95,
      })
    })

    it('...e passa com arredondamento ligado', () => {
      expect(situacaoNota(umRA(6.95), ARREDONDA)).toEqual({ tipo: 'aprovado', media: 7 })
    })

    it('na recuperação, lista só os RAs abaixo de 7,0', () => {
      const bom = ra(50, [av(1, 9)])
      const ruim = ra(50, [av(1, 4)])
      expect(situacaoNota([bom, ruim], REGRA_PUCPR)).toEqual({
        tipo: 'recuperacao',
        media: 6.5,
        teto: 7,
        ras: [ruim.id],
      })
    })

    it('a recuperação de um RA pode aprovar', () => {
      // RA2: maior entre 4 e a recuperação 8 (teto 7) = 7; final (9 + 7) / 2 = 8
      const ras = [ra(50, [av(1, 9)]), ra(50, [av(1, 4)], { notaRecuperacao: 8 })]
      expect(situacaoNota(ras, REGRA_PUCPR)).toEqual({ tipo: 'aprovado', media: 8 })
    })

    it('recuperação feita que não chega em 7,0 reprova (não fica em recuperação para sempre)', () => {
      expect(situacaoNota([ra(1, [av(1, 4)], { notaRecuperacao: 5 })], REGRA_PUCPR)).toEqual({
        tipo: 'reprovado',
        media: 5,
      })
    })

    it('lista só os RAs que ainda não foram recuperados', () => {
      const recuperado = ra(50, [av(1, 5)], { notaRecuperacao: 6 })
      const falta = ra(50, [av(1, 5)])
      // (6 + 5) / 2 = 5,5
      expect(situacaoNota([recuperado, falta], REGRA_PUCPR)).toEqual({
        tipo: 'recuperacao',
        media: 5.5,
        teto: 7,
        ras: [falta.id],
      })
    })

    it('recuperação menor que a nota do RA não derruba a nota final', () => {
      const ras = [ra(50, [av(1, 9)]), ra(50, [av(1, 6)], { notaRecuperacao: 3 })]
      expect(situacaoNota(ras, REGRA_PUCPR)).toEqual({ tipo: 'aprovado', media: 7.5 })
    })

    it('com arredondamento, RA com 6,95 conta como 7,0 e não precisa de recuperação', () => {
      const quase = ra(50, [av(1, 6.95)])
      const baixo = ra(50, [av(1, 5)])
      // (6,95 + 5) / 2 = 5,975 -> 6,0
      expect(situacaoNota([quase, baixo], ARREDONDA)).toEqual({
        tipo: 'recuperacao',
        media: 6,
        teto: 7,
        ras: [baixo.id],
      })
    })

    it('abaixo de 4,0 reprova direto', () => {
      expect(situacaoNota(umRA(3.9), REGRA_PUCPR)).toEqual({ tipo: 'reprovado', media: 3.9 })
    })

    it('sem recuperação na regra, abaixo da média reprova', () => {
      expect(situacaoNota(umRA(6.9), SEM_RECUPERACAO)).toEqual({ tipo: 'reprovado', media: 6.9 })
    })
  })

  it('respeita outra média mínima', () => {
    const regra: RegraAprovacao = { ...SEM_RECUPERACAO, mediaMinima: 6 }
    // (6 - 2,5) / 0,5 = 7
    expect(situacaoNota([ra(1, [av(1, 5)]), ra(1, [av(1, null)])], regra)).toMatchObject({
      notaNecessaria: 7,
    })
  })

  it('a nota necessária é exatamente a menor que aprova (várias combinações)', () => {
    // Para cada combinação: tirar a nota necessária no que falta aprova, e tirar
    // 0,1 a menos não aprova. Pega a conta pedindo mais ou menos que o certo,
    // com e sem arredondamento, com pontos extras e com avaliações de valor 3 e 4.
    let conferidas = 0
    for (const regra of [REGRA_PUCPR, ARREDONDA]) {
      for (const extras of [0, 0.05, 0.25, 0.5]) {
        for (const valorMaximo of [10, 3, 4]) {
          for (let feita = 0; feita <= 100; feita += 1) {
            for (const [pesoA, pesoB] of [
              [1, 1],
              [2, 3],
              [3, 1],
            ]) {
              const nota = feita / 10
              // `pendente` vai de 0 a 10 (null = ainda sem nota) e é levada para a escala
              // de cada avaliação. Duas estruturas: a simples (um pendente) e uma difícil,
              // com duas pendentes de pesos 20/80 no mesmo RA e um RA ainda sem avaliações.
              const pend = (peso: number, pendente: number | null, valor = 10) =>
                av(peso, pendente === null ? null : naEscala(pendente, valor), valor)
              const estruturas = [
                (pendente: number | null) => [
                  ra(pesoA, [av(1, nota)]),
                  ra(pesoB, [pend(1, pendente, valorMaximo)]),
                ],
                (pendente: number | null) => [
                  ra(pesoA, [av(1, nota)]),
                  ra(pesoB, [pend(20, pendente), pend(80, pendente, valorMaximo)]),
                  ra(1, pendente === null ? [] : [pend(1, pendente)]),
                ],
              ]
              for (const montar of estruturas) {
                const situacao = situacaoNota(montar(null), regra, extras)
                if (situacao.tipo !== 'possivel') continue
                const tirando = (n: number) => situacaoNota(montar(n), regra, extras).tipo
                expect(tirando(situacao.notaNecessaria)).toBe('aprovado')
                expect(tirando(arredondar(situacao.notaNecessaria - 0.1))).not.toBe('aprovado')
                conferidas += 1
              }
            }
          }
        }
      }
    }
    expect(conferidas).toBeGreaterThan(6000)
  })
})

function extra(pontos: number, comentario = 'Lista extra'): PontoExtra {
  return { id: proximoId('e'), pontos, comentario }
}

describe('pontos extras', () => {
  it('somam os pontos da matéria sem lixo de ponto flutuante', () => {
    expect(totalPontosExtras([])).toBe(0)
    expect(totalPontosExtras([extra(0.1), extra(0.2)])).toBe(0.3)
  })

  it('entram na média final', () => {
    // 6,6 + 0,4 = 7,0
    expect(situacaoNota(umRA(6.6), REGRA_PUCPR, 0.4)).toEqual({ tipo: 'aprovado', media: 7 })
  })

  it('tiram alguém do reprovado', () => {
    const ras = umRA(3.7)
    expect(situacaoNota(ras, REGRA_PUCPR, 0.3)).toEqual({
      tipo: 'recuperacao',
      media: 4,
      teto: 7,
      ras: [ras[0].id],
    })
  })

  it('diminuem a nota necessária', () => {
    // Sem extras precisaria de 9; com 0,5: (7 - 0,5 - 2,5) / 0,5 = 8
    expect(situacaoNota([ra(1, [av(1, 5)]), ra(1, [av(1, null)])], REGRA_PUCPR, 0.5)).toEqual({
      tipo: 'possivel',
      media: 5.5,
      notaNecessaria: 8,
    })
  })

  it('podem transformar "impossível" em "possível"', () => {
    const ras = [ra(1, [av(1, 3)]), ra(1, [av(1, null)])]
    expect(situacaoNota(ras, REGRA_PUCPR)).toMatchObject({ tipo: 'impossivel' })
    // (7 - 0,6 - 1,5) / 0,5 = 9,8
    expect(situacaoNota(ras, REGRA_PUCPR, 0.6)).toMatchObject({
      tipo: 'possivel',
      notaNecessaria: 9.8,
    })
  })

  it('a média com extras não passa de 10', () => {
    expect(situacaoNota(umRA(9.8), REGRA_PUCPR, 0.5)).toEqual({ tipo: 'aprovado', media: 10 })
  })

  it('sozinhos podem garantir a aprovação antes de sair qualquer nota', () => {
    expect(situacaoNota(umRA(null), REGRA_PUCPR, 7)).toEqual({ tipo: 'aprovado', media: 7 })
  })

  it('com arredondamento, arredonda a média uma vez só, depois de somar os extras', () => {
    // 6,66 + 0,25 = 6,91 -> 6,9. Arredondar antes (6,7) e depois (6,95 -> 7,0)
    // mostraria "média 7,0" para quem ainda não passou.
    expect(situacaoNota(umRA(6.66, null), ARREDONDA, 0.25)).toMatchObject({
      tipo: 'possivel',
      media: 6.9,
    })
    expect(situacaoNota(umRA(6.66), ARREDONDA, 0.25)).toMatchObject({
      tipo: 'recuperacao',
      media: 6.9,
    })
  })

  it('sem arredondamento, mostra 2 casas', () => {
    expect(situacaoNota(umRA(6.66), REGRA_PUCPR, 0.25)).toMatchObject({ media: 6.91 })
  })

  describe('erroPontoExtra', () => {
    it('aceita pontos com comentário', () => {
      expect(erroPontoExtra({ pontos: 0.3, comentario: 'Lista de exercícios extra' })).toBeNull()
    })

    it.each([0, -0.1, 10.1, NaN])('recusa %s pontos', (pontos) => {
      expect(erroPontoExtra({ pontos, comentario: 'Lista' })).toMatch('maiores que 0')
    })

    it('exige o comentário dizendo de onde vieram', () => {
      expect(erroPontoExtra({ pontos: 0.3, comentario: '   ' })).toMatch('de onde vieram')
    })

    it('limita o tamanho do comentário', () => {
      expect(erroPontoExtra({ pontos: 0.3, comentario: 'a'.repeat(201) })).toMatch('200')
      expect(erroPontoExtra({ pontos: 0.3, comentario: 'a'.repeat(200) })).toBeNull()
    })
  })
})
