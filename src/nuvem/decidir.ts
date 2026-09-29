import { ehConflito, type RespostaDados, type RespostaErro, type Resposta, type RespostaSalvar } from '../api/contrato'
import { iguais } from '../logica/iguais'
import type { Dados } from '../logica/tipos'
import { vazio } from '../logica/transferencia'
import type { ContaGuardada } from './conta'

// As regras da sincronização (docs/nuvem.md), em funções puras: recebem o que o
// aparelho tem e o que a nuvem respondeu, e dizem o que fazer. Quem faz (chama a
// API, troca os dados, grava a conta) é o sincronizador.

export type Decisao =
  /** Não pode salvar neste navegador: não envia nem troca nada. */
  | { tipo: 'nada' }
  /** Os dados daqui já são os da nuvem: só guarda a revisão e tira o pendente. */
  | { tipo: 'em-dia'; revisao: number }
  /** Troca os dados daqui pelos da nuvem (não havia mudança pendente aqui). */
  | { tipo: 'adotar-nuvem'; dados: Dados; revisao: number }
  /** Envia os dados daqui com esta revisão. */
  | { tipo: 'enviar'; revisao: number }
  /** O envio deu certo; `aindaPendente` quando os dados mudaram enquanto ele ia. */
  | { tipo: 'salvo'; revisao: number; aindaPendente: boolean }
  /** Os dois lados mudaram: para de enviar e pergunta qual manter. */
  | { tipo: 'conflito'; dados: Dados; revisao: number; primeiraVez: boolean }
  | { tipo: 'sem-sessao' }
  | { tipo: 'sem-conexao' }
  /** Outro erro da API (dados inválidos, erro interno...): fica pendente e tenta de novo depois. */
  | { tipo: 'erro'; mensagem: string }

/** O que fazer quando uma chamada à API não deu certo. */
export function decidirErro(erro: RespostaErro): Decisao {
  if (erro.codigo === 'sem-conexao') return { tipo: 'sem-conexao' }
  if (erro.codigo === 'sem-sessao') return { tipo: 'sem-sessao' }
  return { tipo: 'erro', mensagem: erro.erro }
}

interface AoAbrir {
  local: Dados
  conta: ContaGuardada
  nuvem: RespostaDados
  podeSalvar: boolean
}

/** Depois de baixar (ao abrir, ao voltar para a aba, ao voltar a internet, ao entrar). */
export function decidirAoAbrir({ local, conta, nuvem, podeSalvar }: AoAbrir): Decisao {
  if (!podeSalvar) return { tipo: 'nada' }
  if (nuvem.dados === null) {
    // Nuvem vazia: um aparelho sem nada também não tem o que mandar.
    const enviar = !vazio(local) || conta.pendente
    return { tipo: enviar ? 'enviar' : 'em-dia', revisao: nuvem.revisao }
  }
  // Iguais (duas abas que mandaram a mesma coisa, ou entrar num aparelho já igual): não há o que perguntar.
  if (iguais(local, nuvem.dados)) return { tipo: 'em-dia', revisao: nuvem.revisao }
  if (conta.primeiraVez) {
    return vazio(local)
      ? { tipo: 'adotar-nuvem', dados: nuvem.dados, revisao: nuvem.revisao }
      : { tipo: 'conflito', dados: nuvem.dados, revisao: nuvem.revisao, primeiraVez: true }
  }
  if (nuvem.revisao === conta.revisao) {
    return conta.pendente ? { tipo: 'enviar', revisao: conta.revisao } : { tipo: 'em-dia', revisao: conta.revisao }
  }
  if (!conta.pendente) return { tipo: 'adotar-nuvem', dados: nuvem.dados, revisao: nuvem.revisao }
  return { tipo: 'conflito', dados: nuvem.dados, revisao: nuvem.revisao, primeiraVez: false }
}

interface AposSalvar {
  resposta: Resposta<RespostaSalvar>
  /** Os dados de agora (podem ter mudado enquanto o envio ia). */
  local: Dados
  /** Os que foram enviados. */
  enviados: Dados
  revisaoEnviada: number
  primeiraVez: boolean
}

/** Depois de um PUT. */
export function decidirAposSalvar({ resposta, local, enviados, revisaoEnviada, primeiraVez }: AposSalvar): Decisao {
  if (resposta.ok) {
    const aindaPendente = local !== enviados && !iguais(local, enviados)
    return { tipo: 'salvo', revisao: resposta.valor.revisao, aindaPendente }
  }
  if (!ehConflito(resposta.erro)) return decidirErro(resposta.erro)
  const { dados, revisao } = resposta.erro
  if (dados === null) {
    // A nuvem ficou vazia com outra revisão: basta mandar de novo com a dela. Com a
    // mesma revisão seria um 409 que não faz sentido, e reenviar entraria em laço.
    return revisao !== revisaoEnviada
      ? { tipo: 'enviar', revisao }
      : { tipo: 'erro', mensagem: resposta.erro.erro }
  }
  if (iguais(local, dados)) return { tipo: 'em-dia', revisao }
  // A nuvem tem o que foi enviado (outra aba mandou igual), mas aqui já mudou de novo.
  if (iguais(enviados, dados)) return { tipo: 'salvo', revisao, aindaPendente: true }
  return { tipo: 'conflito', dados, revisao, primeiraVez }
}
