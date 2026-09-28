import type { ReactNode } from 'react'
import { ICONE_TOM } from '../tema/icones'
import type { Tom } from '../tema/tons'

interface Props {
  tom: Tom
  children: ReactNode
}

/**
 * Etiqueta de situação ("Aprovado", "Recuperação", "Faltam 3 dias"). Sempre tem
 * texto: a cor e o ícone ajudam, mas não podem ser o único jeito de entender.
 */
export function Selo({ tom, children }: Props) {
  const Icone = ICONE_TOM[tom]
  return (
    <span className={`selo selo--${tom}`}>
      <Icone className="icone" size={14} />
      {children}
    </span>
  )
}
