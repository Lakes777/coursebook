// As telas ficam no "#" do endereço (#/materias, #/materia/<id>, #/materia/<id>/editar, #/semana, #/agenda). Assim
// o botão "voltar" do navegador funciona e o GitHub Pages não precisa saber das
// rotas (tudo depois do # nem chega ao servidor). O endereço raiz ("" ou "#/") é o lobby,
// a página de entrada com o botão "Começar".

export type Rota =
  | { tela: 'lobby' }
  | { tela: 'materias' }
  | { tela: 'materia'; id: string }
  | { tela: 'editar-materia'; id: string }
  | { tela: 'nova-materia' }
  | { tela: 'semana' }
  | { tela: 'agenda' }
  | { tela: 'dados' }

/** A página de entrada, no endereço raiz ("", "#" ou "#/"). */
export const LOBBY: Rota = { tela: 'lobby' }

/** A primeira tela do painel: o "Começar" do lobby leva para ela, e endereço desconhecido também. */
export const INICIO: Rota = { tela: 'materias' }

/** "#/materia/abc" -> { tela: 'materia', id: 'abc' }. Endereço desconhecido vai para o início. */
export function lerRota(hash: string): Rota {
  const partes = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [tela, id, acao] = partes
  if (partes.length === 0) return LOBBY
  if (partes.length === 1 && tela === 'materias') return { tela: 'materias' }
  if (partes.length === 1 && tela === 'semana') return { tela: 'semana' }
  if (partes.length === 1 && tela === 'agenda') return { tela: 'agenda' }
  if (partes.length === 1 && tela === 'dados') return { tela: 'dados' }
  if (partes.length === 1 && tela === 'nova-materia') return { tela: 'nova-materia' }
  const editar = partes.length === 3 && acao === 'editar'
  if ((partes.length === 2 || editar) && tela === 'materia') {
    try {
      return { tela: editar ? 'editar-materia' : 'materia', id: decodeURIComponent(id) }
    } catch {
      return INICIO // "%E0" solto não é um id que a gente gerou
    }
  }
  return INICIO
}

export function paraHash(rota: Rota): string {
  switch (rota.tela) {
    case 'materia':
      return `#/materia/${encodeURIComponent(rota.id)}`
    case 'editar-materia':
      return `#/materia/${encodeURIComponent(rota.id)}/editar`
    case 'lobby':
      return '#/'
    default:
      return `#/${rota.tela}`
  }
}
