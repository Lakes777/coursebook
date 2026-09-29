import { hash, verify } from '@node-rs/argon2'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { LIMITES } from '../src/api/contrato'
import type { Contexto } from './contexto'
import { ErroHttp } from './http'

// Senhas, convite, formato de e-mail e senha, e o bloqueio por tentativas erradas.

/** argon2id com os parâmetros padrão da biblioteca (o formato PHC guarda quais foram). */
export function gerarHash(senha: string): Promise<string> {
  return hash(senha)
}

// Hash de uma senha que ninguém sabe, para o e-mail que não existe gastar o mesmo
// tempo que uma senha errada: assim o tempo da resposta não conta quem tem conta.
let hashFalso: Promise<string> | null = null

/** Confere a senha. Sem hash (conta que não existe), confere contra o falso e dá false. */
export async function senhaConfere(senha: string, hashGuardado: string | null): Promise<boolean> {
  hashFalso ??= hash(randomBytes(32).toString('hex'))
  const alvo = hashGuardado ?? (await hashFalso)
  const confere = await verify(alvo, senha)
  return confere && hashGuardado !== null
}

function sha256(texto: string): Buffer {
  return createHash('sha256').update(texto).digest()
}

/**
 * Compara o código de convite em tempo constante. Compara os SHA-256, que têm sempre
 * o mesmo tamanho: o timingSafeEqual exige isso, e assim nem o tamanho do código vaza.
 */
export function conviteConfere(recebido: string, esperado: string): boolean {
  return timingSafeEqual(sha256(recebido), sha256(esperado))
}

/** E-mail como a pessoa digitou, sem espaços nas pontas. */
export function limparEmail(email: string): string {
  return email.trim()
}

/**
 * A chave de comparação. Só serve para e-mail ASCII (conferirEmail garante): aí o
 * toLowerCase daqui e o lower() do Postgres no índice dão sempre o mesmo resultado.
 */
export function chaveEmail(email: string): string {
  return limparEmail(email).toLowerCase()
}

/** Confere o e-mail já limpo (limparEmail): tamanho, só ASCII e o formato nome@dominio. */
export function conferirEmail(email: string): void {
  if (email.length > LIMITES.emailMaximo) {
    throw new ErroHttp(400, 'pedido-invalido', `O e-mail pode ter no máximo ${LIMITES.emailMaximo} caracteres.`)
  }
  // Fora do ASCII visível (acentos, letras de outros alfabetos). Espaços ficam para a regra de baixo.
  if (/[^\s -~]/.test(email)) {
    throw new ErroHttp(400, 'pedido-invalido', 'Use um e-mail sem acentos ou outros caracteres especiais.')
  }
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new ErroHttp(400, 'pedido-invalido', 'Digite um e-mail válido (ex.: nome@exemplo.com).')
  }
}

/** Senha nova, no cadastro. */
export function conferirSenhaNova(senha: string): void {
  if (senha.length < LIMITES.senhaMinima) {
    throw new ErroHttp(400, 'pedido-invalido', `A senha precisa ter pelo menos ${LIMITES.senhaMinima} caracteres.`)
  }
  limitarSenha(senha)
}

/** Ao conferir uma senha: senha enorme só serviria para gastar processamento no argon2. */
export function limitarSenha(senha: string): void {
  if (senha.length > LIMITES.senhaMaxima) {
    throw new ErroHttp(400, 'pedido-invalido', `A senha pode ter no máximo ${LIMITES.senhaMaxima} caracteres.`)
  }
}

/**
 * Chave das tentativas de convite na tabela tentativas_login. Não tem "@", então não
 * se confunde com um e-mail. É uma só para todo mundo: o convite também é um só.
 */
export const CHAVE_CONVITE = 'convite'

function inicioDaJanela(ctx: Contexto): string {
  return new Date(ctx.agora().getTime() - LIMITES.minutosBloqueio * 60_000).toISOString()
}

/**
 * Reserva uma tentativa ANTES de conferir a senha (ou o convite) e devolve o id dela.
 * Conferir primeiro e gravar depois deixava passar vários pedidos ao mesmo tempo: todos
 * contavam antes de qualquer um gravar. Assim, cada pedido conta só as tentativas
 * gravadas antes da sua (id menor ou igual), e só as LIMITES.tentativasLogin primeiras
 * da janela passam. Passou do limite: apaga a própria reserva (senão o bloqueio se
 * estenderia sozinho a cada pedido) e responde 429. O Retry-After conta da primeira
 * tentativa da janela, que é quando ela deixa de contar.
 */
export async function reservarTentativa(ctx: Contexto, chave: string, assunto = ''): Promise<string> {
  const inicio = inicioDaJanela(ctx)
  // O que já saiu da janela não serve para nada: limpa aqui mesmo, sem precisar de rotina à parte.
  await ctx.banco.consultar('DELETE FROM tentativas_login WHERE em <= $1::timestamptz', [inicio])
  const [reserva] = await ctx.banco.consultar('INSERT INTO tentativas_login (email, em) VALUES ($1, $2) RETURNING id', [
    chave,
    ctx.agora().toISOString(),
  ])
  const id = String(reserva.id)
  const [linha] = await ctx.banco.consultar(
    `SELECT count(*)::int AS quantas,
            ceil(extract(epoch FROM min(em) - $2::timestamptz))::int AS espera
       FROM tentativas_login WHERE email = $1 AND em > $2::timestamptz AND id <= $3`,
    [chave, inicio, id],
  )
  if (Number(linha.quantas) <= LIMITES.tentativasLogin) return id

  await liberarTentativa(ctx, id)
  const segundos = Math.max(1, Number(linha.espera))
  const minutos = Math.ceil(segundos / 60)
  const espera = `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  throw new ErroHttp(429, 'bloqueado', `Muitas tentativas${assunto && ' ' + assunto}. Tente de novo em ${espera}.`, {
    'Retry-After': String(segundos),
  })
}

/** Desfaz uma reserva que não era tentativa errada (ex.: o convite estava certo). */
export async function liberarTentativa(ctx: Contexto, id: string): Promise<void> {
  await ctx.banco.consultar('DELETE FROM tentativas_login WHERE id = $1', [id])
}

/** Senha certa: zera as tentativas daquele e-mail (quem acertou sabe a senha). */
export async function limparTentativas(ctx: Contexto, chave: string): Promise<void> {
  await ctx.banco.consultar('DELETE FROM tentativas_login WHERE email = $1', [chave])
}

/** Resposta de e-mail ou senha errados: a mesma nos dois casos, para não contar quem tem conta. */
export function credenciaisErradas(): ErroHttp {
  return new ErroHttp(401, 'credenciais', 'E-mail ou senha incorretos.')
}
