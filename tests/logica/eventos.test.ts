import { describe, expect, it } from 'vitest'
import { agenda, erroEvento, textoPrazo } from '../../src/logica/eventos'
import type { Evento, TipoEvento } from '../../src/logica/tipos'

// 28/09/2026 às 23h30: tarde da noite, para pegar erro de fuso (em UTC já seria dia 29).
const HOJE = new Date(2026, 8, 28, 23, 30)

let contador = 0
function evento(
  titulo: string,
  data: string,
  outros: { concluido?: boolean; tipo?: TipoEvento } = {},
): Evento {
  contador += 1
  return {
    id: `ev${contador}`,
    titulo,
    tipo: outros.tipo ?? 'prova',
    data,
    concluido: outros.concluido ?? false,
  }
}

const titulos = (lista: { titulo: string }[]) => lista.map((e) => e.titulo)

describe('agenda', () => {
  it('marca atrasado, hoje, próximo e futuro pelo dia de calendário', () => {
    const lista = agenda(
      [
        evento('Futuro', '2026-10-06'),
        evento('Próximo', '2026-10-05'),
        evento('Hoje', '2026-09-28'),
        evento('Atrasado', '2026-09-27'),
      ],
      HOJE,
    )
    expect(lista.map((e) => [e.titulo, e.dias, e.destaque])).toEqual([
      ['Atrasado', -1, 'atrasado'],
      ['Hoje', 0, 'hoje'],
      ['Próximo', 7, 'proximo'], // 7 dias ainda é próximo
      ['Futuro', 8, 'futuro'], // 8 já não é
    ])
  })

  it('aceita outro tamanho para "próximo"', () => {
    const [e] = agenda([evento('Prova', '2026-10-01')], HOJE, 2)
    expect(e.destaque).toBe('futuro')
  })

  it('põe os concluídos no fim, do mais recente para o mais antigo', () => {
    const lista = agenda(
      [
        evento('Feito antigo', '2026-09-01', { concluido: true }),
        evento('Pendente', '2026-10-20'),
        evento('Feito recente', '2026-09-22', { concluido: true }),
        evento('Feito no futuro', '2026-10-02', { concluido: true }),
      ],
      HOJE,
    )
    expect(titulos(lista)).toEqual(['Pendente', 'Feito no futuro', 'Feito recente', 'Feito antigo'])
    expect(lista.slice(1).every((e) => e.destaque === 'concluido')).toBe(true)
  })

  it('concluídos no mesmo dia também ficam em ordem de título', () => {
    const lista = agenda(
      [
        evento('B', '2026-09-01', { concluido: true }),
        evento('A', '2026-09-01', { concluido: true }),
      ],
      HOJE,
    )
    expect(titulos(lista)).toEqual(['A', 'B'])
  })

  it('concluído não aparece como atrasado', () => {
    const [e] = agenda([evento('Prova RA1', '2026-09-22', { concluido: true })], HOJE)
    expect(e.destaque).toBe('concluido')
  })

  it('no mesmo dia, ordena pelo título com acentos do português', () => {
    const lista = agenda(
      [
        evento('Prova de POO', '2026-10-01'),
        evento('Apresentação do TDE', '2026-10-01'),
        evento('Ética (Filosofia)', '2026-10-01'),
      ],
      HOJE,
    )
    expect(titulos(lista)).toEqual(['Apresentação do TDE', 'Ética (Filosofia)', 'Prova de POO'])
  })

  it('não altera a lista recebida', () => {
    const original = [evento('B', '2026-10-02'), evento('A', '2026-10-01')]
    const copia = structuredClone(original)
    agenda(original, HOJE)
    expect(original).toEqual(copia)
  })

  it('lista vazia', () => {
    expect(agenda([], HOJE)).toEqual([])
  })
})

describe('textoPrazo', () => {
  it.each([
    [0, 'hoje'],
    [1, 'amanhã'],
    [5, 'em 5 dias'],
    [-1, 'ontem'],
    [-3, 'há 3 dias'],
  ])('%i dias -> %s', (dias, texto) => {
    expect(textoPrazo(dias)).toBe(texto)
  })
})

describe('erroEvento', () => {
  it('aceita um evento válido', () => {
    expect(erroEvento({ titulo: 'Defesa da Sprint 1', tipo: 'apresentacao', data: '2026-09-21' })).toBeNull()
  })

  it('exige título', () => {
    expect(erroEvento({ titulo: '   ', tipo: 'prova', data: '2026-09-21' })).toMatch('título')
  })

  it('limita o tamanho do título', () => {
    expect(erroEvento({ titulo: 'a'.repeat(101), tipo: 'prova', data: '2026-09-21' })).toMatch('100')
  })

  it('recusa tipo desconhecido (ex.: vindo de um JSON importado)', () => {
    const tipo = 'churrasco' as TipoEvento
    expect(erroEvento({ titulo: 'Prova', tipo, data: '2026-09-21' })).toMatch('prova, trabalho')
  })

  it('recusa data inválida', () => {
    expect(erroEvento({ titulo: 'Prova', tipo: 'prova', data: '2026-06-31' })).toMatch('data')
  })
})
