import type { ClienteNuvem } from '../api/contrato'
import type { Dados } from '../logica/tipos'
import { gravarConta, lerConta, mesmoEmail, type ArmazenamentoNuvem, type ContaGuardada } from './conta'
import { decidirAoAbrir, decidirAposSalvar, decidirErro, type Decisao } from './decidir'

// Quem faz a sincronização acontecer: chama a API, pergunta às regras de decidir.ts
// o que fazer e faz (troca os dados, grava a conta, agenda o próximo envio). Fica
// fora do React para os testes rodarem só com uma API falsa e fake timers; o
// ProvedorNuvem só liga isto aos dados do painel e aos eventos do navegador.

/** Espera depois da última mudança antes de enviar: digitar uma nota não vira um envio por tecla. */
export const ESPERA_ENVIO_MS = 2000

export type Situacao =
  /** Baixando da nuvem para conferir (ao abrir, ao voltar para a aba, ao entrar). */
  | { tipo: 'conferindo' }
  | { tipo: 'sincronizado' }
  /** Há mudança esperando para ir, ou indo. */
  | { tipo: 'salvando' }
  | { tipo: 'sem-conexao' }
  | { tipo: 'sem-sessao' }
  /** Os dois lados mudaram: nada é enviado até a pessoa escolher. */
  | { tipo: 'conflito'; dados: Dados; revisao: number; primeiraVez: boolean }
  | { tipo: 'erro'; mensagem: string }
  /** Este navegador não está salvando (podeSalvar false): a nuvem também para. */
  | { tipo: 'parado' }

export interface EstadoNuvem {
  conta: ContaGuardada | null
  situacao: Situacao
}

export interface Opcoes {
  cliente: ClienteNuvem
  armazenamento: ArmazenamentoNuvem
  /** Os dados de agora: lidos na hora de decidir, e não quando a chamada começou. */
  dados(): Dados
  podeSalvar(): boolean
  /** Troca os dados do painel pelos da nuvem; `desfazivel` põe o aviso de desfazer. */
  trocarDados(dados: Dados, desfazivel: boolean): void
  aoMudar(estado: EstadoNuvem): void
}

export interface Sincronizador {
  estado(): EstadoNuvem
  /** Baixa e confere (ao abrir, ao voltar para a aba, no evento online). */
  conferir(): Promise<void>
  /** Os dados mudaram por uma ação feita nesta aba: marca pendente e agenda o envio. */
  mudou(): void
  /** Entrou (ou criou a conta) com este e-mail: começa a sincronizar. */
  entrou(email: string): Promise<void>
  /** Saiu ou excluiu a conta: esquece a conta neste aparelho (os dados ficam). */
  esquecer(): void
  /** Resposta à pergunta do conflito. */
  resolver(escolha: 'nuvem' | 'aparelho'): Promise<void>
  /** Outra aba mudou a chave da conta (evento storage): passa a ver a mesma revisão. */
  releuConta(): void
  /** Desliga (ao desmontar): cancela o envio agendado e ignora as respostas que ainda vierem. */
  parar(): void
}

/** Como a nuvem aparece antes da primeira conferência: com conta, "Sincronizando...". */
export function estadoInicial(armazenamento: ArmazenamentoNuvem): EstadoNuvem {
  const conta = lerConta(armazenamento)
  return { conta, situacao: conta ? { tipo: 'conferindo' } : { tipo: 'sincronizado' } }
}

export function criarSincronizador(o: Opcoes): Sincronizador {
  let { conta, situacao } = estadoInicial(o.armazenamento)
  let agendado: ReturnType<typeof setTimeout> | undefined
  // Uma chamada de cada vez: dois PUTs ao mesmo tempo com a mesma revisão dariam conflito consigo mesmo.
  let fila: Promise<void> = Promise.resolve()
  let conferirNaFila = false
  // Muda ao entrar, sair ou trocar de conta em outra aba: a resposta de uma chamada
  // que começou antes não vale mais e é ignorada.
  let geracao = 0
  let desligado = false

  const avisar = () => {
    if (!desligado) o.aoMudar({ conta, situacao })
  }
  const mudar = (nova: Situacao) => {
    situacao = nova
    avisar()
  }
  const mudarConta = (nova: ContaGuardada | null) => {
    conta = nova
    gravarConta(o.armazenamento, nova)
  }
  /** Conta em dia com esta revisão (e, com isso, já passou da primeira vez). */
  const emDia = (c: ContaGuardada, revisao: number, pendente = false): ContaGuardada => ({
    email: c.email,
    revisao,
    pendente,
  })

  function cancelarEnvio() {
    clearTimeout(agendado)
    agendado = undefined
  }

  function executar(tarefa: () => Promise<void>): Promise<void> {
    // O catch não deixa um erro inesperado travar a fila para sempre.
    fila = fila
      .then(() => (desligado ? undefined : tarefa()))
      .catch(() => mudar({ tipo: 'erro', mensagem: 'Erro inesperado ao sincronizar.' }))
    return fila
  }

  async function aplicar(decisao: Decisao): Promise<void> {
    if (!conta) return
    switch (decisao.tipo) {
      case 'nada':
        return mudar({ tipo: 'parado' })
      case 'em-dia':
        mudarConta(emDia(conta, decisao.revisao))
        return mudar({ tipo: 'sincronizado' })
      case 'adotar-nuvem':
        o.trocarDados(decisao.dados, false)
        mudarConta(emDia(conta, decisao.revisao))
        return mudar({ tipo: 'sincronizado' })
      case 'enviar':
        return enviar(decisao.revisao)
      case 'salvo':
        mudarConta(emDia(conta, decisao.revisao, decisao.aindaPendente))
        if (!decisao.aindaPendente) return mudar({ tipo: 'sincronizado' })
        agendar()
        return mudar({ tipo: 'salvando' })
      case 'conflito':
        cancelarEnvio()
        return mudar(decisao)
      case 'sem-sessao':
      case 'sem-conexao':
        return mudar({ tipo: decisao.tipo })
      case 'erro':
        return mudar(decisao)
    }
  }

  async function conferirAgora(): Promise<void> {
    conferirNaFila = false
    const g = geracao
    // Com a pergunta na tela, baixar de novo só a faria piscar; quem responde decide.
    if (!conta || situacao.tipo === 'conflito') return
    if (!o.podeSalvar()) return mudar({ tipo: 'parado' })
    // "Sincronizado" não vira "Sincronizando..." a cada volta para a aba.
    if (situacao.tipo !== 'sincronizado') mudar({ tipo: 'conferindo' })
    const eu = await o.cliente.eu()
    if (g !== geracao || !conta) return
    if (!eu.ok) return aplicar(decidirErro(eu.erro))
    // Sessão de outra conta neste navegador conta como sem sessão para esta.
    if (!eu.valor || !mesmoEmail(eu.valor.email, conta.email)) return aplicar({ tipo: 'sem-sessao' })
    const nuvem = await o.cliente.baixar()
    if (g !== geracao || !conta) return
    if (!nuvem.ok) return aplicar(decidirErro(nuvem.erro))
    return aplicar(decidirAoAbrir({ local: o.dados(), conta, nuvem: nuvem.valor, podeSalvar: o.podeSalvar() }))
  }

  async function enviar(revisao: number): Promise<void> {
    const g = geracao
    if (!conta) return
    if (!o.podeSalvar()) return mudar({ tipo: 'parado' })
    const enviados = o.dados()
    mudar({ tipo: 'salvando' })
    const resposta = await o.cliente.salvar({ dados: enviados, revisao })
    if (g !== geracao || !conta) return
    return aplicar(
      decidirAposSalvar({
        resposta,
        local: o.dados(),
        enviados,
        revisaoEnviada: revisao,
        primeiraVez: conta.primeiraVez === true,
      }),
    )
  }

  function agendar() {
    cancelarEnvio()
    agendado = setTimeout(() => {
      agendado = undefined
      void executar(async () => {
        if (!conta || situacao.tipo === 'conflito') return
        // Antes de decidir a primeira vez, um envio simples poderia passar por cima da nuvem.
        return conta.primeiraVez ? conferirAgora() : enviar(conta.revisao)
      })
    }, ESPERA_ENVIO_MS)
  }

  function conferir(): Promise<void> {
    // Voltar para a aba várias vezes seguidas não enfileira várias conferências.
    if (!conta || conferirNaFila) return fila
    conferirNaFila = true
    return executar(conferirAgora)
  }

  return {
    estado: () => ({ conta, situacao }),
    conferir,

    mudou() {
      if (!conta) return
      if (!conta.pendente) mudarConta({ ...conta, pendente: true })
      // Com a pergunta na tela ou sem sessão, fica só pendente (enviar daria 409 ou 401).
      if (situacao.tipo === 'conflito' || situacao.tipo === 'sem-sessao' || !o.podeSalvar()) return
      agendar()
      if (situacao.tipo !== 'salvando') mudar({ tipo: 'salvando' })
    },

    entrou(email) {
      geracao++
      cancelarEnvio()
      // A mesma conta de antes (a sessão tinha acabado): continua de onde parou, com o pendente.
      const mesma = conta && mesmoEmail(conta.email, email)
      mudarConta(mesma && conta ? { ...conta, email } : { email, revisao: 0, pendente: false, primeiraVez: true })
      situacao = { tipo: 'conferindo' }
      avisar()
      conferirNaFila = false
      return conferir()
    },

    esquecer() {
      geracao++
      cancelarEnvio()
      mudarConta(null)
      mudar({ tipo: 'sincronizado' })
    },

    async resolver(escolha) {
      if (!conta || situacao.tipo !== 'conflito') return
      const { dados, revisao } = situacao
      if (escolha === 'nuvem') {
        // Com desfazer: quem escolheu errado volta os dados daqui, e a volta é enviada.
        o.trocarDados(dados, true)
        mudarConta(emDia(conta, revisao))
        return mudar({ tipo: 'sincronizado' })
      }
      // Manter os daqui: envia com a revisão da nuvem, e aí o PUT passa por cima.
      mudar({ tipo: 'salvando' })
      return executar(() => enviar(revisao))
    },

    releuConta() {
      const nova = lerConta(o.armazenamento)
      const antes = conta
      conta = nova
      if (!nova) {
        // A outra aba saiu da conta.
        if (!antes) return
        geracao++
        cancelarEnvio()
        return mudar({ tipo: 'sincronizado' })
      }
      if (!antes || !mesmoEmail(antes.email, nova.email)) {
        // A outra aba entrou (e é ela que está sincronizando).
        geracao++
        cancelarEnvio()
        return mudar({ tipo: nova.primeiraVez ? 'conferindo' : nova.pendente ? 'salvando' : 'sincronizado' })
      }
      if (nova.pendente || situacao.tipo === 'parado') return avisar()
      // A outra aba deixou tudo em dia. A pergunta daqui só some se ela resolveu este mesmo conflito.
      if (situacao.tipo === 'conflito' && nova.revisao < situacao.revisao) return avisar()
      mudar({ tipo: 'sincronizado' })
    },

    parar() {
      desligado = true
      geracao++
      cancelarEnvio()
    },
  }
}
