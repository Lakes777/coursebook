import type {
  Avaliacao,
  Dados,
  Evento,
  Falta,
  Materia,
  PontoExtra,
  RegraAprovacao,
  ResultadoAprendizagem,
} from '../logica/tipos'

// Tudo o que pode mudar nos dados. Quem dispara a ação já manda o objeto pronto,
// com id (novoId()) e conferido pelas funções erro* dos formulários: o reducer
// só aplica, para ser puro (o StrictMode chama ele duas vezes).

// Nos "editar", só muda o que vier em `campos`. Um campo mandado como undefined
// é apagado: { regra: undefined } volta a matéria para a regra padrão, e
// { materiaId: undefined } tira o evento da matéria.

/** Campos da matéria que o formulário edita; as listas têm ações próprias. */
export type CamposMateria = Partial<Pick<Materia, 'nome' | 'professor' | 'horarios' | 'cargaHoraria' | 'regra'>>
export type CamposRA = Partial<Omit<ResultadoAprendizagem, 'id' | 'avaliacoes'>>
export type CamposAvaliacao = Partial<Omit<Avaliacao, 'id'>>
export type CamposEvento = Partial<Omit<Evento, 'id'>>

export type Acao =
  | { tipo: 'materia/adicionar'; materia: Materia }
  | { tipo: 'materia/editar'; materiaId: string; campos: CamposMateria }
  /** Remove também os eventos da matéria. */
  | { tipo: 'materia/remover'; materiaId: string }
  | { tipo: 'ra/adicionar'; materiaId: string; ra: ResultadoAprendizagem }
  | { tipo: 'ra/editar'; materiaId: string; raId: string; campos: CamposRA }
  | { tipo: 'ra/remover'; materiaId: string; raId: string }
  | { tipo: 'avaliacao/adicionar'; materiaId: string; raId: string; avaliacao: Avaliacao }
  | { tipo: 'avaliacao/editar'; materiaId: string; raId: string; avaliacaoId: string; campos: CamposAvaliacao }
  | { tipo: 'avaliacao/remover'; materiaId: string; raId: string; avaliacaoId: string }
  | { tipo: 'pontoExtra/adicionar'; materiaId: string; pontoExtra: PontoExtra }
  | { tipo: 'pontoExtra/remover'; materiaId: string; pontoExtraId: string }
  | { tipo: 'falta/adicionar'; materiaId: string; falta: Falta }
  | { tipo: 'falta/remover'; materiaId: string; faltaId: string }
  | { tipo: 'evento/adicionar'; evento: Evento }
  | { tipo: 'evento/editar'; eventoId: string; campos: CamposEvento }
  | { tipo: 'evento/remover'; eventoId: string }
  | { tipo: 'regraPadrao/definir'; regra: RegraAprovacao }
  /** Troca tudo (importar um JSON já conferido por lerDados). */
  | { tipo: 'dados/substituir'; dados: Dados }
