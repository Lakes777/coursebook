import { paraDataISO } from './datas'
import { REGRA_PUCPR, VERSAO_ATUAL, type DataISO, type Dados } from './tipos'

// Dados de exemplo, inventados, para quem abre o painel pela primeira vez (ou vê o
// projeto no portfólio) enxergar como ele fica em uso. Cada matéria mostra uma
// situação: já aprovada, precisando de nota e em recuperação perto do limite de faltas.
// As datas contam a partir de hoje, para a agenda ter sempre algo atrasado, para hoje
// e chegando, em qualquer dia em que o exemplo for aberto.

/** A data `dias` depois de `hoje` (negativo = antes). */
function dia(hoje: Date, dias: number): DataISO {
  return paraDataISO(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias))
}

export function dadosDeExemplo(hoje: Date = new Date()): Dados {
  const d = (dias: number) => dia(hoje, dias)
  return {
    versao: VERSAO_ATUAL,
    regraPadrao: structuredClone(REGRA_PUCPR),
    materias: [
      {
        // Já fechada e aprovada, com ponto extra.
        id: 'exemplo-estruturas',
        nome: 'Estruturas de Dados',
        professor: 'Prof.ª Helena Duarte',
        horarios: [
          { dia: 1, inicio: '19:00', fim: '20:30', aulas: 2 },
          { dia: 3, inicio: '19:00', fim: '20:30', aulas: 2 },
        ],
        cargaHoraria: 80,
        ras: [
          {
            id: 'ra1',
            nome: 'RA1',
            peso: 40,
            recuperacaoNoSemestre: false,
            notaRecuperacao: null,
            avaliacoes: [{ id: 'prova1', nome: 'Prova 1', peso: 1, valorMaximo: 10, nota: 8.5, data: d(-45) }],
          },
          {
            id: 'ra2',
            nome: 'RA2',
            peso: 60,
            recuperacaoNoSemestre: false,
            notaRecuperacao: null,
            avaliacoes: [
              { id: 'prova2', nome: 'Prova 2', peso: 1, valorMaximo: 10, nota: 9, data: d(-8) },
              { id: 'relatorio', nome: 'Relatório de árvores', peso: 1, valorMaximo: 10, nota: 7.5, data: d(-1) },
            ],
          },
        ],
        pontosExtras: [{ id: 'monitoria', pontos: 0.3, comentario: 'Monitoria no laboratório', data: d(-20) }],
        faltas: [
          { id: 'f1', data: d(-30), quantidade: 2 },
          { id: 'f2', data: d(-12), quantidade: 2 },
        ],
      },
      {
        // Nota como soma de pontos (3,0 + 3,0 + 4,0): ainda precisa de nota no que falta.
        id: 'exemplo-poo',
        nome: 'Programação Orientada a Objetos',
        professor: 'Prof. Ricardo Matos',
        horarios: [
          { dia: 2, inicio: '19:00', fim: '22:30', aulas: 4 },
          { dia: 4, inicio: '19:00', fim: '22:30', aulas: 4 },
        ],
        cargaHoraria: 120,
        ras: [
          {
            id: 'ra1',
            nome: 'RA1',
            peso: 3,
            recuperacaoNoSemestre: false,
            notaRecuperacao: null,
            avaliacoes: [{ id: 'prova1', nome: 'Prova do RA1', peso: 1, valorMaximo: 3, nota: 1.8, data: d(-10) }],
          },
          {
            id: 'ra2',
            nome: 'RA2',
            peso: 3,
            recuperacaoNoSemestre: true,
            notaRecuperacao: null,
            avaliacoes: [{ id: 'prova2', nome: 'Prova do RA2', peso: 1, valorMaximo: 3, nota: null, data: d(5) }],
          },
          {
            id: 'ra3',
            nome: 'RA3',
            peso: 4,
            recuperacaoNoSemestre: false,
            notaRecuperacao: null,
            avaliacoes: [{ id: 'projeto', nome: 'Projeto em equipe', peso: 1, valorMaximo: 4, nota: null, data: d(40) }],
          },
        ],
        pontosExtras: [],
        faltas: [
          { id: 'f1', data: d(-25), quantidade: 3 },
          { id: 'f2', data: d(-4), quantidade: 3 },
        ],
      },
      {
        // Fechou abaixo da média (vai para a recuperação) e está perto do limite de faltas.
        id: 'exemplo-calculo',
        nome: 'Cálculo Numérico',
        professor: 'Prof. Márcio Sampaio',
        horarios: [{ dia: 5, inicio: '07:45', fim: '11:15', aulas: 4 }],
        cargaHoraria: 60,
        ras: [
          {
            id: 'ra1',
            nome: 'RA1',
            peso: 50,
            recuperacaoNoSemestre: true,
            notaRecuperacao: null,
            avaliacoes: [{ id: 'prova1', nome: 'Prova 1', peso: 1, valorMaximo: 10, nota: 3.5, data: d(-40) }],
          },
          {
            id: 'ra2',
            nome: 'RA2',
            peso: 50,
            recuperacaoNoSemestre: false,
            notaRecuperacao: null,
            avaliacoes: [
              { id: 'prova2', nome: 'Prova 2', peso: 2, valorMaximo: 10, nota: 4.5, data: d(-6) },
              { id: 'listas', nome: 'Listas de exercícios', peso: 1, valorMaximo: 10, nota: 7, data: d(-6) },
            ],
          },
        ],
        pontosExtras: [],
        faltas: [
          { id: 'f1', data: d(-35), quantidade: 3 },
          { id: 'f2', data: d(-21), quantidade: 3 },
          { id: 'f3', data: d(-14), quantidade: 3 },
          { id: 'f4', data: d(-7), quantidade: 3 },
        ],
      },
    ],
    eventos: [
      { id: 'e1', materiaId: 'exemplo-calculo', titulo: 'Lista de exercícios 5', tipo: 'trabalho', data: d(-2), concluido: false },
      { id: 'e2', materiaId: 'exemplo-estruturas', titulo: 'Entrega do relatório final', tipo: 'trabalho', data: d(0), concluido: false },
      { id: 'e3', materiaId: 'exemplo-poo', titulo: 'Prova do RA2', tipo: 'prova', data: d(5), concluido: false },
      { id: 'e4', materiaId: 'exemplo-calculo', titulo: 'Recuperação do RA1', tipo: 'prova', data: d(12), concluido: false },
      { id: 'e5', materiaId: 'exemplo-poo', titulo: 'Apresentação do projeto', tipo: 'apresentacao', data: d(40), concluido: false },
      { id: 'e6', materiaId: 'exemplo-poo', titulo: 'Prova do RA1', tipo: 'prova', data: d(-10), concluido: true },
      { id: 'e7', titulo: 'Rematrícula', tipo: 'trabalho', data: d(60), concluido: false },
    ],
  }
}
