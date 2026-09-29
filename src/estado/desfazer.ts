import type { Dados } from '../logica/tipos'
import type { Acao } from './acoes'
import { reduzir } from './reduzir'

// Desfazer guarda uma cópia dos dados de ANTES da última ação que apaga ou troca
// algo (remover, apagar uma nota, importar...). Como o reducer nunca altera o objeto
// que recebe, guardar a referência basta: nada é copiado.
//
// Só a última ação pode ser desfeita, e qualquer ação nova esquece a anterior:
// voltar aos dados guardados depois de outra mudança apagaria essa mudança também.

export interface Desfazer {
  /** O que aconteceu, para o aviso: "Falta removida." */
  texto: string
  antes: Dados
}

export interface EstadoPainel {
  dados: Dados
  desfazer: Desfazer | null
}

export type AcaoPainel =
  | Acao
  | { tipo: 'desfazer' }
  /** Fecha o aviso de desfazer sem voltar nada. */
  | { tipo: 'desfazer/esquecer' }
  /** Outra aba salvou: troca os dados sem oferecer desfazer (voltaria o que a outra aba fez). */
  | { tipo: 'sincronizar'; dados: Dados }

const aspas = (nome: string) => `"${nome.trim() || 'sem nome'}"`

/** A frase do aviso de desfazer, ou null quando a ação não apaga nada (e não precisa de desfazer). */
export function textoDesfazer(acao: Acao, antes: Dados): string | null {
  const materia = 'materiaId' in acao ? antes.materias.find((m) => m.id === acao.materiaId) : undefined
  const ra = materia && 'raId' in acao ? materia.ras.find((r) => r.id === acao.raId) : undefined
  switch (acao.tipo) {
    case 'materia/remover':
      return materia ? `Matéria ${aspas(materia.nome)} removida.` : null
    case 'materia/substituir': {
      const velha = antes.materias.find((m) => m.id === acao.materia.id)
      return velha ? `Alterações em ${aspas(velha.nome)} salvas.` : null
    }
    case 'ra/remover':
      return ra ? `${ra.nome.trim() || 'RA'} removido.` : null
    case 'ra/editar':
      // Apagar a nota de recuperação é o "remover" do RA.
      return ra && 'notaRecuperacao' in acao.campos && acao.campos.notaRecuperacao == null && ra.notaRecuperacao !== null
        ? `Nota de recuperação de ${aspas(ra.nome)} apagada.`
        : null
    case 'avaliacao/remover': {
      const avaliacao = ra?.avaliacoes.find((a) => a.id === acao.avaliacaoId)
      return avaliacao ? `Avaliação ${aspas(avaliacao.nome)} removida.` : null
    }
    case 'avaliacao/editar': {
      const avaliacao = ra?.avaliacoes.find((a) => a.id === acao.avaliacaoId)
      return avaliacao && 'nota' in acao.campos && acao.campos.nota == null && avaliacao.nota !== null
        ? `Nota de ${aspas(avaliacao.nome)} apagada.`
        : null
    }
    case 'pontoExtra/remover':
      return materia?.pontosExtras.some((p) => p.id === acao.pontoExtraId) ? 'Ponto extra removido.' : null
    case 'falta/remover':
      return materia?.faltas.some((f) => f.id === acao.faltaId) ? 'Falta removida.' : null
    case 'evento/remover': {
      const evento = antes.eventos.find((e) => e.id === acao.eventoId)
      return evento ? `${aspas(evento.titulo)} removido da agenda.` : null
    }
    case 'regraPadrao/definir':
      return 'Regra padrão alterada.'
    case 'dados/substituir':
      // Sem nada antes (ex.: abrir o exemplo num painel vazio), não há o que perder.
      return antes.materias.length > 0 || antes.eventos.length > 0 ? 'Dados do painel substituídos.' : null
    default:
      return null
  }
}

export function reduzirPainel(estado: EstadoPainel, acao: AcaoPainel): EstadoPainel {
  switch (acao.tipo) {
    case 'desfazer':
      return estado.desfazer ? { dados: estado.desfazer.antes, desfazer: null } : estado
    case 'desfazer/esquecer':
      return estado.desfazer ? { ...estado, desfazer: null } : estado
    case 'sincronizar':
      return { dados: acao.dados, desfazer: null }
    default: {
      const dados = reduzir(estado.dados, acao)
      // Nada mudou (id que não existe): o desfazer anterior continua valendo.
      if (dados === estado.dados) return estado
      const texto = textoDesfazer(acao, estado.dados)
      return { dados, desfazer: texto ? { texto, antes: estado.dados } : null }
    }
  }
}
