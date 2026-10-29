import type { SituacaoFaltas } from '../../logica/faltas'
import './barraFaltas.css'

/**
 * Barra fina com as faltas usadas do limite (a mesma do "Semestre" do Início). É só
 * desenho: o selo ao lado já diz "4 de 20 faltas" em texto. Sem carga horária não
 * há limite, então não há o que medir e a barra não aparece.
 */
export function BarraFaltas({ situacao }: { situacao: SituacaoFaltas }) {
  if (situacao.nivel === 'sem-carga-horaria') return null
  const { total, limite } = situacao
  const largura = limite === 0 ? 100 : Math.min(100, (total / limite) * 100)
  return (
    <span className="barra-faltas" aria-hidden="true">
      <span style={{ width: `${largura}%` }} />
    </span>
  )
}
