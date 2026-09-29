import { describe, expect, it } from 'vitest'
import { REGRA_PUCPR, VERSAO_ATUAL, type Materia, type RegraAprovacao } from '../../src/logica/tipos'
import { validarDados } from '../../src/logica/validacao'
import {
  mudarHorarioForm,
  novoHorario,
  aplicarEdicao,
  erroNotasNaEdicao,
  materiaParaForm,
  perdasDaEdicao,
  conferirAvaliacoes,
  conferirMateria,
  conferirPasso,
  conferirRAs,
  conferirRegra,
  erroRegra,
  idsRegra,
  montarRegra,
  regrasIguais,
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
    horarios: [{ chave: 'h1', dia: 2, inicio: '07:45', fim: '09:15', aulas: '2', aulasManual: false }],
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

  it('confere o início, o fim e as aulas de cada horário', () => {
    const horario = { chave: 'h1', dia: 1 as const, inicio: '', fim: '', aulas: '', aulasManual: false }
    const form = { ...preenchido(), horarios: [horario] }
    expect(conferirMateria(form)?.campo).toBe(idHorario('h1', 'inicio'))
    horario.inicio = '25:00'
    expect(conferirMateria(form)?.campo).toBe(idHorario('h1', 'inicio'))
    horario.inicio = '19:00'
    expect(conferirMateria(form)?.campo).toBe(idHorario('h1', 'fim'))
    horario.fim = '18:00'
    expect(conferirMateria(form)).toEqual({
      campo: idHorario('h1', 'fim'),
      mensagem: 'A aula precisa terminar depois de começar.',
    })
    horario.fim = '22:30'
    expect(conferirMateria(form)?.campo).toBe(idHorario('h1', 'aulas'))
    horario.aulas = '13'
    expect(conferirMateria(form)?.campo).toBe(idHorario('h1', 'aulas'))
    horario.aulas = '4'
    expect(conferirMateria(form)).toBeNull()
  })

  it('sugere as aulas pelo início e fim até a pessoa mexer nelas', () => {
    let h = novoHorario()
    h = mudarHorarioForm(h, { inicio: '19:00' })
    expect(h.aulas).toBe('')
    h = mudarHorarioForm(h, { fim: '22:30' })
    expect(h.aulas).toBe('4')
    h = mudarHorarioForm(h, { fim: '20:30' })
    expect(h.aulas).toBe('2')
    h = mudarHorarioForm(h, { aulas: '3' })
    h = mudarHorarioForm(h, { fim: '22:30' })
    expect(h).toMatchObject({ aulas: '3', aulasManual: true })
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

describe('erroRegra', () => {
  it('aponta para os ids pedidos, para servir fora do formulário de matéria', () => {
    const ids = idsRegra('dados')
    const regra = regraParaForm(REGRA_PUCPR)
    expect(erroRegra(regra, ids)).toBeNull()
    expect(erroRegra({ ...regra, mediaMinima: '' }, ids)?.campo).toBe('dados-regra-media')
    expect(erroRegra({ ...regra, frequenciaMinima: '-1' }, ids)?.campo).toBe('dados-regra-frequencia')
    expect(erroRegra({ ...regra, notaMinima: '7,5' }, ids)?.campo).toBe('dados-regra-nota-minima')
    expect(erroRegra({ ...regra, teto: 'abc' }, ids)?.campo).toBe('dados-regra-teto')
  })

  it('sem ids, usa os do formulário de matéria', () => {
    expect(erroRegra({ ...regraParaForm(REGRA_PUCPR), mediaMinima: '' })?.campo).toBe(ID_MEDIA)
  })

  it('o que passa na conferência também passa no carregamento', () => {
    const regra = montarRegra({ ...regraParaForm(REGRA_PUCPR), mediaMinima: '6,5', frequenciaMinima: '70' })
    const lida = validarDados({ versao: VERSAO_ATUAL, materias: [], eventos: [], regraPadrao: regra })
    expect(lida.ok && lida.valor.regraPadrao).toEqual(regra)
  })
})

describe('regrasIguais', () => {
  it('compara os valores, não a ordem dos campos', () => {
    const mesma: RegraAprovacao = {
      arredondarUmaCasa: false,
      recuperacao: { teto: 7, notaMinima: 4 },
      frequenciaMinima: 0.75,
      mediaMinima: 7,
    }
    expect(regrasIguais(mesma, REGRA_PUCPR)).toBe(true)
    expect(regrasIguais({ ...REGRA_PUCPR, mediaMinima: 6 }, REGRA_PUCPR)).toBe(false)
    expect(regrasIguais({ ...REGRA_PUCPR, arredondarUmaCasa: true }, REGRA_PUCPR)).toBe(false)
    expect(regrasIguais({ ...REGRA_PUCPR, recuperacao: undefined }, REGRA_PUCPR)).toBe(false)
    expect(regrasIguais({ ...REGRA_PUCPR, recuperacao: { notaMinima: 4, teto: 6 } }, REGRA_PUCPR)).toBe(false)
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
      horarios: [{ dia: 2, inicio: '07:45', fim: '09:15', aulas: 2 }],
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

describe('editar uma matéria', () => {
  const POO: Materia = {
    id: 'poo',
    nome: 'POO',
    professor: 'Ana',
    horarios: [{ dia: 2, inicio: '19:00', fim: '22:30', aulas: 4 }],
    cargaHoraria: 120,
    ras: [
      {
        id: 'r1',
        nome: 'RA1',
        peso: 3,
        recuperacaoNoSemestre: false,
        notaRecuperacao: 6.5,
        avaliacoes: [{ id: 'a1', nome: 'Prova 1', peso: 1, valorMaximo: 3, nota: 2.1, data: '2026-09-22' }],
      },
      {
        id: 'r2',
        nome: 'RA2',
        peso: 7,
        recuperacaoNoSemestre: true,
        notaRecuperacao: null,
        avaliacoes: [
          { id: 'a2', nome: 'Projeto', peso: 2, valorMaximo: 10, nota: 8 },
          { id: 'a3', nome: 'Seminário', peso: 1, valorMaximo: 10, nota: null },
        ],
      },
    ],
    pontosExtras: [{ id: 'x', pontos: 0.5, comentario: 'Lista' }],
    faltas: [{ id: 'f', data: '2026-09-02', quantidade: 2 }],
    regra: { mediaMinima: 6, frequenciaMinima: 0.75, arredondarUmaCasa: true },
  }

  it('sem mudar nada, salvar devolve a mesma matéria', () => {
    const form = materiaParaForm(POO, REGRA_PUCPR)
    expect(form).toMatchObject({ nome: 'POO', cargaHoraria: '120', usarRegraPadrao: false })
    expect(form.regra).toMatchObject({ mediaMinima: '6', temRecuperacao: false, arredondarUmaCasa: true })
    expect(form.ras[1].avaliacoes[0]).toMatchObject({ id: 'a2', valorMaximo: '10', peso: '2', data: '' })
    // A chave (usada no id dos campos) é gerada, não é o id salvo.
    expect(form.ras[1].avaliacoes[0].chave).not.toBe('a2')
    expect(aplicarEdicao(POO, form)).toEqual(POO)
  })

  it('mantém as notas do que continua, e o novo começa sem nota', () => {
    const form = materiaParaForm(POO, REGRA_PUCPR)
    form.nome = 'POO (turma U)'
    form.ras[1].avaliacoes[0].peso = '3'
    form.ras[1].avaliacoes.push({ chave: 'nova', nome: 'Quiz', valorMaximo: '1', peso: '1', data: '' })
    const editada = aplicarEdicao(POO, form)
    expect(editada.nome).toBe('POO (turma U)')
    expect(editada.ras[0]).toMatchObject({ notaRecuperacao: 6.5, avaliacoes: [{ nota: 2.1 }] })
    expect(editada.ras[1].avaliacoes).toMatchObject([
      { id: 'a2', peso: 3, nota: 8 },
      { id: 'a3', nota: null },
      { id: 'nova', nota: null },
    ])
    expect(editada.faltas).toBe(POO.faltas)
    expect(editada.pontosExtras).toEqual(POO.pontosExtras)
  })

  it('acha a nota certa quando RAs diferentes têm avaliações de mesmo id (JSON importado)', () => {
    const repetidos: Materia = {
      ...POO,
      ras: [
        { ...POO.ras[0], id: 'RA 1', avaliacoes: [{ ...POO.ras[0].avaliacoes[0], id: 'p1', nota: 2 }] },
        { ...POO.ras[1], id: 'RA 2', avaliacoes: [{ ...POO.ras[1].avaliacoes[0], id: 'p1', nota: 9 }] },
      ],
    }
    const form = materiaParaForm(repetidos, REGRA_PUCPR)
    // Chaves diferentes, então os campos na tela não se confundem.
    expect(form.ras[0].avaliacoes[0].chave).not.toBe(form.ras[1].avaliacoes[0].chave)
    expect(aplicarEdicao(repetidos, form)).toEqual(repetidos)

    // Tirar a do RA2 apaga só a nota 9, e não a 2 do RA1.
    form.ras[1].avaliacoes = []
    expect(perdasDaEdicao(repetidos, form)).toEqual(['Nota 9,0 de Projeto (RA2)'])
    // O valor 3 cabe a nota 2 do RA1, mesmo com o outro "p1" tendo 9.
    form.ras[0].avaliacoes[0].valorMaximo = '3'
    expect(erroNotasNaEdicao(repetidos, form)).toBeNull()
  })

  it('guarda a recuperação lançada mesmo com uma regra própria sem recuperação', () => {
    // A conta ignora a nota enquanto a regra não tem recuperação; voltando a ter, ela reaparece.
    const form = materiaParaForm({ ...POO, regra: { ...POO.regra!, recuperacao: undefined } }, REGRA_PUCPR)
    expect(form.regra.temRecuperacao).toBe(false)
    expect(aplicarEdicao(POO, form).ras[0].notaRecuperacao).toBe(6.5)
  })

  it('horário salvo antes de existir o fim: o formulário pede para completar', () => {
    const antiga: Materia = { ...POO, horarios: [{ dia: 2, inicio: '19:00' }] }
    const form = materiaParaForm(antiga, REGRA_PUCPR)
    expect(form.horarios[0]).toMatchObject({ inicio: '19:00', fim: '', aulas: '', aulasManual: false })
    expect(conferirMateria(form)).toMatchObject({ campo: idHorario(form.horarios[0].chave, 'fim') })
    // Completar o fim sugere as aulas, e aí dá para salvar.
    form.horarios[0] = mudarHorarioForm(form.horarios[0], { fim: '22:30' })
    expect(form.horarios[0].aulas).toBe('4')
    expect(conferirMateria(form)).toBeNull()
  })

  it('remover um RA leva os pontos extras dele, e a revisão avisa', () => {
    const comExtras: Materia = {
      ...POO,
      pontosExtras: [
        { id: 'x1', pontos: 0.5, comentario: 'Lista', raId: 'r1' },
        { id: 'x2', pontos: 0.2, comentario: 'Monitoria' },
      ],
    }
    const form = materiaParaForm(comExtras, REGRA_PUCPR)
    form.ras = [form.ras[1]]
    expect(perdasDaEdicao(comExtras, form)).toContain('Ponto extra +0,5 de RA1 (Lista)')
    expect(aplicarEdicao(comExtras, form).pontosExtras).toEqual([{ id: 'x2', pontos: 0.2, comentario: 'Monitoria' }])
  })

  it('voltar para a regra padrão tira o campo regra', () => {
    const form = { ...materiaParaForm(POO, REGRA_PUCPR), usarRegraPadrao: true }
    expect(aplicarEdicao(POO, form)).not.toHaveProperty('regra')
  })

  it('lista as notas que somem com a avaliação ou o RA removidos', () => {
    const form = materiaParaForm(POO, REGRA_PUCPR)
    expect(perdasDaEdicao(POO, form)).toEqual([])
    // Tira o RA1 inteiro (nota e recuperação) e o Seminário, que não tem nota.
    form.ras = [{ ...form.ras[1], avaliacoes: [form.ras[1].avaliacoes[0]] }]
    expect(perdasDaEdicao(POO, form)).toEqual(['Nota 2,1 de Prova 1 (RA1)', 'Recuperação 6,5 de RA1'])
  })

  it('não deixa a avaliação valer menos que a nota que já tem', () => {
    const form = materiaParaForm(POO, REGRA_PUCPR)
    expect(erroNotasNaEdicao(POO, form)).toBeNull()
    form.ras[1].avaliacoes[0].valorMaximo = '5'
    expect(erroNotasNaEdicao(POO, form)).toEqual({
      campo: `nm-av-${form.ras[1].avaliacoes[0].chave}-valor`,
      mensagem: 'Esta avaliação já tem nota 8,0; ela não pode valer menos que isso.',
    })
    // Avaliação sem nota pode valer quanto quiser.
    form.ras[1].avaliacoes[0].valorMaximo = '10'
    form.ras[1].avaliacoes[1].valorMaximo = '1'
    expect(erroNotasNaEdicao(POO, form)).toBeNull()
  })
})

