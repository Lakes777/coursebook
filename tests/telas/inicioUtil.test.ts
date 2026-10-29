import { describe, expect, it } from 'vitest'
import { dadosDeExemplo } from '../../src/logica/exemplo'
import { agenda, type EventoNaAgenda } from '../../src/logica/eventos'
import type { Materia } from '../../src/logica/tipos'
import { resumoMateria } from '../../src/tema/textos'
import {
  aulasDeHoje,
  contarAtencao,
  fraseDoDia,
  hora,
  limitesDaRegua,
  piorFalta,
  porExtenso,
  textoDoDia,
  type TrechoFrase,
} from '../../src/telas/inicioUtil'

const texto = (trechos: TrechoFrase[]) => trechos.map((t) => t.texto).join('')

function materia(id: string, horarios: Materia['horarios']): Materia {
  return { ...dadosDeExemplo().materias[0], id, nome: id, professor: '', horarios }
}

describe('textoDoDia e porExtenso', () => {
  it('escreve o dia da semana, o dia e o mês', () => {
    expect(textoDoDia(new Date(2026, 9, 29))).toBe('Quinta, 29 de outubro')
    expect(textoDoDia(new Date(2026, 2, 1))).toBe('Domingo, 1 de março')
  })

  it('escreve de uma a dez por extenso e o resto em número', () => {
    expect(porExtenso(1)).toBe('uma')
    expect(porExtenso(2)).toBe('duas')
    expect(porExtenso(10)).toBe('dez')
    expect(porExtenso(11)).toBe('11')
  })

  it('formata minutos como hora', () => {
    expect(hora(19 * 60)).toBe('19:00')
    expect(hora(7 * 60 + 50)).toBe('07:50')
  })
})

describe('aulasDeHoje', () => {
  it('pega só as aulas do dia, em ordem, com as divisões da tabela da PUC', () => {
    const quinta = new Date(2026, 9, 29, 12, 0)
    const aulas = aulasDeHoje(dadosDeExemplo().materias, quinta)
    expect(aulas).toHaveLength(1)
    const [poo] = aulas
    expect(poo.materia).toBe('Programação Orientada a Objetos')
    expect([hora(poo.de), hora(poo.ate)]).toEqual(['19:00', '22:15'])
    expect(poo.aulas).toBe(4)
    expect(poo.divisoes).toHaveLength(3)
    expect(poo.faixa).toBe(0)
  })

  it('horários que se cruzam vão para outra linha; o que começa quando o outro acaba, não', () => {
    const segunda = new Date(2026, 9, 26, 8, 0)
    const aulas = aulasDeHoje(
      [
        materia('A', [{ dia: 1, inicio: '08:00', fim: '10:00' }]),
        materia('B', [{ dia: 1, inicio: '09:00', fim: '11:00' }]),
        materia('C', [{ dia: 1, inicio: '10:00', fim: '12:00' }]),
      ],
      segunda,
    )
    expect(aulas.map((a) => [a.materia, a.faixa])).toEqual([
      ['A', 0],
      ['B', 1],
      ['C', 0],
    ])
  })

  it('o número de aulas do cadastro manda; sem ele, vale a tabela da PUC', () => {
    const segunda = new Date(2026, 9, 26, 8, 0)
    // 19:00 a 22:30 pega 5 aulas da tabela, mas a matéria diz 4 (é o que o "Faltei hoje" lança).
    const [com] = aulasDeHoje([materia('A', [{ dia: 1, inicio: '19:00', fim: '22:30', aulas: 4 }])], segunda)
    expect(com.aulas).toBe(4)
    expect(com.divisoes).toEqual([])
    const [sem] = aulasDeHoje([materia('A', [{ dia: 1, inicio: '19:00', fim: '22:15' }])], segunda)
    expect(sem.aulas).toBe(4)
    expect(sem.divisoes).toHaveLength(3)
  })

  it('horário antigo que passa da meia-noite para no fim do dia', () => {
    const segunda = new Date(2026, 9, 26, 8, 0)
    const [tarde] = aulasDeHoje([materia('A', [{ dia: 1, inicio: '23:30', aulas: 2 }])], segunda)
    expect([tarde.de, tarde.ate]).toEqual([23 * 60 + 30, 24 * 60])
  })

  it('horário inválido fica de fora', () => {
    const segunda = new Date(2026, 9, 26, 8, 0)
    expect(aulasDeHoje([materia('A', [{ dia: 1, inicio: '25:00', fim: '26:00' }])], segunda)).toEqual([])
  })
})

describe('limitesDaRegua', () => {
  it('vai da hora cheia antes da primeira aula à hora cheia depois da última', () => {
    const quinta = new Date(2026, 9, 29, 12, 0)
    expect(limitesDaRegua(aulasDeHoje(dadosDeExemplo().materias, quinta))).toEqual({ de: 18 * 60, ate: 23 * 60 })
    const sexta = new Date(2026, 9, 30, 12, 0)
    // Cálculo Numérico: 07:50 a 11:10.
    expect(limitesDaRegua(aulasDeHoje(dadosDeExemplo().materias, sexta))).toEqual({ de: 7 * 60, ate: 12 * 60 })
  })

  it('não passa da meia-noite e é null sem aulas', () => {
    const segunda = new Date(2026, 9, 26, 8, 0)
    const tarde = aulasDeHoje([materia('A', [{ dia: 1, inicio: '23:00', fim: '23:45' }])], segunda)
    expect(limitesDaRegua(tarde)).toEqual({ de: 22 * 60, ate: 24 * 60 })
    expect(limitesDaRegua([])).toBeNull()
  })
})

describe('fraseDoDia', () => {
  const dados = dadosDeExemplo(new Date(2026, 9, 29))

  function frase(agora: Date, atencao = 2, eventos = dados.eventos) {
    const pendentes: EventoNaAgenda[] = agenda(eventos, agora).filter((e) => !e.concluido)
    return texto(fraseDoDia(agora, aulasDeHoje(dados.materias, agora), pendentes, atencao))
  }

  it('fala da aula de agora, do próximo prazo e de quantas matérias pedem atenção', () => {
    expect(frase(new Date(2026, 9, 29, 19, 40))).toBe(
      'Quinta, 29 de outubro. Programação Orientada a Objetos agora, Entrega do relatório final hoje e duas matérias pedindo atenção.',
    )
  })

  it('antes da aula, fala da próxima; depois, que acabou', () => {
    expect(frase(new Date(2026, 9, 29, 15, 0), 1)).toContain('Programação Orientada a Objetos às 19:00')
    expect(frase(new Date(2026, 9, 29, 15, 0), 1)).toContain('uma matéria pedindo atenção')
    expect(frase(new Date(2026, 9, 29, 23, 0))).toContain('Aulas de hoje encerradas')
  })

  it('sem aulas, sem prazos e sem nada pedindo atenção', () => {
    expect(frase(new Date(2026, 9, 31, 10, 0), 0, [])).toBe(
      'Sábado, 31 de outubro. Sem aulas hoje, nenhum prazo pela frente e tudo em dia nas matérias.',
    )
  })

  it('destaca a aula, o prazo e as matérias', () => {
    const agora = new Date(2026, 9, 29, 19, 40)
    const pendentes = agenda(dados.eventos, agora).filter((e) => !e.concluido)
    const fortes = fraseDoDia(agora, aulasDeHoje(dados.materias, agora), pendentes, 2)
      .filter((t) => t.forte)
      .map((t) => t.texto)
    expect(fortes).toEqual(['Programação Orientada a Objetos agora', 'Entrega do relatório final', 'duas matérias'])
  })
})

describe('contarAtencao e piorFalta', () => {
  const dados = dadosDeExemplo(new Date(2026, 9, 29))
  const resumos = dados.materias.map((m) => ({ materia: m, resumo: resumoMateria(m, dados.regraPadrao) }))

  it('conta as matérias em amarelo ou vermelho (no exemplo, só Cálculo Numérico)', () => {
    expect(contarAtencao(resumos.map((r) => r.resumo))).toBe(1)
  })

  it('acha a matéria mais perto do limite de faltas', () => {
    const pior = piorFalta(resumos)
    expect(pior && [pior.materia.nome, pior.total, pior.limite]).toEqual(['Cálculo Numérico', 12, 15])
  })

  it('matéria curta com limite 0 e uma falta já reprovou: é a pior', () => {
    const curta = {
      ...dados.materias[0],
      id: 'curta',
      nome: 'Curta',
      cargaHoraria: 3,
      faltas: [{ id: 'f', data: '2026-10-01', quantidade: 1 }],
    }
    const todas = [...resumos, { materia: curta, resumo: resumoMateria(curta, dados.regraPadrao) }]
    const pior = piorFalta(todas)
    expect(pior && [pior.materia.nome, pior.total, pior.limite]).toEqual(['Curta', 1, 0])
  })

  it('sem nenhuma falta, não há o que mostrar', () => {
    const semFaltas = resumos.map(({ materia }) => {
      const m = { ...materia, faltas: [] }
      return { materia: m, resumo: resumoMateria(m, dados.regraPadrao) }
    })
    expect(piorFalta(semFaltas)).toBeNull()
  })

  it('sem carga horária, não entra; sem nenhuma com limite, é null', () => {
    const semCarga = resumos.map(({ materia }) => {
      const m = { ...materia, cargaHoraria: 0 }
      return { materia: m, resumo: resumoMateria(m, dados.regraPadrao) }
    })
    expect(piorFalta(semCarga)).toBeNull()
  })
})
