import type { Dados, Materia, ResultadoAprendizagem } from '../logica/tipos'
import type { Acao } from './acoes'

// O reducer nunca altera o objeto que recebe: devolve cópias só do caminho que
// mudou (o React compara por referência para saber o que redesenhar). Id que não
// existe não muda nada e devolve o mesmo objeto.

/** Cópia de `obj` com os `campos` aplicados; campo undefined é apagado. */
function aplicar<T extends object>(obj: T, campos: Partial<NoInfer<T>>): T {
  const novo = { ...obj, ...campos }
  for (const [chave, valor] of Object.entries(campos)) {
    if (valor === undefined) delete novo[chave as keyof T]
  }
  return novo
}

/** Troca o item com esse id pelo que `mudar` devolver (mesma lista se nada mudou). */
function trocar<T extends { id: string }>(lista: T[], id: string, mudar: (item: T) => T): T[] {
  const i = lista.findIndex((item) => item.id === id)
  if (i === -1) return lista
  const novo = mudar(lista[i])
  if (novo === lista[i]) return lista
  const copia = [...lista]
  copia[i] = novo
  return copia
}

function tirar<T extends { id: string }>(lista: T[], id: string): T[] {
  const sobra = lista.filter((item) => item.id !== id)
  return sobra.length === lista.length ? lista : sobra
}

function naMateria(dados: Dados, materiaId: string, mudar: (m: Materia) => Materia): Dados {
  return comLista(dados, 'materias', trocar(dados.materias, materiaId, mudar))
}

function noRA(
  dados: Dados,
  materiaId: string,
  raId: string,
  mudar: (ra: ResultadoAprendizagem) => ResultadoAprendizagem,
): Dados {
  return naMateria(dados, materiaId, (m) => comLista(m, 'ras', trocar(m.ras, raId, mudar)))
}

/** Só muda a lista se ela mudou de verdade (id inexistente = mesma referência). */
function comLista<T extends object, K extends keyof T>(obj: T, chave: K, lista: T[K]): T {
  return lista === obj[chave] ? obj : { ...obj, [chave]: lista }
}

export function reduzir(dados: Dados, acao: Acao): Dados {
  switch (acao.tipo) {
    case 'materia/adicionar':
      return { ...dados, materias: [...dados.materias, acao.materia] }
    case 'materia/editar':
      return naMateria(dados, acao.materiaId, (m) => aplicar(m, acao.campos))
    case 'materia/substituir':
      return naMateria(dados, acao.materia.id, () => acao.materia)
    case 'materia/remover': {
      const materias = tirar(dados.materias, acao.materiaId)
      if (materias === dados.materias) return dados
      return { ...dados, materias, eventos: dados.eventos.filter((e) => e.materiaId !== acao.materiaId) }
    }

    case 'ra/adicionar':
      return naMateria(dados, acao.materiaId, (m) => ({ ...m, ras: [...m.ras, acao.ra] }))
    case 'ra/editar':
      return noRA(dados, acao.materiaId, acao.raId, (ra) => aplicar(ra, acao.campos))
    case 'ra/remover':
      return naMateria(dados, acao.materiaId, (m) => comLista(m, 'ras', tirar(m.ras, acao.raId)))

    case 'avaliacao/adicionar':
      return noRA(dados, acao.materiaId, acao.raId, (ra) => ({
        ...ra,
        avaliacoes: [...ra.avaliacoes, acao.avaliacao],
      }))
    case 'avaliacao/editar':
      return noRA(dados, acao.materiaId, acao.raId, (ra) =>
        comLista(ra, 'avaliacoes', trocar(ra.avaliacoes, acao.avaliacaoId, (a) => aplicar(a, acao.campos))),
      )
    case 'avaliacao/remover':
      return noRA(dados, acao.materiaId, acao.raId, (ra) =>
        comLista(ra, 'avaliacoes', tirar(ra.avaliacoes, acao.avaliacaoId)),
      )

    case 'pontoExtra/adicionar':
      return naMateria(dados, acao.materiaId, (m) => ({ ...m, pontosExtras: [...m.pontosExtras, acao.pontoExtra] }))
    case 'pontoExtra/remover':
      return naMateria(dados, acao.materiaId, (m) =>
        comLista(m, 'pontosExtras', tirar(m.pontosExtras, acao.pontoExtraId)),
      )

    case 'falta/adicionar':
      return naMateria(dados, acao.materiaId, (m) => ({ ...m, faltas: [...m.faltas, acao.falta] }))
    case 'falta/remover':
      return naMateria(dados, acao.materiaId, (m) => comLista(m, 'faltas', tirar(m.faltas, acao.faltaId)))

    case 'evento/adicionar':
      return { ...dados, eventos: [...dados.eventos, acao.evento] }
    case 'evento/editar':
      return comLista(dados, 'eventos', trocar(dados.eventos, acao.eventoId, (e) => aplicar(e, acao.campos)))
    case 'evento/remover':
      return comLista(dados, 'eventos', tirar(dados.eventos, acao.eventoId))

    case 'regraPadrao/definir':
      return { ...dados, regraPadrao: acao.regra }
    case 'dados/substituir':
      return acao.dados
  }
}
