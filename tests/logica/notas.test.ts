import { describe, expect, it } from 'vitest'
import {
  arredondar,
  arredondarParaCima,
  erroAvaliacao,
  erroPontoExtra,
  mediaPonderada,
  situacaoNota,
  totalPontosExtras,
} from '../../src/logica/notas'
import {
  REGRA_PUCPR,
  type Avaliacao,
  type PontoExtra,
  type RegraAprovacao,
} from '../../src/logica/tipos'

let contador = 0
function av(peso: number, nota: number | null): Avaliacao {
  contador += 1
  return { id: `a${contador}`, nome: `Avaliação ${contador}`, peso, nota }
}

const SEM_RECUPERACAO: RegraAprovacao = { mediaMinima: 7, frequenciaMinima: 0.75 }

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
})

describe('mediaPonderada', () => {
  it('usa os pesos', () => {
    expect(mediaPonderada([av(1, 10), av(3, 6)])).toBe(7)
  })

  it('ignora avaliações sem nota', () => {
    expect(mediaPonderada([av(2, 8), av(2, null)])).toBe(8)
  })

  it('dá o mesmo resultado com pesos em escalas diferentes', () => {
    const pequenos = mediaPonderada([av(1, 5), av(2, 8)])
    const grandes = mediaPonderada([av(33.3, 5), av(66.6, 8)])
    expect(pequenos).toBe(grandes)
  })

  it('é null sem nenhuma nota', () => {
    expect(mediaPonderada([])).toBeNull()
    expect(mediaPonderada([av(1, null)])).toBeNull()
  })
})

describe('erroAvaliacao', () => {
  it('aceita nota de 0 a 10 e nota ainda não lançada', () => {
    expect(erroAvaliacao({ peso: 1, nota: 0 })).toBeNull()
    expect(erroAvaliacao({ peso: 1, nota: 10 })).toBeNull()
    expect(erroAvaliacao({ peso: 0, nota: null })).toBeNull()
  })

  it.each([12, -1, NaN])('recusa a nota %s', (nota) => {
    expect(erroAvaliacao({ peso: 1, nota })).toMatch('entre 0 e 10')
  })

  it.each([-1, NaN, Infinity])('recusa o peso %s', (peso) => {
    expect(erroAvaliacao({ peso, nota: 5 })).toMatch('peso')
  })
})

describe('situacaoNota', () => {
  it('sem avaliações cadastradas', () => {
    expect(situacaoNota([], REGRA_PUCPR)).toEqual({ tipo: 'sem-avaliacoes' })
  })

  it('sem nenhuma nota ainda: precisa da média em tudo', () => {
    expect(situacaoNota([av(1, null), av(1, null)], REGRA_PUCPR)).toEqual({
      tipo: 'possivel',
      media: null,
      notaNecessaria: 7,
    })
  })

  it('conta com o arredondamento da média final', () => {
    // Com 5 e 8,9 a média é 6,95, que arredonda para 7,0: não precisa de 9.
    expect(situacaoNota([av(1, 5), av(1, null)], REGRA_PUCPR)).toEqual({
      tipo: 'possivel',
      media: 5,
      notaNecessaria: 8.9,
    })
  })

  it('divide o que falta entre várias avaliações pendentes, pelos pesos', () => {
    // 4*2 = 8 pontos; faltam pesos 1 + 3; (6,95*6 - 8) / 4 = 8,425 -> 8,5
    const situacao = situacaoNota([av(2, 4), av(1, null), av(3, null)], REGRA_PUCPR)
    expect(situacao).toMatchObject({ tipo: 'possivel', notaNecessaria: 8.5 })
  })

  it('arredonda a nota necessária para cima', () => {
    // (6,95*3 - 6,4 - 8) = 6,45 -> 6,5. Com 6,4 a média seria 6,93 -> 6,9 e não passaria.
    expect(situacaoNota([av(1, 6.4), av(1, 8), av(1, null)], REGRA_PUCPR)).toMatchObject({
      notaNecessaria: 6.5,
    })
  })

  it('aceita precisar de 10 exato', () => {
    // 3,9 + 10 = 13,9 / 2 = 6,95 -> 7,0
    expect(situacaoNota([av(1, 3.9), av(1, null)], REGRA_PUCPR)).toMatchObject({
      tipo: 'possivel',
      notaNecessaria: 10,
    })
  })

  it('quando não dá para passar direto, diz quanto precisa para a recuperação', () => {
    // Para a recuperação: (3,95*2 - 3) = 4,9; e 3 + 4,9 = 3,95 -> 4,0
    expect(situacaoNota([av(1, 3), av(1, null)], REGRA_PUCPR)).toEqual({
      tipo: 'impossivel',
      media: 3,
      notaNecessaria: 10.9,
      notaParaRecuperacao: 4.9,
    })
  })

  it('não fala em recuperação quando nem ela dá mais', () => {
    const situacao = situacaoNota([av(9, 0), av(1, null)], REGRA_PUCPR)
    expect(situacao).toMatchObject({ tipo: 'impossivel' })
    expect(situacao).not.toHaveProperty('notaParaRecuperacao')
  })

  it('não fala em recuperação quando a regra não tem', () => {
    const situacao = situacaoNota([av(1, 3), av(1, null)], SEM_RECUPERACAO)
    expect(situacao).not.toHaveProperty('notaParaRecuperacao')
  })

  it('já aprovado mesmo tirando 0 no que falta', () => {
    // 10 com peso 3 = 30; com 0 na última (peso 1): 30/4 = 7,5
    expect(situacaoNota([av(3, 10), av(1, null)], REGRA_PUCPR)).toEqual({
      tipo: 'aprovado',
      media: 10,
    })
  })

  it('avaliação de peso 0 sem nota não conta como pendente', () => {
    // Antes dava "precisa de Infinity"; o certo é olhar só o que vale nota.
    expect(situacaoNota([av(1, 5), av(0, null)], REGRA_PUCPR)).toEqual({
      tipo: 'recuperacao',
      media: 5,
      teto: 7,
    })
  })

  describe('com todas as notas lançadas', () => {
    it('aprovado com a média', () => {
      expect(situacaoNota([av(1, 7), av(1, 7)], REGRA_PUCPR)).toEqual({ tipo: 'aprovado', media: 7 })
    })

    it('6,95 arredonda para 7,0 e passa', () => {
      expect(situacaoNota([av(1, 6.95)], REGRA_PUCPR)).toEqual({ tipo: 'aprovado', media: 7 })
    })

    it('entre 4,0 e 6,9 vai para a recuperação com teto 7,0 (PUC-PR)', () => {
      expect(situacaoNota([av(1, 6.9)], REGRA_PUCPR)).toEqual({
        tipo: 'recuperacao',
        media: 6.9,
        teto: 7,
      })
      expect(situacaoNota([av(1, 4)], REGRA_PUCPR)).toMatchObject({ tipo: 'recuperacao' })
    })

    it('abaixo de 4,0 reprova direto', () => {
      expect(situacaoNota([av(1, 3.9)], REGRA_PUCPR)).toEqual({ tipo: 'reprovado', media: 3.9 })
    })

    it('sem recuperação na regra, abaixo da média reprova', () => {
      expect(situacaoNota([av(1, 6.9)], SEM_RECUPERACAO)).toEqual({ tipo: 'reprovado', media: 6.9 })
    })
  })

  it('respeita outra média mínima', () => {
    const regra: RegraAprovacao = { mediaMinima: 6, frequenciaMinima: 0.75 }
    // (5,95*2 - 5) = 6,9
    expect(situacaoNota([av(1, 5), av(1, null)], regra)).toMatchObject({ notaNecessaria: 6.9 })
  })

  it('a nota necessária é exatamente a menor que aprova (várias combinações)', () => {
    // Para cada combinação: tirar a nota necessária em tudo que falta aprova,
    // e tirar 0,1 a menos não aprova. Isso pega a conta pedindo mais ou menos que o certo.
    const pesos = [1, 2, 3]
    let conferidas = 0
    for (const extras of [0, 0.05, 0.25, 0.3, 0.5]) {
      for (let feita = 0; feita <= 100; feita += 1) {
        for (const pesoFeita of pesos) {
          for (const pesoFalta of pesos) {
            const nota = feita / 10
            const situacao = situacaoNota(
              [av(pesoFeita, nota), av(pesoFalta, null)],
              REGRA_PUCPR,
              extras,
            )
            if (situacao.tipo !== 'possivel') continue
            const tirando = (n: number) =>
              situacaoNota([av(pesoFeita, nota), av(pesoFalta, n)], REGRA_PUCPR, extras).tipo
            expect(tirando(situacao.notaNecessaria)).toBe('aprovado')
            expect(tirando(arredondar(situacao.notaNecessaria - 0.1))).not.toBe('aprovado')
            conferidas += 1
          }
        }
      }
    }
    expect(conferidas).toBeGreaterThan(2500)
  })
})

function extra(pontos: number, comentario = 'Lista extra'): PontoExtra {
  contador += 1
  return { id: `e${contador}`, pontos, comentario }
}

describe('pontos extras', () => {
  it('somam os pontos da matéria sem lixo de ponto flutuante', () => {
    expect(totalPontosExtras([])).toBe(0)
    expect(totalPontosExtras([extra(0.1), extra(0.2)])).toBe(0.3)
  })

  it('entram na média final', () => {
    // 6,6 + 0,4 = 7,0
    expect(situacaoNota([av(1, 6.6)], REGRA_PUCPR, 0.4)).toEqual({ tipo: 'aprovado', media: 7 })
  })

  it('tiram alguém da recuperação ou do reprovado', () => {
    expect(situacaoNota([av(1, 3.7)], REGRA_PUCPR, 0.3)).toEqual({
      tipo: 'recuperacao',
      media: 4,
      teto: 7,
    })
  })

  it('diminuem a nota necessária', () => {
    // Sem extras precisaria de 8,9; com 0,5: (6,45*2 - 5) = 7,9
    expect(situacaoNota([av(1, 5), av(1, null)], REGRA_PUCPR, 0.5)).toEqual({
      tipo: 'possivel',
      media: 5.5,
      notaNecessaria: 7.9,
    })
  })

  it('podem transformar "impossível" em "possível"', () => {
    // Sem extras: 3,8 precisa de 10,1. Com 0,2: (6,75*2 - 3,8) = 9,7
    expect(situacaoNota([av(1, 3.8), av(1, null)], REGRA_PUCPR)).toMatchObject({
      tipo: 'impossivel',
    })
    expect(situacaoNota([av(1, 3.8), av(1, null)], REGRA_PUCPR, 0.2)).toMatchObject({
      tipo: 'possivel',
      notaNecessaria: 9.7,
    })
  })

  it('arredonda a média uma vez só, depois de somar os extras', () => {
    // 6,66 + 0,25 = 6,91 -> 6,9. Arredondar antes (6,7) e depois (6,95 -> 7,0)
    // mostraria "média 7,0" para quem ainda não passou.
    expect(situacaoNota([av(1, 6.66), av(1, null)], REGRA_PUCPR, 0.25)).toMatchObject({
      tipo: 'possivel',
      media: 6.9,
    })
    expect(situacaoNota([av(1, 6.66)], REGRA_PUCPR, 0.25)).toEqual({
      tipo: 'recuperacao',
      media: 6.9,
      teto: 7,
    })
  })

  it('a média com extras não passa de 10', () => {
    expect(situacaoNota([av(1, 9.8)], REGRA_PUCPR, 0.5)).toEqual({ tipo: 'aprovado', media: 10 })
  })

  it('sozinhos podem garantir a aprovação antes de sair qualquer nota', () => {
    expect(situacaoNota([av(1, null)], REGRA_PUCPR, 7)).toEqual({ tipo: 'aprovado', media: 7 })
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
