import {
  ROTAS,
  type ClienteNuvem,
  type CodigoErro,
  type RespostaConta,
  type RespostaConflito,
  type RespostaErro,
  type RespostaSalvar,
  type Resposta,
} from '../api/contrato'
import { migrar } from '../logica/armazenamento'
import type { Dados } from '../logica/tipos'
import { validarDados } from '../logica/validacao'

// O ClienteNuvem de verdade: fetch nas ROTAS do mesmo domínio, com o cookie da
// sessão. Nunca lança: todo problema vira { ok: false } com uma mensagem pronta
// para a tela, e quem chama só decide pelo `codigo`.

type Buscar = (rota: string, init: RequestInit) => Promise<Response>

/** Uma chamada que demora mais que isto conta como sem conexão (senão a fila da sincronização travaria). */
export const TEMPO_MAXIMO_MS = 20_000

type Falha = { ok: false; status: number; erro: RespostaErro }

const falha = (status: number, codigo: CodigoErro, erro: string): Falha => ({
  ok: false,
  status,
  erro: { codigo, erro },
})

const SEM_CONEXAO = falha(0, 'sem-conexao', 'Sem conexão com a internet.')
const RESPOSTA_ESTRANHA = 'A nuvem respondeu algo inesperado. Tente de novo daqui a pouco.'

const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

const ehErro = (x: unknown): x is RespostaErro =>
  ehObjeto(x) && typeof x.codigo === 'string' && typeof x.erro === 'string'

const ehRevisao = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0

/**
 * Os dados que vieram da nuvem passam pela mesma conferência do localStorage: um
 * aparelho com uma versão mais nova do site pode ter salvo um formato que este não lê.
 */
function lerDadosNuvem(bruto: unknown): { ok: true; valor: Dados | null } | { ok: false; falha: Falha } {
  if (bruto === null) return { ok: true, valor: null }
  const migrado = migrar(bruto)
  const lido = migrado.ok ? validarDados(migrado.valor) : migrado
  if (lido.ok) return lido
  const motivo = lido.erro.replace(/\.$/, '')
  return { ok: false, falha: falha(200, 'dados-invalidos', `Não deu para ler os dados da nuvem (${motivo}).`) }
}

export function criarClienteNuvem(buscar: Buscar = (rota, init) => fetch(rota, init)): ClienteNuvem {
  /** Faz o pedido e lê o JSON. `ler` confere o formato da resposta boa (null = formato errado). */
  async function chamar<T>(
    rota: string,
    metodo: string,
    corpo: unknown,
    ler: (json: unknown) => T | null,
  ): Promise<Resposta<T>> {
    let resposta: Response
    try {
      resposta = await buscar(rota, {
        method: metodo,
        credentials: 'same-origin',
        // A API recusa POST/PUT/DELETE com corpo sem este cabeçalho (proteção contra CSRF).
        ...(corpo === undefined
          ? {}
          : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }),
        signal: AbortSignal.timeout(TEMPO_MAXIMO_MS),
      })
    } catch {
      // Sem internet, servidor fora do ar ou demorou demais: o fetch lança nos três.
      return SEM_CONEXAO
    }
    if (resposta.status === 204) return { ok: true, valor: ler(null) as T }

    let json: unknown
    try {
      json = await resposta.json()
    } catch {
      // Ex.: a página de erro em HTML da Vercel quando a função cai.
      return falha(resposta.status, 'erro-interno', RESPOSTA_ESTRANHA)
    }
    if (!resposta.ok) {
      if (ehErro(json)) return { ok: false, status: resposta.status, erro: json }
      return falha(resposta.status, 'erro-interno', RESPOSTA_ESTRANHA)
    }
    const valor = ler(json)
    return valor === null ? falha(resposta.status, 'erro-interno', RESPOSTA_ESTRANHA) : { ok: true, valor }
  }

  const lerConta = (json: unknown): RespostaConta | null =>
    ehObjeto(json) && typeof json.email === 'string' ? { email: json.email } : null
  const semCorpo = (): null => null

  return {
    async eu() {
      const r = await chamar<RespostaConta | null>(ROTAS.eu, 'GET', undefined, lerConta)
      // Não estar logado não é um erro para quem pergunta "quem sou eu?".
      if (!r.ok && r.status === 401 && r.erro.codigo === 'sem-sessao') return { ok: true, valor: null }
      return r
    },
    cadastrar: (pedido) => chamar(ROTAS.cadastro, 'POST', pedido, lerConta),
    entrar: (pedido) => chamar(ROTAS.entrar, 'POST', pedido, lerConta),
    sair: () => chamar(ROTAS.sair, 'POST', undefined, semCorpo),
    excluirConta: (pedido) => chamar(ROTAS.conta, 'DELETE', pedido, semCorpo),

    async baixar() {
      const r = await chamar(ROTAS.dados, 'GET', undefined, (json) =>
        ehObjeto(json) && ehRevisao(json.revisao) ? { dados: json.dados, revisao: json.revisao } : null,
      )
      if (!r.ok) return r
      const dados = lerDadosNuvem(r.valor.dados)
      return dados.ok ? { ok: true, valor: { dados: dados.valor, revisao: r.valor.revisao } } : dados.falha
    },

    async salvar(pedido) {
      const r = await chamar<RespostaSalvar>(ROTAS.dados, 'PUT', pedido, (json) =>
        ehObjeto(json) && ehRevisao(json.revisao) ? { revisao: json.revisao } : null,
      )
      if (r.ok || r.erro.codigo !== 'conflito') return r
      // O 409 traz o que está na nuvem: confere igual ao baixar, para a sincronização poder comparar.
      const bruto: Record<string, unknown> = { ...r.erro }
      if (!ehRevisao(bruto.revisao)) return falha(r.status, 'erro-interno', RESPOSTA_ESTRANHA)
      const dados = lerDadosNuvem(bruto.dados)
      if (!dados.ok) return dados.falha
      const conflito: RespostaConflito = {
        codigo: 'conflito',
        erro: r.erro.erro,
        dados: dados.valor,
        revisao: bruto.revisao,
      }
      return { ok: false, status: r.status, erro: conflito }
    },
  }
}
