import type { Dados } from '../logica/tipos'

// O contrato entre o site e a API da nuvem (funções da Vercel em api/). Os dois
// lados importam daqui: mudar uma rota ou um formato é mudar aqui, e o TypeScript
// aponta o que ficou para trás dos dois lados. O comportamento está em docs/nuvem.md.

/** As rotas da API. Todas recebem e devolvem JSON (menos as respostas 204, sem corpo). */
export const ROTAS = {
  /** POST PedidoCadastro -> 201 RespostaConta (já entra: devolve o cookie da sessão). */
  cadastro: '/api/cadastro',
  /** POST PedidoEntrar -> 200 RespostaConta, com o cookie da sessão. */
  entrar: '/api/entrar',
  /** POST, sem corpo -> 204. Apaga a sessão no banco e o cookie. Sem sessão, também 204. */
  sair: '/api/sair',
  /** GET -> 200 RespostaConta, ou 401 'sem-sessao'. */
  eu: '/api/eu',
  /** DELETE PedidoExcluirConta -> 204. Apaga a conta, as sessões e os dados da nuvem. */
  conta: '/api/conta',
  /** GET -> 200 RespostaDados. PUT PedidoSalvar -> 200 RespostaSalvar, ou 409 RespostaConflito. */
  dados: '/api/dados',
} as const

/** Nome do cookie da sessão (HttpOnly, SameSite=Lax, Secure fora do localhost, Path=/). */
export const COOKIE_SESSAO = 'sessao'

export const LIMITES = {
  /** Dias até a sessão expirar (o cookie tem o mesmo Max-Age). */
  diasSessao: 30,
  emailMaximo: 254,
  senhaMinima: 8,
  senhaMaxima: 200,
  /** Tamanho máximo do corpo de um pedido, em bytes (o JSON dos dados é o maior). */
  corpoMaximo: 2_000_000,
  /** Senhas erradas seguidas para um e-mail antes de bloquear... */
  tentativasLogin: 5,
  /** ...por estes minutos (contados da primeira tentativa errada da janela). */
  minutosBloqueio: 15,
} as const

export interface PedidoCadastro {
  email: string
  senha: string
  /** O código de convite (variável CODIGO_CONVITE na Vercel). */
  convite: string
}

export interface PedidoEntrar {
  email: string
  senha: string
}

/** Excluir a conta pede a senha de novo: uma aba esquecida aberta não basta. */
export interface PedidoExcluirConta {
  senha: string
}

export interface RespostaConta {
  /** O e-mail como a pessoa cadastrou (a comparação ignora maiúsculas). */
  email: string
}

/**
 * Os dados da conta na nuvem. Conta que nunca salvou: dados null e revisão 0.
 * A revisão aumenta de 1 em 1 a cada PUT que deu certo.
 */
export interface RespostaDados {
  dados: Dados | null
  revisao: number
}

export interface PedidoSalvar {
  dados: Dados
  /**
   * A revisão que este aparelho baixou ou salvou por último (0 se nunca). Se a da
   * nuvem for outra, alguém salvou no meio: a API não grava e responde 409.
   */
  revisao: number
}

export interface RespostaSalvar {
  /** A revisão nova, que o aparelho manda no próximo PUT. */
  revisao: number
}

/**
 * O que deu errado. `codigo` é para o programa decidir o que fazer; `erro` é a
 * mensagem em português, pronta para aparecer na tela.
 */
export type CodigoErro =
  /** 400: o corpo não é JSON, falta campo, e-mail ou senha fora do formato. */
  | 'pedido-invalido'
  /** 400: os dados não passam na validação do painel (a mensagem diz onde). */
  | 'dados-invalidos'
  /** 403: código de convite errado, ou cadastro fechado (sem CODIGO_CONVITE). */
  | 'convite-invalido'
  /** 409: já existe conta com esse e-mail. */
  | 'email-em-uso'
  /** 401: e-mail ou senha errados (a mesma resposta nos dois casos). */
  | 'credenciais'
  /** 429: senhas erradas demais; a resposta tem o cabeçalho Retry-After (segundos). */
  | 'bloqueado'
  /** 401: sem cookie, sessão expirada ou apagada. */
  | 'sem-sessao'
  /** 409: outro aparelho salvou antes (ver RespostaConflito). */
  | 'conflito'
  /** 413: pedido maior que LIMITES.corpoMaximo. */
  | 'muito-grande'
  /** 405: método que a rota não aceita. */
  | 'metodo'
  /** 500: erro do servidor ou do banco. */
  | 'erro-interno'
  /** Só no site: o fetch falhou (sem internet, servidor fora do ar). Nunca vem da API. */
  | 'sem-conexao'

export interface RespostaErro {
  codigo: CodigoErro
  erro: string
}

/** 409 no PUT de dados: vem o que está na nuvem, para o site perguntar o que fazer. */
export interface RespostaConflito extends RespostaErro {
  codigo: 'conflito'
  dados: Dados | null
  revisao: number
}

/** Resultado de uma chamada à API no site. `status` 0 = não chegou resposta ('sem-conexao'). */
export type Resposta<T> = { ok: true; valor: T } | { ok: false; status: number; erro: RespostaErro }

/**
 * O que o site usa para falar com a API. A versão de verdade faz fetch nas ROTAS
 * (mesmo domínio, com o cookie); os testes passam uma falsa.
 */
export interface ClienteNuvem {
  /** Quem está logado neste navegador; valor null quando a API responde 401 'sem-sessao'. */
  eu(): Promise<Resposta<RespostaConta | null>>
  cadastrar(pedido: PedidoCadastro): Promise<Resposta<RespostaConta>>
  entrar(pedido: PedidoEntrar): Promise<Resposta<RespostaConta>>
  sair(): Promise<Resposta<null>>
  excluirConta(pedido: PedidoExcluirConta): Promise<Resposta<null>>
  baixar(): Promise<Resposta<RespostaDados>>
  /** No conflito, `erro` é uma RespostaConflito (conferir com ehConflito). */
  salvar(pedido: PedidoSalvar): Promise<Resposta<RespostaSalvar>>
}

export function ehConflito(erro: RespostaErro): erro is RespostaConflito {
  return erro.codigo === 'conflito'
}
