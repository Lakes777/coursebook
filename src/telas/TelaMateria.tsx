import { CabecalhoTela } from '../componentes/CabecalhoTela'
import { usePainel } from '../estado/contexto'

export function TelaMateria({ id }: { id: string }) {
  const { dados } = usePainel()
  const materia = dados.materias.find((m) => m.id === id)
  if (!materia) {
    return (
      <CabecalhoTela titulo="Matéria não encontrada">
        <p className="muted">
          Ela pode ter sido removida. <a href="#/materias">Voltar para as matérias</a>
        </p>
      </CabecalhoTela>
    )
  }
  return <CabecalhoTela titulo={materia.nome} />
}
