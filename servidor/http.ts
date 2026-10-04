import { LIMITES, type CodigoErro, type RespostaErro } from '../src/api/contrato'
import type { Contexto, Rota } from './contexto'

// O que toda rota faz igual: respostas JSON, erros, leitura do corpo com limite,
// proteção contra outro site (CSRF), cookies e o 405/500.

/** Erro que vira resposta: as rotas lançam, e `rota()` responde com ele. */
export class ErroHttp extends Error {
  status: number
  codigo: CodigoErro
  cabecalhos: Record<string, string>

  constructor(status: number, codigo: CodigoErro, mensagem: string, cabecalhos: Record<string, string> = {}) {
    super(mensagem)
    this.status = status
    this.codigo = codigo
    this.cabecalhos = cabecalhos
  }
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'DELETE'

function cabecalhosBase(extra?: Record<string, string>): Headers {
  const cabecalhos = new Headers(extra)
  // Nada daqui pode ficar guardado no navegador nem num proxy: são dados de uma conta.
  cabecalhos.set('Cache-Control', 'no-store')
  return cabecalhos
}

export function json(corpo: unknown, status = 200, extra?: Record<string, string>): Response {
  const cabecalhos = cabecalhosBase(extra)
  cabecalhos.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(corpo), { status, headers: cabecalhos })
}

export function semCorpo(extra?: Record<string, string>): Response {
  return new Response(null, { status: 204, headers: cabecalhosBase(extra) })
}

export function erro(status: number, codigo: CodigoErro, mensagem: string, extra?: Record<string, string>): Response {
  const corpo: RespostaErro = { codigo, erro: mensagem }
  return json(corpo, status, extra)
}

/**
 * Monta a rota a partir de uma função por método. O resto dos métodos recebe 405
 * com Allow, e qualquer erro inesperado vira 500 sem detalhe (o detalhe vai para o log).
 */
export interface OpcoesRota {
  /**
   * Se a rota aceita o cabeçalho Authorization (chave de acesso). Só a dos prazos,
   * que só lê. As outras recusam o pedido que tiver o cabeçalho, mesmo com o cookie
   * junto: assim a chave do bot nunca serve para mudar dados, criar chaves ou apagar a conta.
   */
  aceitaChave?: boolean
}

export function rota(metodos: Partial<Record<Metodo, Rota>>, { aceitaChave = false }: OpcoesRota = {}): Rota {
  const permitidos = Object.keys(metodos).join(', ')
  return async (req, ctx: Contexto) => {
    const tratar = metodos[req.method as Metodo]
    if (!tratar) {
      return erro(405, 'metodo', 'Este endereço não aceita esse tipo de pedido.', { Allow: permitidos })
    }
    try {
      if (!aceitaChave && req.headers.has('authorization')) {
        throw new ErroHttp(
          403,
          'chave-recusada',
          'Chaves de acesso só servem para ler os prazos (/api/prazos). Para o resto, entre pelo site.',
        )
      }
      if (req.method !== 'GET') conferirOrigem(req)
      return await tratar(req, ctx)
    } catch (e) {
      if (e instanceof ErroHttp) return erro(e.status, e.codigo, e.message, e.cabecalhos)
      // Só o erro, nunca o pedido: o corpo pode ter senha.
      console.error('Erro inesperado na API:', e)
      return erro(500, 'erro-interno', 'Algo deu errado no servidor. Tente de novo daqui a pouco.')
    }
  }
}

/**
 * Pedido que muda algo e vem de outro site é recusado. O navegador sempre manda
 * Origin nesses pedidos; sem Origin (curl, testes) não há cookie de navegador em jogo.
 */
function conferirOrigem(req: Request): void {
  const origem = req.headers.get('origin')
  if (origem === null) return
  let hostOrigem: string
  try {
    hostOrigem = new URL(origem).host
  } catch {
    hostOrigem = '' // "null" (página local, sandbox) ou lixo: não é o mesmo site.
  }
  const hosts = [new URL(req.url).host, req.headers.get('host')]
  if (!hosts.includes(hostOrigem)) {
    throw new ErroHttp(403, 'pedido-invalido', 'Pedido vindo de outro site recusado.')
  }
}

const muitoGrande = () => new ErroHttp(413, 'muito-grande', 'O pedido é grande demais (máximo de 2 MB).')

/** Lê o corpo sem passar de LIMITES.corpoMaximo, mesmo que o Content-Length minta. */
async function lerTexto(req: Request): Promise<string> {
  const declarado = Number(req.headers.get('content-length'))
  if (declarado > LIMITES.corpoMaximo) throw muitoGrande()
  if (!req.body) return ''
  const partes: Uint8Array[] = []
  let total = 0
  const leitor = req.body.getReader()
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    total += value.byteLength
    if (total > LIMITES.corpoMaximo) {
      await leitor.cancel()
      throw muitoGrande()
    }
    partes.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(partes))
}

/** O corpo JSON do pedido, que tem que ser um objeto { ... }. */
export async function lerObjeto(req: Request): Promise<Record<string, unknown>> {
  const tipo = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (tipo !== 'application/json') {
    // O formulário de outro site não consegue mandar application/json sem o navegador
    // perguntar antes (CORS), então isso também protege contra CSRF.
    throw new ErroHttp(415, 'pedido-invalido', 'O pedido tem que ser em JSON (Content-Type: application/json).')
  }
  const texto = await lerTexto(req)
  let corpo: unknown
  try {
    corpo = JSON.parse(texto)
  } catch {
    throw new ErroHttp(400, 'pedido-invalido', 'O pedido não é um JSON válido.')
  }
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) {
    throw new ErroHttp(400, 'pedido-invalido', 'O pedido tem que ser um objeto JSON { ... }.')
  }
  return corpo as Record<string, unknown>
}

/** Campo de texto obrigatório do corpo. */
export function texto(corpo: Record<string, unknown>, campo: string): string {
  const valor = corpo[campo]
  if (typeof valor !== 'string') throw new ErroHttp(400, 'pedido-invalido', `Falta o campo "${campo}" (texto).`)
  return valor
}

/** O valor de um cookie do pedido, ou null. */
export function lerCookie(req: Request, nome: string): string | null {
  for (const parte of (req.headers.get('cookie') ?? '').split(';')) {
    const igual = parte.indexOf('=')
    if (igual === -1 || parte.slice(0, igual).trim() !== nome) continue
    const valor = parte.slice(igual + 1).trim()
    try {
      return decodeURIComponent(valor)
    } catch {
      return null
    }
  }
  return null
}

export interface OpcoesCookie {
  maxAge: number
  seguro: boolean
}

/** Cabeçalho Set-Cookie. HttpOnly: o JavaScript da página não lê (nem um script injetado). */
export function serializarCookie(nome: string, valor: string, { maxAge, seguro }: OpcoesCookie): string {
  const partes = [`${nome}=${encodeURIComponent(valor)}`, 'Path=/', `Max-Age=${maxAge}`, 'HttpOnly', 'SameSite=Lax']
  if (seguro) partes.push('Secure')
  return partes.join('; ')
}
