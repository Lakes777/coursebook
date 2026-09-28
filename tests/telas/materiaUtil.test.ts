import { describe, expect, it } from 'vitest'
import type { SituacaoNota } from '../../src/logica/notas'
import { REGRA_PUCPR, type ResultadoAprendizagem } from '../../src/logica/tipos'
import {
  dicaAvaliacao,
  erroDaFalta,
  erroDoPontoExtra,
  explicacaoNota,
  faltasOrdenadas,
  fracaoDoRA,
  lerCampoNumero,
  lerNotaDigitada,
  necessariaNaEscala,
  notaNoCampo,
  textoHorarios,
  textoRegra,
} from '../../src/telas/materiaUtil'

const ra = (id: string, peso: number): ResultadoAprendizagem => ({
  id,
  nome: id,
  peso,
  avaliacoes: [],
  recuperacaoNoSemestre: false,
  notaRecuperacao: null,
})

describe('lerNotaDigitada', () => {
  it('aceita vírgula e ponto, e vazio quer dizer sem nota', () => {
    expect(lerNotaDigitada('2,5', 3)).toEqual({ ok: true, nota: 2.5 })
    expect(lerNotaDigitada(' 2.5 ', 3)).toEqual({ ok: true, nota: 2.5 })
    expect(lerNotaDigitada('   ', 3)).toEqual({ ok: true, nota: null })
    expect(lerNotaDigitada('0', 3)).toEqual({ ok: true, nota: 0 })
    expect(lerNotaDigitada('3', 3)).toEqual({ ok: true, nota: 3 })
  })

  it('recusa acima do valor da avaliação, negativo e texto', () => {
    for (const texto of ['3,1', '-1', 'abc', '7,5,1']) {
      const lida = lerNotaDigitada(texto, 3)
      expect(lida.ok).toBe(false)
      if (!lida.ok) expect(lida.erro).toContain('de 0 a 3,0')
    }
  })

  it('recusa mais de 2 casas decimais, que o campo mostraria arredondadas', () => {
    const lida = lerNotaDigitada('2,999', 3)
    expect(lida.ok).toBe(false)
    if (!lida.ok) expect(lida.erro).toContain('2 casas')
    expect(lerNotaDigitada('2,75', 3)).toEqual({ ok: true, nota: 2.75 })
  })

  it('notaNoCampo mostra com vírgula e vazio para null', () => {
    expect(notaNoCampo(7)).toBe('7,0')
    expect(notaNoCampo(null)).toBe('')
  })
})

describe('necessariaNaEscala', () => {
  it('leva a nota de 0 a 10 para a escala da avaliação', () => {
    expect(necessariaNaEscala(6.6, 3)).toBe(1.98)
    expect(necessariaNaEscala(7, 10)).toBe(7)
  })

  it('arredonda para cima, para quem tirar o valor mostrado alcançar', () => {
    // 6,1 de 10 numa avaliação de 2,5 é 1,525: mostrar 1,52 não bastaria.
    expect(necessariaNaEscala(6.1, 2.5)).toBe(1.53)
  })
})

describe('fracaoDoRA', () => {
  it('é o peso do RA sobre a soma dos pesos, sem os de peso 0', () => {
    const ras = [ra('a', 20), ra('b', 30), ra('c', 50), ra('d', 0)]
    expect(fracaoDoRA(ras[0], ras)).toBe(0.2)
    expect(fracaoDoRA(ras[2], ras)).toBe(0.5)
    expect(fracaoDoRA(ras[3], ras)).toBe(0)
  })

  it('dá 0 quando nenhum RA tem peso', () => {
    const ras = [ra('a', 0)]
    expect(fracaoDoRA(ras[0], ras)).toBe(0)
  })
})

describe('textoRegra', () => {
  it('descreve a regra da PUC-PR', () => {
    expect(textoRegra(REGRA_PUCPR)).toEqual([
      'Média mínima 7,0',
      'Frequência mínima 75%',
      'Recuperação com média final a partir de 4,0; a nota do RA recuperado vale até 7,0',
      'Nota final sem arredondar',
    ])
  })

  it('diz quando não há recuperação e quando arredonda', () => {
    const linhas = textoRegra({ mediaMinima: 6, frequenciaMinima: 0.7, arredondarUmaCasa: true })
    expect(linhas).toContain('Sem recuperação')
    expect(linhas).toContain('Nota final arredondada para 1 casa')
  })
})

describe('faltasOrdenadas e textoHorarios', () => {
  it('põe a falta mais recente primeiro, sem mudar a lista original', () => {
    const faltas = [
      { id: '1', data: '2026-09-02', quantidade: 1 },
      { id: '2', data: '2026-10-01', quantidade: 2 },
    ]
    expect(faltasOrdenadas(faltas).map((f) => f.id)).toEqual(['2', '1'])
    expect(faltas[0].id).toBe('1')
  })

  it('lista os horários na ordem da semana', () => {
    expect(
      textoHorarios([
        { dia: 4, inicio: '19:00' },
        { dia: 2, inicio: '21:00' },
        { dia: 2, inicio: '19:00' },
      ]),
    ).toBe('Ter 19:00, Ter 21:00, Qui 19:00')
  })
})

describe('erros ligados ao campo', () => {
  it('falta: aponta a data ou a quantidade', () => {
    expect(erroDaFalta({ data: '2026-09-02', quantidade: 2 })).toBeNull()
    expect(erroDaFalta({ data: '', quantidade: 2 })?.campo).toBe('data')
    expect(erroDaFalta({ data: '2026-09-02', quantidade: 13 })?.campo).toBe('quantidade')
    expect(erroDaFalta({ data: '2026-09-02', quantidade: lerCampoNumero('abc') })?.campo).toBe('quantidade')
    // Os dois errados: a data vem primeiro, como no erroFalta.
    expect(erroDaFalta({ data: '', quantidade: 0 })?.campo).toBe('data')
  })

  it('ponto extra: aponta os pontos ou o comentário', () => {
    expect(erroDoPontoExtra({ pontos: 0.5, comentario: 'Lista 1' })).toBeNull()
    expect(erroDoPontoExtra({ pontos: lerCampoNumero(''), comentario: 'Lista 1' })?.campo).toBe('pontos')
    expect(erroDoPontoExtra({ pontos: 0.5, comentario: '  ' })?.campo).toBe('comentario')
    expect(erroDoPontoExtra({ pontos: 0.5, comentario: 'x'.repeat(201) })?.campo).toBe('comentario')
  })
})

describe('explicacaoNota e dicaAvaliacao', () => {
  const possivel: SituacaoNota = { tipo: 'possivel', media: 7.3, notaNecessaria: 6.6 }

  it('explica a situação ou devolve null quando o selo basta', () => {
    expect(explicacaoNota(possivel, REGRA_PUCPR)).toContain('Média do que já saiu: 7,3')
    expect(explicacaoNota({ tipo: 'reprovado', media: 3 }, REGRA_PUCPR)).toBeNull()
    expect(
      explicacaoNota({ tipo: 'aprovado', media: 8, garantida: 8, fechada: true }, REGRA_PUCPR),
    ).toBeNull()
    expect(
      explicacaoNota({ tipo: 'aprovado', media: 9, garantida: 7.2, fechada: false }, REGRA_PUCPR),
    ).toContain('fica em 7,2')
  })

  it('mostra quanto tirar só nas avaliações pendentes que contam', () => {
    const pendente = { nota: null, peso: 1, valorMaximo: 3 }
    expect(dicaAvaliacao(pendente, possivel)).toBe('Precisa de 1,98 de 3,0')
    expect(dicaAvaliacao({ ...pendente, nota: 2 }, possivel)).toBeUndefined()
    expect(dicaAvaliacao({ ...pendente, peso: 0 }, possivel)).toBeUndefined()
    expect(
      dicaAvaliacao(pendente, { tipo: 'impossivel', media: 2, notaNecessaria: 12, notaParaRecuperacao: 5 }),
    ).toBe('Precisa de 1,5 de 3,0 para ter a recuperação')
    expect(
      dicaAvaliacao(pendente, { tipo: 'impossivel', media: 2, notaNecessaria: 12, notaParaRecuperacao: 0 }),
    ).toBeUndefined()
  })
})
