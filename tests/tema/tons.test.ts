import { describe, expect, it } from 'vitest'
import { TIPOS_EVENTO } from '../../src/logica/eventos'
import { ICONE_AVISO, ICONE_TIPO_EVENTO, ICONE_TOM } from '../../src/tema/icones'
import { tomFaltas, tomNota, tomPrazo, TONS } from '../../src/tema/tons'

describe('tomNota', () => {
  it('verde para quem já passou', () => {
    expect(tomNota({ tipo: 'aprovado', media: 8 })).toBe('ok')
  })

  it('cinza enquanto não dá para saber', () => {
    expect(tomNota({ tipo: 'sem-avaliacoes' })).toBe('neutro')
    expect(tomNota({ tipo: 'possivel', media: 6, notaNecessaria: 7.5 })).toBe('neutro')
  })

  it('amarelo quando ainda tem a recuperação', () => {
    expect(tomNota({ tipo: 'recuperacao', media: 5, teto: 7, ras: ['ra1'] })).toBe('atencao')
    expect(tomNota({ tipo: 'impossivel', media: 3, notaNecessaria: 11, notaParaRecuperacao: 5 })).toBe('atencao')
    // 0 é "já tem direito à recuperação", não "sem recuperação": não pode ser tratado como falso.
    expect(tomNota({ tipo: 'impossivel', media: 5, notaNecessaria: 11, notaParaRecuperacao: 0 })).toBe('atencao')
  })

  it('vermelho quando não tem mais jeito', () => {
    expect(tomNota({ tipo: 'impossivel', media: 1, notaNecessaria: 12 })).toBe('perigo')
    expect(tomNota({ tipo: 'reprovado', media: 3 })).toBe('perigo')
  })
})

describe('tomFaltas', () => {
  it('segue o nível das faltas', () => {
    expect(tomFaltas('ok')).toBe('ok')
    expect(tomFaltas('atencao')).toBe('atencao')
    expect(tomFaltas('reprovado')).toBe('perigo')
    expect(tomFaltas('sem-carga-horaria')).toBe('neutro')
  })
})

describe('tomPrazo', () => {
  it('atrasado é vermelho, hoje amarelo, próximo bordô, feito verde e o resto cinza', () => {
    expect(tomPrazo('atrasado')).toBe('perigo')
    expect(tomPrazo('hoje')).toBe('atencao')
    expect(tomPrazo('proximo')).toBe('destaque')
    expect(tomPrazo('concluido')).toBe('ok')
    expect(tomPrazo('futuro')).toBe('neutro')
  })
})

describe('ícones', () => {
  it('todo tipo de evento tem um ícone, e são diferentes', () => {
    const icones = TIPOS_EVENTO.map((t) => ICONE_TIPO_EVENTO[t])
    icones.forEach((i) => expect(i).toBeDefined())
    expect(new Set(icones).size).toBe(TIPOS_EVENTO.length)
  })

  it('todo tom tem um ícone diferente (a cor não é o único sinal)', () => {
    expect(new Set(TONS.map((t) => ICONE_TOM[t])).size).toBe(TONS.length)
  })

  it('os avisos (informação, atenção, erro) têm ícones diferentes', () => {
    const icones = Object.values(ICONE_AVISO)
    expect(new Set(icones).size).toBe(icones.length)
  })

  it('o "certo" só aparece no que está resolvido', () => {
    // Um prazo chegando com um visto pareceria já feito.
    expect(ICONE_TOM[tomPrazo('proximo')]).not.toBe(ICONE_TOM.ok)
    expect(ICONE_TOM[tomPrazo('concluido')]).toBe(ICONE_TOM.ok)
  })
})
