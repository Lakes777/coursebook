import { describe, expect, it } from 'vitest'
import { REGRA_PUCPR, VERSAO_ATUAL, type RegraAprovacao } from '../../src/logica/tipos'
import { validarDados } from '../../src/logica/validacao'
import {
  conferirAvaliacoes,
  conferirMateria,
  conferirPasso,
  conferirRAs,
  conferirRegra,
  formularioVazio,
  ID_CARGA,
  ID_FREQUENCIA,
  ID_MEDIA,
  ID_NOME,
  ID_NOTA_MINIMA,
  ID_PROFESSOR,
  ID_TETO,
  idAvaliacao,
  idHorario,
  idRA,
  montarMateria,
  novaAvaliacao,
  novoRA,
  passoDoErro,
  porcentagemRA,
  regraParaForm,
  somaPesos,
  textoRegra,
  type Formulario,
} from '../../src/telas/novaMateriaUtil'

/** Formulário preenchido e certo: POO com 2 RAs, como no plano de ensino. */
function preenchido(): Formulario {
  const form = formularioVazio(REGRA_PUCPR)
  const ra1 = { ...form.ras[0], peso: '40', recuperacaoNoSemestre: true }
  ra1.avaliacoes = [{ ...ra1.avaliacoes[0], nome: ' Prova 1 ', valorMaximo: '3,0', peso: '1', data: '2026-10-05' }]
  const ra2 = { ...novoRA(2), peso: '60' }
  ra2.avaliacoes = [{ ...ra2.avaliacoes[0], nome: 'Projeto', valorMaximo: '10', peso: '2' }]
  return {
    ...form,
    nome: '  POO  ',
    professor: ' Ana ',
    cargaHoraria: '80',
    horarios: [{ chave: 'h1', dia: 2, inicio: '07:45' }],
    ras: [ra1, ra2],
  }
}

describe('formularioVazio', () => {
  it('começa com um RA chamado RA1, com uma avaliação que vale 10 e peso 1', () => {
    const form = formularioVazio(REGRA_PUCPR)
    expect(form.ras).toHaveLength(1)
    expect(form.ras[0]).toMatchObject({ nome: 'RA1', peso: '', recuperacaoNoSemestre: false })
    expect(form.ras[0].avaliacoes[0]).toMatchObject({ nome: '', valorMaximo: '10', peso: '1', data: '' })
    expect(form.usarRegraPadrao).toBe(true)
    expect(form.horarios).toEqual([])
  })

  it('a regra própria começa igual à padrão, em texto', () => {
    expect(regraParaForm(REGRA_PUCPR)).toEqual({
      mediaMinima: '7',
      frequenciaMinima: '75',
      temRecuperacao: true,
      notaMinima: '4',
      teto: '7',
      arredondarUmaCasa: false,
    })
    const semRec: RegraAprovacao = { mediaMinima: 6.5, frequenciaMinima: 0.7, arredondarUmaCasa: true }
    expect(regraParaForm(semRec)).toMatchObject({ mediaMinima: '6,5', frequenciaMinima: '70', temRecuperacao: false })
  })
})

describe('conferirMateria', () => {
  it('aceita o formulário certo', () => {
    expect(conferirMateria(preenchido())).toBeNull()
  })

  it('pede o nome', () => {
    expect(conferirMateria({ ...preenchido(), nome: '   ' })?.campo).toBe(ID_NOME)
    expect(conferirMateria({ ...preenchido(), nome: 'x'.repeat(101) })).toEqual({
      campo: ID_NOME,
      mensagem: 'O nome pode ter no máximo 100 caracteres.',
    })
    expect(conferirMateria({ ...preenchido(), nome: 'x'.repeat(100) })).toBeNull()
  })

  it('limita o nome do professor', () => {
    expect(conferirMateria({ ...preenchido(), professor: 'y'.repeat(101) })?.campo).toBe(ID_PROFESSOR)
  })

  it('pede a carga horária inteira e >= 0', () => {
    for (const carga of ['', 'abc', '-1', '80,5']) {
      expect(conferirMateria({ ...preenchido(), cargaHoraria: carga })?.campo).toBe(ID_CARGA)
    }
    expect(conferirMateria({ ...preenchido(), cargaHoraria: '0' })).toBeNull()
  })

  it('confere a hora de cada horário', () => {
    const form = { ...preenchido(), horarios: [{ chave: 'h1', dia: 1 as const, inicio: '' }] }
    expect(conferirMateria(form)?.campo).toBe(idHorario('h1', 'inicio'))
    form.horarios[0].inicio = '25:00'
    expect(conferirMateria(form)?.campo).toBe(idHorario('h1', 'inicio'))
  })
})

describe('conferirRAs', () => {
  it('pede nome e peso de cada RA', () => {
    const form = preenchido()
    expect(conferirRAs(form)).toBeNull()
    form.ras[1].nome = ' '
    expect(conferirRAs(form)?.campo).toBe(idRA(form.ras[1].chave, 'nome'))
    form.ras[1].nome = 'RA2'
    form.ras[1].peso = ''
    expect(conferirRAs(form)).toEqual({
      campo: idRA(form.ras[1].chave, 'peso'),
      mensagem: 'Informe o peso do RA na nota final (ex.: 40 para 40%).',
    })
  })

  it('aceita peso com vírgula e peso 0, mas não todos 0', () => {
    const form = preenchido()
    form.ras[0].peso = '0'
    form.ras[1].peso = '12,5'
    expect(conferirRAs(form)).toBeNull()
    form.ras[1].peso = '0'
    expect(conferirRAs(form)).toEqual({
      campo: idRA(form.ras[0].chave, 'peso'),
      mensagem: 'Pelo menos um RA precisa ter peso maior que 0.',
    })
  })
})

describe('pesos dos RAs', () => {
  it('soma só os pesos válidos e dá a porcentagem de cada um', () => {
    const ras = [{ peso: '20' }, { peso: '30' }, { peso: '50' }, { peso: 'x' }]
    expect(somaPesos(ras)).toBe(100)
    expect(porcentagemRA(ras[0], ras)).toBe('20%')
    expect(porcentagemRA(ras[3], ras)).toBeNull()
  })

  it('pesos relativos: 1 e 2 viram 33,3% e 66,6%', () => {
    const ras = [{ peso: '1' }, { peso: '2' }]
    expect(porcentagemRA(ras[0], ras)).toBe('33,3%')
    expect(porcentagemRA(ras[1], ras)).toBe('66,6%')
    expect(porcentagemRA({ peso: '0' }, [{ peso: '0' }])).toBeNull()
  })
})

describe('conferirAvaliacoes', () => {
  it('confere nome, valor, peso e data de cada avaliação', () => {
    const form = preenchido()
    const av = form.ras[1].avaliacoes[0]
    expect(conferirAvaliacoes(form)).toBeNull()
    av.nome = ''
    expect(conferirAvaliacoes(form)?.campo).toBe(idAvaliacao(av.chave, 'nome'))
    av.nome = 'Projeto'
    for (const valor of ['0', '', 'dez']) {
      av.valorMaximo = valor
      expect(conferirAvaliacoes(form)?.campo).toBe(idAvaliacao(av.chave, 'valor'))
    }
    av.valorMaximo = '10'
    av.peso = '-1'
    expect(conferirAvaliacoes(form)?.campo).toBe(idAvaliacao(av.chave, 'peso'))
    av.peso = '0'
    expect(conferirAvaliacoes(form)).toBeNull()
    av.data = '2026-02-30'
    expect(conferirAvaliacoes(form)?.campo).toBe(idAvaliacao(av.chave, 'data'))
  })

  it('um RA sem avaliações passa (a nota dele fica pendente)', () => {
    const form = preenchido()
    form.ras[1].avaliacoes = []
    expect(conferirAvaliacoes(form)).toBeNull()
  })
})

describe('conferirRegra', () => {
  it('com a regra padrão, não confere os campos da própria', () => {
    const form = preenchido()
    form.regra.mediaMinima = 'abc'
    expect(conferirRegra(form)).toBeNull()
  })

  it('confere cada campo da regra própria', () => {
    const form = { ...preenchido(), usarRegraPadrao: false }
    expect(conferirRegra(form)).toBeNull()
    const com = (campos: Partial<Formulario['regra']>) => conferirRegra({ ...form, regra: { ...form.regra, ...campos } })
    expect(com({ mediaMinima: '11' })?.campo).toBe(ID_MEDIA)
    expect(com({ frequenciaMinima: '101' })?.campo).toBe(ID_FREQUENCIA)
    expect(com({ notaMinima: '8' })?.campo).toBe(ID_NOTA_MINIMA)
    expect(com({ teto: '10,5' })?.campo).toBe(ID_TETO)
    // Sem recuperação, os campos dela não importam.
    expect(com({ temRecuperacao: false, teto: 'x' })).toBeNull()
  })
})

describe('conferirPasso e passoDoErro', () => {
  it('cada passo confere só a parte dele; o último confere tudo', () => {
    const form = preenchido()
    form.ras[0].avaliacoes[0].nome = ''
    expect(conferirPasso(0, form)).toBeNull()
    expect(conferirPasso(1, form)).toBeNull()
    expect(conferirPasso(2, form)).not.toBeNull()
    expect(conferirPasso(4, form)).toEqual(conferirPasso(2, form))
    expect(passoDoErro(form)).toBe(2)
    expect(passoDoErro(preenchido())).toBeNull()
  })
})

describe('montarMateria', () => {
  it('monta a matéria com a regra padrão (sem campo regra), sem notas nem faltas', () => {
    const form = preenchido()
    const materia = montarMateria(form, 'poo')
    expect(materia).toEqual({
      id: 'poo',
      nome: 'POO',
      professor: 'Ana',
      horarios: [{ dia: 2, inicio: '07:45' }],
      cargaHoraria: 80,
      ras: [
        {
          id: form.ras[0].chave,
          nome: 'RA1',
          peso: 40,
          recuperacaoNoSemestre: true,
          notaRecuperacao: null,
          avaliacoes: [
            {
              id: form.ras[0].avaliacoes[0].chave,
              nome: 'Prova 1',
              valorMaximo: 3,
              peso: 1,
              nota: null,
              data: '2026-10-05',
            },
          ],
        },
        {
          id: form.ras[1].chave,
          nome: 'RA2',
          peso: 60,
          recuperacaoNoSemestre: false,
          notaRecuperacao: null,
          avaliacoes: [{ id: form.ras[1].avaliacoes[0].chave, nome: 'Projeto', valorMaximo: 10, peso: 2, nota: null }],
        },
      ],
      pontosExtras: [],
      faltas: [],
    })
    expect(materia).not.toHaveProperty('regra')
    expect(materia.ras[1].avaliacoes[0]).not.toHaveProperty('data')
  })

  it('grava a regra própria, com a frequência como fração', () => {
    const form: Formulario = {
      ...preenchido(),
      usarRegraPadrao: false,
      regra: {
        mediaMinima: '6,0',
        frequenciaMinima: '70',
        temRecuperacao: true,
        notaMinima: '3,5',
        teto: '6',
        arredondarUmaCasa: true,
      },
    }
    expect(montarMateria(form).regra).toEqual({
      mediaMinima: 6,
      frequenciaMinima: 0.7,
      recuperacao: { notaMinima: 3.5, teto: 6 },
      arredondarUmaCasa: true,
    })
    form.regra.temRecuperacao = false
    expect(montarMateria(form).regra).not.toHaveProperty('recuperacao')
  })

  it('gera um id novo quando não recebe um', () => {
    const a = montarMateria(preenchido())
    const b = montarMateria(preenchido())
    expect(a.id).toEqual(expect.any(String))
    expect(a.id).not.toBe(b.id)
  })

  it('a matéria montada passa pela conferência do carregamento', () => {
    const form = { ...preenchido(), usarRegraPadrao: false }
    form.ras.push({ ...novoRA(3), peso: '0', avaliacoes: [{ ...novaAvaliacao(), nome: 'Lista' }] })
    const materia = montarMateria(form, 'poo')
    const lido = validarDados({ versao: VERSAO_ATUAL, materias: [materia], eventos: [], regraPadrao: REGRA_PUCPR })
    expect(lido).toEqual({ ok: true, valor: expect.objectContaining({ materias: [materia] }) })
  })
})

describe('textoRegra', () => {
  it('resume a regra da PUC-PR', () => {
    expect(textoRegra(REGRA_PUCPR)).toEqual([
      'Média mínima 7,0 e frequência mínima de 75%.',
      'Recuperação para quem fica com nota final de 4,0 a 6,9; a nota da recuperação vale no máximo 7,0.',
      'A nota final não é arredondada.',
    ])
  })

  it('diz quando não há recuperação e quando arredonda', () => {
    expect(textoRegra({ mediaMinima: 6, frequenciaMinima: 0.7, arredondarUmaCasa: true })).toEqual([
      'Média mínima 6,0 e frequência mínima de 70%.',
      'Sem recuperação.',
      'A nota final é arredondada para 1 casa antes de comparar.',
    ])
  })
})
