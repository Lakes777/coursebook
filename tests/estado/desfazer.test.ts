import { describe, expect, it } from 'vitest'
import { reduzirPainel, textoDesfazer, type EstadoPainel } from '../../src/estado/desfazer'
import { dadosVazios } from '../../src/logica/armazenamento'
import { REGRA_PUCPR, type Dados } from '../../src/logica/tipos'

function dados(): Dados {
  return {
    versao: 1,
    materias: [
      {
        id: 'poo',
        nome: 'POO',
        professor: '',
        horarios: [],
        cargaHoraria: 120,
        ras: [
          {
            id: 'ra1',
            nome: 'RA1',
            peso: 3,
            avaliacoes: [{ id: 'p1', nome: 'Prova', peso: 1, valorMaximo: 3, nota: 2.5 }],
            recuperacaoNoSemestre: true,
            notaRecuperacao: 6,
          },
        ],
        pontosExtras: [{ id: 'x1', pontos: 0.3, comentario: 'Lista' }],
        faltas: [{ id: 'f1', data: '2026-09-01', quantidade: 2 }],
      },
    ],
    eventos: [{ id: 'e1', materiaId: 'poo', titulo: 'Prova 2', tipo: 'prova', data: '2026-10-01', concluido: false }],
    regraPadrao: REGRA_PUCPR,
  }
}

const comecar = (): EstadoPainel => ({ dados: dados(), desfazer: null })

describe('textoDesfazer', () => {
  const antes = dados()

  it('descreve cada remoção com o nome do que saiu', () => {
    expect(textoDesfazer({ tipo: 'materia/remover', materiaId: 'poo' }, antes)).toBe('Matéria "POO" removida.')
    expect(textoDesfazer({ tipo: 'ra/remover', materiaId: 'poo', raId: 'ra1' }, antes)).toBe('RA1 removido.')
    expect(
      textoDesfazer({ tipo: 'avaliacao/remover', materiaId: 'poo', raId: 'ra1', avaliacaoId: 'p1' }, antes),
    ).toBe('Avaliação "Prova" removida.')
    expect(textoDesfazer({ tipo: 'pontoExtra/remover', materiaId: 'poo', pontoExtraId: 'x1' }, antes)).toBe(
      'Ponto extra removido.',
    )
    expect(textoDesfazer({ tipo: 'falta/remover', materiaId: 'poo', faltaId: 'f1' }, antes)).toBe('Falta removida.')
    expect(textoDesfazer({ tipo: 'evento/remover', eventoId: 'e1' }, antes)).toBe('"Prova 2" removido da agenda.')
  })

  it('apagar uma nota conta como remover; mudar a nota, não', () => {
    const apagar = { tipo: 'avaliacao/editar', materiaId: 'poo', raId: 'ra1', avaliacaoId: 'p1' } as const
    expect(textoDesfazer({ ...apagar, campos: { nota: null } }, antes)).toBe('Nota de "Prova" apagada.')
    expect(textoDesfazer({ ...apagar, campos: { nota: 3 } }, antes)).toBeNull()
    expect(textoDesfazer({ ...apagar, campos: { nome: 'P1' } }, antes)).toBeNull()
    const rec = { tipo: 'ra/editar', materiaId: 'poo', raId: 'ra1' } as const
    expect(textoDesfazer({ ...rec, campos: { notaRecuperacao: null } }, antes)).toBe(
      'Nota de recuperação de "RA1" apagada.',
    )
    expect(textoDesfazer({ ...rec, campos: { peso: 2 } }, antes)).toBeNull()
  })

  it('apagar uma nota que já estava vazia não oferece desfazer', () => {
    const vazia = dados()
    vazia.materias[0].ras[0].avaliacoes[0].nota = null
    expect(
      textoDesfazer(
        { tipo: 'avaliacao/editar', materiaId: 'poo', raId: 'ra1', avaliacaoId: 'p1', campos: { nota: null } },
        vazia,
      ),
    ).toBeNull()
  })

  it('adicionar não oferece desfazer', () => {
    const falta = { id: 'f2', data: '2026-09-02', quantidade: 1 }
    expect(textoDesfazer({ tipo: 'falta/adicionar', materiaId: 'poo', falta }, antes)).toBeNull()
  })

  it('substituir os dados só oferece desfazer quando havia algo', () => {
    expect(textoDesfazer({ tipo: 'dados/substituir', dados: dadosVazios() }, antes)).toBe(
      'Dados do painel substituídos.',
    )
    expect(textoDesfazer({ tipo: 'dados/substituir', dados: antes }, dadosVazios())).toBeNull()
  })

  it('editar a matéria pelo formulário e trocar a regra padrão também', () => {
    const materia = { ...antes.materias[0], nome: 'Programação OO' }
    expect(textoDesfazer({ tipo: 'materia/substituir', materia }, antes)).toBe('Alterações em "POO" salvas.')
    expect(textoDesfazer({ tipo: 'regraPadrao/definir', regra: REGRA_PUCPR }, antes)).toBe(
      'Regra padrão alterada.',
    )
  })
})

describe('reduzirPainel', () => {
  it('remover e desfazer volta exatamente os dados de antes', () => {
    const inicio = comecar()
    const removido = reduzirPainel(inicio, { tipo: 'falta/remover', materiaId: 'poo', faltaId: 'f1' })
    expect(removido.dados.materias[0].faltas).toEqual([])
    expect(removido.desfazer?.texto).toBe('Falta removida.')
    const voltou = reduzirPainel(removido, { tipo: 'desfazer' })
    expect(voltou.dados).toBe(inicio.dados)
    expect(voltou.desfazer).toBeNull()
  })

  it('qualquer ação nova esquece o desfazer anterior', () => {
    let estado = reduzirPainel(comecar(), { tipo: 'falta/remover', materiaId: 'poo', faltaId: 'f1' })
    estado = reduzirPainel(estado, {
      tipo: 'falta/adicionar',
      materiaId: 'poo',
      falta: { id: 'f2', data: '2026-09-02', quantidade: 1 },
    })
    expect(estado.desfazer).toBeNull()
    // Desfazer agora não pode fazer nada (voltaria a falta nova junto).
    expect(reduzirPainel(estado, { tipo: 'desfazer' })).toBe(estado)
  })

  it('ação que não muda nada (id inexistente) mantém o desfazer', () => {
    const removido = reduzirPainel(comecar(), { tipo: 'falta/remover', materiaId: 'poo', faltaId: 'f1' })
    const igual = reduzirPainel(removido, { tipo: 'falta/remover', materiaId: 'poo', faltaId: 'nao-existe' })
    expect(igual).toBe(removido)
  })

  it('esquecer fecha o aviso sem mexer nos dados', () => {
    const removido = reduzirPainel(comecar(), { tipo: 'evento/remover', eventoId: 'e1' })
    const esquecido = reduzirPainel(removido, { tipo: 'desfazer/esquecer' })
    expect(esquecido.dados).toBe(removido.dados)
    expect(esquecido.desfazer).toBeNull()
  })

  it('sincronizar troca os dados e não deixa desfazer por cima do que veio da outra aba', () => {
    const removido = reduzirPainel(comecar(), { tipo: 'evento/remover', eventoId: 'e1' })
    const outros = dadosVazios()
    const sincronizado = reduzirPainel(removido, { tipo: 'sincronizar', dados: outros })
    expect(sincronizado).toEqual({ dados: outros, desfazer: null })
    expect(sincronizado.dados).toBe(outros)
  })
})
