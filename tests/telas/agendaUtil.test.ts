import { describe, expect, it } from 'vitest'
import type { TipoEvento } from '../../src/logica/tipos'
import { erroDoFormulario, textoSelo } from '../../src/telas/agendaUtil'

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

describe('erroDoFormulario', () => {
  it('devolve null quando está tudo certo', () => {
    expect(erroDoFormulario({ titulo: 'Prova do RA1', tipo: 'prova', data: '2026-10-05' })).toBeNull()
  })

  it('liga cada erro ao seu campo', () => {
    expect(erroDoFormulario({ titulo: '  ', tipo: 'prova', data: '2026-10-05' })?.campo).toBe('titulo')
    expect(erroDoFormulario({ titulo: 'x'.repeat(101), tipo: 'prova', data: '2026-10-05' })?.campo).toBe('titulo')
    expect(erroDoFormulario({ titulo: 'A', tipo: 'festa' as TipoEvento, data: '2026-10-05' })?.campo).toBe('tipo')
    expect(erroDoFormulario({ titulo: 'A', tipo: 'prova', data: '' })?.campo).toBe('data')
    expect(erroDoFormulario({ titulo: 'A', tipo: 'prova', data: '2026-02-30' })?.campo).toBe('data')
  })

  it('com dois erros, mostra o do primeiro campo', () => {
    const erro = erroDoFormulario({ titulo: '', tipo: 'prova', data: '' })
    expect(erro).toEqual({ campo: 'titulo', mensagem: 'Dê um título (ex.: "Prova do RA1").' })
  })
})
