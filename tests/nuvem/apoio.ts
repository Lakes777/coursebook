import type {
  ChaveAcesso,
  ClienteNuvem,
  PedidoSalvar,
  RespostaConflito,
  RespostaErro,
  Resposta,
} from '../../src/api/contrato'
import { dadosVazios } from '../../src/logica/armazenamento'
import type { Dados, Materia } from '../../src/logica/tipos'
import type { ArmazenamentoNuvem } from '../../src/nuvem/conta'

// Peças que os testes da nuvem repetem: localStorage falso, API falsa e dados prontos.

/** localStorage falso, com tudo o que a nuvem usa (inclusive key e length, para o "Sair e apagar"). */
export function navegador(inicial: Record<string, string> = {}) {
  const itens = new Map(Object.entries(inicial))
  const nav: ArmazenamentoNuvem & { itens: Map<string, string> } = {
    itens,
    getItem: (chave) => itens.get(chave) ?? null,
    setItem: (chave, valor) => void itens.set(chave, valor),
    removeItem: (chave) => void itens.delete(chave),
    key: (i) => [...itens.keys()][i] ?? null,
    get length() {
      return itens.size
    },
  }
  return nav
}

export function materia(id: string, nome = id): Materia {
  return { id, nome, professor: '', horarios: [], cargaHoraria: 80, ras: [], pontosExtras: [], faltas: [] }
}

export const comMaterias = (...nomes: string[]): Dados => ({ ...dadosVazios(), materias: nomes.map((n) => materia(n)) })

const SEM_CONEXAO: Resposta<never> = {
  ok: false,
  status: 0,
  erro: { codigo: 'sem-conexao', erro: 'Sem conexão com a internet.' },
}

/**
 * API falsa em memória, que imita a de verdade: guarda os dados e a revisão, aumenta
 * a revisão a cada PUT e responde 409 quando a revisão do pedido não bate.
 * `online = false` faz toda chamada falhar como sem conexão; `logado = false`, como sem sessão.
 * `segurar()` deixa as chamadas esperando até `soltar()` (para testar o que acontece no meio).
 */
export class NuvemFalsa implements ClienteNuvem {
  dados: Dados | null = null
  revisao = 0
  email = 'andre@exemplo.com'
  logado = true
  online = true
  /** Erro fixo para a próxima chamada (ex.: 500), ou null. */
  proximoErro: { status: number; erro: RespostaErro } | null = null
  chamadas: string[] = []
  salvos: PedidoSalvar[] = []
  chaves: ChaveAcesso[] = []
  private proximaChave = 1
  private esperando: (() => void)[] = []
  private segurando = false

  segurar() {
    this.segurando = true
  }

  soltar() {
    this.segurando = false
    const fila = this.esperando
    this.esperando = []
    fila.forEach((f) => f())
  }

  private async responder<T>(nome: string, fazer: () => Resposta<T>, precisaSessao = true): Promise<Resposta<T>> {
    this.chamadas.push(nome)
    if (this.segurando) await new Promise<void>((r) => this.esperando.push(r))
    if (!this.online) return SEM_CONEXAO
    if (this.proximoErro) {
      const { status, erro } = this.proximoErro
      this.proximoErro = null
      return { ok: false, status, erro }
    }
    if (precisaSessao && !this.logado) {
      return { ok: false, status: 401, erro: { codigo: 'sem-sessao', erro: 'Entre de novo.' } }
    }
    return fazer()
  }

  eu() {
    return this.responder('eu', () => ({ ok: true, valor: this.logado ? { email: this.email } : null }), false)
  }

  cadastrar(pedido: { email: string }) {
    return this.responder(
      'cadastrar',
      () => {
        this.email = pedido.email
        this.logado = true
        return { ok: true, valor: { email: pedido.email } }
      },
      false,
    )
  }

  entrar(pedido: { email: string; senha: string }) {
    return this.responder(
      'entrar',
      () => {
        if (pedido.senha !== 'senha-certa') {
          return { ok: false, status: 401, erro: { codigo: 'credenciais', erro: 'E-mail ou senha errados.' } }
        }
        this.email = pedido.email
        this.logado = true
        return { ok: true, valor: { email: pedido.email } }
      },
      false,
    )
  }

  sair() {
    return this.responder(
      'sair',
      () => {
        this.logado = false
        return { ok: true, valor: null }
      },
      false,
    )
  }

  excluirConta(pedido: { senha: string }) {
    return this.responder('excluirConta', () => {
      if (pedido.senha !== 'senha-certa') {
        return { ok: false, status: 401, erro: { codigo: 'credenciais', erro: 'Senha errada.' } }
      }
      this.logado = false
      this.dados = null
      this.revisao = 0
      return { ok: true, valor: null }
    })
  }

  baixar() {
    // Cópias, como numa API de verdade: nenhum teste pode depender de a nuvem e o painel dividirem o objeto.
    return this.responder('baixar', () => ({
      ok: true,
      valor: { dados: structuredClone(this.dados), revisao: this.revisao },
    }))
  }

  salvar(pedido: PedidoSalvar) {
    return this.responder('salvar', () => {
      this.salvos.push(structuredClone(pedido))
      if (pedido.revisao !== this.revisao) {
        const erro: RespostaConflito = {
          codigo: 'conflito',
          erro: 'Outro aparelho salvou antes.',
          dados: structuredClone(this.dados),
          revisao: this.revisao,
        }
        return { ok: false, status: 409, erro }
      }
      this.dados = structuredClone(pedido.dados)
      this.revisao += 1
      return { ok: true, valor: { revisao: this.revisao } }
    })
  }

  listarChaves() {
    return this.responder('listarChaves', () => ({ ok: true, valor: { chaves: structuredClone(this.chaves) } }))
  }

  criarChave(pedido: { nome: string }) {
    return this.responder('criarChave', () => {
      if (this.chaves.length >= 5) {
        return { ok: false, status: 409, erro: { codigo: 'limite-chaves', erro: 'Limite de 5 chaves.' } }
      }
      const n = this.proximaChave++
      const chave: ChaveAcesso = { id: `k_${n}`, nome: pedido.nome, criadaEm: '2026-10-04T15:00:00.000Z', usadaEm: null }
      this.chaves.push(chave)
      return { ok: true, valor: { chave: structuredClone(chave), token: `cb_token-falso-${n}` } }
    })
  }

  apagarChave(id: string) {
    return this.responder('apagarChave', () => {
      if (!this.chaves.some((c) => c.id === id)) {
        return { ok: false, status: 404, erro: { codigo: 'nao-encontrada', erro: 'Essa chave não existe mais.' } }
      }
      this.chaves = this.chaves.filter((c) => c.id !== id)
      return { ok: true, valor: null }
    })
  }

  /** Outro aparelho salvou direto na nuvem. */
  outroAparelhoSalvou(dados: Dados) {
    this.dados = structuredClone(dados)
    this.revisao += 1
  }
}
