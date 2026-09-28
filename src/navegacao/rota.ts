// As telas ficam no "#" do endereço (#/materias, #/materia/<id>, #/agenda). Assim
// o botão "voltar" do navegador funciona e o GitHub Pages não precisa saber das
// rotas (tudo depois do # nem chega ao servidor).

export type Rota =
  | { tela: 'materias' }
  | { tela: 'materia'; id: string }
  | { tela: 'nova-materia' }
  | { tela: 'agenda' }

export const INICIO: Rota = { tela: 'materias' }

/** "#/materia/abc" -> { tela: 'materia', id: 'abc' }. Endereço desconhecido vai para o início. */
export function lerRota(hash: string): Rota {
  const partes = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [tela, id] = partes
  if (partes.length === 1 && tela === 'materias') return { tela: 'materias' }
  if (partes.length === 1 && tela === 'agenda') return { tela: 'agenda' }
  if (partes.length === 1 && tela === 'nova-materia') return { tela: 'nova-materia' }
  if (partes.length === 2 && tela === 'materia') {
    try {
      return { tela: 'materia', id: decodeURIComponent(id) }
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
    default:
      return `#/${rota.tela}`
  }
}
