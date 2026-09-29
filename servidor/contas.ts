import { hash, verify } from '@node-rs/argon2'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { LIMITES } from '../src/api/contrato'
import type { Contexto } from './contexto'
import { ErroHttp } from './http'

// Senhas, convite, formato de e-mail e senha, e o bloqueio por senhas erradas.

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
 * Confere o código de convite em tempo constante. Compara os SHA-256, que têm sempre
 * o mesmo tamanho: o timingSafeEqual exige isso, e assim nem o tamanho do código vaza.
 */
export function conferirConvite(recebido: string, esperado: string | undefined): void {
  if (!esperado) throw new ErroHttp(403, 'convite-invalido', 'O cadastro de contas está fechado.')
  if (!timingSafeEqual(sha256(recebido), sha256(esperado))) {
    throw new ErroHttp(403, 'convite-invalido', 'Código de convite incorreto.')
  }
}

/** E-mail como a pessoa digitou, sem espaços nas pontas. */
export function limparEmail(email: string): string {
  return email.trim()
}

/** A chave de comparação: e-mails não diferenciam maiúsculas (como o índice do banco). */
export function chaveEmail(email: string): string {
  return limparEmail(email).toLowerCase()
}

export function conferirFormato(email: string, senha: string): void {
  if (email.length > LIMITES.emailMaximo || !/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new ErroHttp(400, 'pedido-invalido', 'Digite um e-mail válido (ex.: nome@exemplo.com).')
  }
  if (senha.length < LIMITES.senhaMinima) {
    throw new ErroHttp(400, 'pedido-invalido', `A senha precisa ter pelo menos ${LIMITES.senhaMinima} caracteres.`)
  }
  if (senha.length > LIMITES.senhaMaxima) {
    throw new ErroHttp(400, 'pedido-invalido', `A senha pode ter no máximo ${LIMITES.senhaMaxima} caracteres.`)
  }
}

/** Ao conferir uma senha: senha enorme só serviria para gastar processamento no argon2. */
export function limitarSenha(senha: string): void {
  if (senha.length > LIMITES.senhaMaxima) {
    throw new ErroHttp(400, 'pedido-invalido', `A senha pode ter no máximo ${LIMITES.senhaMaxima} caracteres.`)
  }
}

function inicioDaJanela(ctx: Contexto): string {
  return new Date(ctx.agora().getTime() - LIMITES.minutosBloqueio * 60_000).toISOString()
}

/**
 * Com LIMITES.tentativasLogin senhas erradas na janela, recusa antes de conferir a
 * senha (conferir de novo seria dar mais uma chance). O Retry-After conta da primeira
 * tentativa da janela, que é quando ela deixa de contar.
 */
export async function conferirBloqueio(ctx: Contexto, chave: string): Promise<void> {
  const [linha] = await ctx.banco.consultar(
    `SELECT count(*)::int AS quantas,
            ceil(extract(epoch FROM min(em) - $2::timestamptz))::int AS espera
       FROM tentativas_login WHERE email = $1 AND em > $2::timestamptz`,
    [chave, inicioDaJanela(ctx)],
  )
  if (Number(linha.quantas) < LIMITES.tentativasLogin) return
  const segundos = Math.max(1, Number(linha.espera))
  const minutos = Math.ceil(segundos / 60)
  throw new ErroHttp(
    429,
    'bloqueado',
    `Muitas tentativas. Tente de novo em ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`,
    { 'Retry-After': String(segundos) },
  )
}

export async function registrarTentativa(ctx: Contexto, chave: string): Promise<void> {
  await ctx.banco.consultar('INSERT INTO tentativas_login (email, em) VALUES ($1, $2)', [
    chave,
    ctx.agora().toISOString(),
  ])
  // O que já saiu da janela não serve para nada: limpa aqui mesmo, sem precisar de rotina à parte.
  await ctx.banco.consultar('DELETE FROM tentativas_login WHERE em <= $1::timestamptz', [inicioDaJanela(ctx)])
}

export async function limparTentativas(ctx: Contexto, chave: string): Promise<void> {
  await ctx.banco.consultar('DELETE FROM tentativas_login WHERE email = $1', [chave])
}

/** Resposta de e-mail ou senha errados: a mesma nos dois casos, para não contar quem tem conta. */
export function credenciaisErradas(): ErroHttp {
  return new ErroHttp(401, 'credenciais', 'E-mail ou senha incorretos.')
}
