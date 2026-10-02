import { describe, expect, it } from 'vitest'
import { REGRA_PUCPR, type Materia } from '../../src/logica/tipos'
import { plural, resumoMateria, resumoSemestre, textoFaltas, textoNota, textoSelo } from '../../src/tema/textos'

function materia(parcial: Partial<Materia> = {}): Materia {
  return {
    id: 'm',
    nome: 'Filosofia',
    professor: '',
    horarios: [],
    cargaHoraria: 80,
    ras: [
      {
        id: 'ra1',
        nome: 'RA1',
        peso: 1,
        avaliacoes: [{ id: 'p', nome: 'Prova', peso: 1, valorMaximo: 10, nota: 6.8 }],
        recuperacaoNoSemestre: false,
        notaRecuperacao: null,
      },
    ],
    pontosExtras: [],
    faltas: [],
    ...parcial,
  }
}

describe('resumoMateria', () => {
  it('usa a regra padrão quando a matéria não tem a sua', () => {
    const r = resumoMateria(materia(), REGRA_PUCPR)
    expect(r.regra).toBe(REGRA_PUCPR)
    expect(r.nota.tipo).toBe('recuperacao') // 6,8 < 7 sem arredondar
  })

  it('usa a regra da matéria e soma os pontos extras', () => {
    const regra = { ...REGRA_PUCPR, arredondarUmaCasa: true }
    expect(resumoMateria(materia({ regra }), REGRA_PUCPR).nota.tipo).toBe('recuperacao') // 6,8 -> 6,8
    const comExtra = materia({ pontosExtras: [{ id: 'x', pontos: 0.2, comentario: 'Lista' }] })
    expect(resumoMateria(comExtra, REGRA_PUCPR).nota).toEqual({ tipo: 'aprovado', media: 7, garantida: 7, fechada: true })
  })

  it('calcula as faltas com a frequência da regra', () => {
    const r = resumoMateria(materia({ faltas: [{ id: 'f', data: '2026-09-01', quantidade: 4 }] }), REGRA_PUCPR)
    expect(r.faltas).toMatchObject({ total: 4, limite: 20, nivel: 'ok' })
  })
})

describe('textoNota', () => {
  it('tem uma frase para cada situação', () => {
    expect(textoNota({ tipo: 'sem-avaliacoes' })).toBe('Sem avaliações')
    expect(textoNota({ tipo: 'aprovado', media: 8.5, garantida: 8.5, fechada: true })).toBe('Aprovado com 8,5')
    // Média 10 no que saiu, mas só 8,0 garantido: não pode prometer 10.
    expect(textoNota({ tipo: 'aprovado', media: 10, garantida: 8, fechada: false })).toBe('Já passou: garante 8,0')
    expect(textoNota({ tipo: 'possivel', media: 6, notaNecessaria: 7.5 })).toBe('Precisa de 7,5 (de 10) no que falta')
    expect(textoNota({ tipo: 'impossivel', media: 2, notaNecessaria: 12 })).toBe('Não alcança a média')
    expect(textoNota({ tipo: 'impossivel', media: 3, notaNecessaria: 11, notaParaRecuperacao: 5 })).toBe(
      'Precisa de 5,0 (de 10) para a recuperação',
    )
    expect(textoNota({ tipo: 'impossivel', media: 5, notaNecessaria: 11, notaParaRecuperacao: 0 })).toBe(
      'Vai para a recuperação',
    )
    expect(textoNota({ tipo: 'recuperacao', media: 5, teto: 7, ras: ['ra1'] })).toBe('Em recuperação')
    expect(textoNota({ tipo: 'reprovado', media: 3 })).toBe('Reprovado com 3,0')
  })
})

describe('textoFaltas', () => {
  it('mostra quantas de quantas', () => {
    expect(textoFaltas({ total: 3, limite: 20, restantes: 17, frequencia: 0.96, nivel: 'ok' })).toBe('3 de 20 faltas')
    expect(textoFaltas({ total: 0, limite: 1, restantes: 1, frequencia: 1, nivel: 'ok' })).toBe('0 de 1 falta')
    expect(textoFaltas({ total: 21, limite: 20, restantes: -1, frequencia: 0.7, nivel: 'reprovado' })).toBe(
      'Reprovado por faltas (21 de 20)',
    )
  })

  it('sem carga horária, só conta', () => {
    const sem = { limite: 0, restantes: 0, frequencia: null, nivel: 'sem-carga-horaria' as const }
    expect(textoFaltas({ ...sem, total: 0 })).toBe('Sem carga horária')
    expect(textoFaltas({ ...sem, total: 1 })).toBe('1 falta')
    expect(textoFaltas({ ...sem, total: 2 })).toBe('2 faltas')
  })
})

describe('plural', () => {
  it('só 1 é singular', () => {
    expect(plural(0, 'falta', 'faltas')).toBe('faltas')
    expect(plural(1, 'falta', 'faltas')).toBe('falta')
  })
})

describe('textoSelo', () => {
  it('dá um texto para cada destaque, menos o futuro', () => {
    expect(textoSelo({ destaque: 'atrasado', dias: -2 })).toBe('Atrasado')
    expect(textoSelo({ destaque: 'hoje', dias: 0 })).toBe('Hoje')
    expect(textoSelo({ destaque: 'proximo', dias: 1 })).toBe('Amanhã')
    expect(textoSelo({ destaque: 'proximo', dias: 5 })).toBe('Em 5 dias')
    expect(textoSelo({ destaque: 'concluido', dias: 3 })).toBe('Concluído')
    expect(textoSelo({ destaque: 'futuro', dias: 30 })).toBeNull()
  })
})

describe('resumoSemestre', () => {
  const nota = (n: number | null): Partial<Materia> => ({
    ras: [{ ...materia().ras[0], avaliacoes: [{ id: 'p', nome: 'Prova', peso: 1, valorMaximo: 10, nota: n }] }],
  })
  const resumo = (parcial: Partial<Materia>) => resumoMateria(materia(parcial), REGRA_PUCPR)

  it('conta cada matéria uma vez, só nos grupos que têm alguma', () => {
    expect(resumoSemestre([resumo(nota(9))])).toEqual(['1 matéria', '1 aprovada'])
    expect(resumoSemestre([resumo(nota(9)), resumo(nota(8)), resumo(nota(null)), resumo(nota(5))])).toEqual([
      '4 matérias',
      '2 aprovadas',
      '1 em andamento',
      '1 pede atenção',
    ])
  })

  it('aprovada pela nota, mas perto do limite de faltas, pede atenção', () => {
    const faltas = [{ id: 'f', data: '2026-09-01', quantidade: 17 }]
    expect(resumoSemestre([resumo({ ...nota(9), faltas }), resumo(nota(4))])).toEqual(['2 matérias', '2 pedem atenção'])
  })
})
