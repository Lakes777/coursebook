import { describe, expect, it } from 'vitest'
import { dataValida, diasAte, formatarData, lerData, paraDataISO } from '../../src/logica/datas'

describe('lerData', () => {
  it('lê a data no horário local, sem voltar um dia', () => {
    const data = lerData('2026-10-05')!
    expect(data.getDate()).toBe(5)
    expect(data.getMonth()).toBe(9)
    expect(data.getHours()).toBe(0)
  })

  it.each(['2026-02-30', '2026-13-01', '2026-00-10', '05/10/2026', '2026-10-5', ''])(
    'recusa %j',
    (texto) => {
      expect(lerData(texto)).toBeNull()
      expect(dataValida(texto)).toBe(false)
    },
  )

  it('aceita 29 de fevereiro só em ano bissexto', () => {
    expect(dataValida('2028-02-29')).toBe(true)
    expect(dataValida('2026-02-29')).toBe(false)
  })
})

describe('paraDataISO', () => {
  it('completa mês e dia com zero', () => {
    expect(paraDataISO(new Date(2026, 0, 7))).toBe('2026-01-07')
  })

  it('usa o dia local mesmo tarde da noite', () => {
    // 23h em Brasília já é o dia seguinte em UTC; toISOString() erraria aqui.
    expect(paraDataISO(new Date(2026, 8, 28, 23, 30))).toBe('2026-09-28')
  })
})

describe('diasAte', () => {
  const hoje = new Date(2026, 8, 28, 23, 59) // 28/09/2026, 23h59

  it('conta dias de calendário, sem ligar para a hora', () => {
    expect(diasAte('2026-09-28', hoje)).toBe(0)
    expect(diasAte('2026-09-29', hoje)).toBe(1)
    expect(diasAte('2026-09-27', hoje)).toBe(-1)
  })

  it('atravessa meses e anos', () => {
    expect(diasAte('2026-10-05', hoje)).toBe(7)
    expect(diasAte('2027-01-01', hoje)).toBe(95)
  })

  it('recusa data inválida', () => {
    expect(() => diasAte('2026-02-30', hoje)).toThrow('Data inválida')
  })
})

describe('formatarData', () => {
  it('mostra no formato brasileiro', () => {
    expect(formatarData('2026-10-05')).toBe('05/10/2026')
  })
})
