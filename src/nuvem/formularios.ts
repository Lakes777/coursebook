import { LIMITES, type CodigoErro } from '../api/contrato'
import type { ErroCampo } from '../telas/novaMateriaUtil'
import type { Situacao } from './sincronizador'

// Conferências dos formulários da conta, antes de chamar a API (a API confere de
// novo; aqui é para a pessoa ver o erro na hora, no campo certo), e os textos da situação.

export interface IdsConta {
  email: string
  senha: string
  convite: string
}

export interface FormConta {
  email: string
  senha: string
  convite: string
}

/** Primeiro problema do formulário, ou null. `cadastro` exige o tamanho da senha e o convite. */
export function erroConta(form: FormConta, ids: IdsConta, cadastro: boolean): ErroCampo | null {
  const email = form.email.trim()
  if (email === '') return { campo: ids.email, mensagem: 'Informe o e-mail.' }
  if (!email.includes('@') || /\s/.test(email)) {
    return { campo: ids.email, mensagem: 'Informe um e-mail válido, como nome@exemplo.com.' }
  }
  if (email.length > LIMITES.emailMaximo) {
    return { campo: ids.email, mensagem: `O e-mail pode ter no máximo ${LIMITES.emailMaximo} caracteres.` }
  }
  if (form.senha === '') return { campo: ids.senha, mensagem: 'Informe a senha.' }
  if (cadastro && form.senha.length < LIMITES.senhaMinima) {
    return { campo: ids.senha, mensagem: `A senha precisa ter pelo menos ${LIMITES.senhaMinima} caracteres.` }
  }
  if (form.senha.length > LIMITES.senhaMaxima) {
    return { campo: ids.senha, mensagem: `A senha pode ter no máximo ${LIMITES.senhaMaxima} caracteres.` }
  }
  if (cadastro && form.convite.trim() === '') return { campo: ids.convite, mensagem: 'Informe o código de convite.' }
  return null
}

/**
 * Em qual campo mostrar o erro da API; null = mensagem geral do formulário.
 * E-mail ou senha errados vão na senha: a API não diz qual dos dois (de propósito).
 */
export function campoDoErro(codigo: CodigoErro): keyof IdsConta | null {
  switch (codigo) {
    case 'credenciais':
      return 'senha'
    case 'email-em-uso':
    case 'pedido-invalido':
      return 'email'
    case 'convite-invalido':
      return 'convite'
    default:
      return null
  }
}

/** A situação em texto curto, para o topo da página. */
export const TEXTO_CURTO: Record<Situacao['tipo'], string> = {
  conferindo: 'Sincronizando...',
  sincronizado: 'Sincronizado',
  salvando: 'Salvando...',
  'sem-conexao': 'Sem conexão: salvo neste aparelho',
  'sem-sessao': 'Entre de novo para sincronizar',
  conflito: 'Conflito: escolha qual versão manter',
  erro: 'Erro ao sincronizar',
  parado: 'Sincronização parada',
}

/** A situação explicada, para a seção da conta na tela Dados. */
export function textoSituacao(situacao: Situacao): string {
  switch (situacao.tipo) {
    case 'conferindo':
      return 'Conferindo os dados da nuvem...'
    case 'sincronizado':
      return 'Tudo sincronizado com a nuvem.'
    case 'salvando':
      return 'Salvando as mudanças na nuvem...'
    case 'sem-conexao':
      return 'Sem conexão. As mudanças ficam salvas neste aparelho e vão para a nuvem quando a internet voltar.'
    case 'sem-sessao':
      return 'Sua sessão terminou. Entre de novo para sincronizar; as mudanças feitas aqui continuam guardadas.'
    case 'conflito':
      return 'Os dados mudaram na nuvem e também aqui. Escolha abaixo qual versão manter.'
    case 'erro':
      return (
        `Não deu para sincronizar: ${situacao.mensagem} ` +
        'As mudanças continuam neste aparelho e vão na próxima tentativa.'
      )
    case 'parado':
      return 'Este navegador não está salvando os dados, então nada vai para a nuvem.'
  }
}
