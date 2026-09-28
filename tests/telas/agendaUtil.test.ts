import { describe, expect, it } from 'vitest'
import type { TipoEvento } from '../../src/logica/tipos'
import { erroDoFormulario } from '../../src/telas/agendaUtil'

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
