import type { ReactNode } from 'react'
import type { ErroCampo } from './novaMateriaUtil'
import './novaMateria.css'

/** Props que o campo recebe: id, e a ligação com a dica e com o erro. */
export interface PropsCampo {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
}

interface PropsRotulado {
  id: string
  rotulo: string
  dica?: ReactNode
  erro: ErroCampo | null
  children: (props: PropsCampo) => ReactNode
}

/**
 * Rótulo, campo, dica e erro, ligados: o leitor de tela lê a dica e o erro junto
 * com o campo, e o campo com erro fica marcado com aria-invalid.
 */
export function Rotulado({ id, rotulo, dica, erro, children }: PropsRotulado) {
  const temErro = erro?.campo === id
  const descricao = [dica ? `${id}-dica` : '', temErro ? `${id}-erro` : ''].filter(Boolean).join(' ')
  return (
    <div className="nm-campo">
      <label htmlFor={id}>{rotulo}</label>
      {children({
        id,
        ...(temErro ? { 'aria-invalid': true } : {}),
        ...(descricao ? { 'aria-describedby': descricao } : {}),
      })}
      {dica && (
        <p id={`${id}-dica`} className="nm-campo__dica muted">
          {dica}
        </p>
      )}
      {temErro && (
        <p id={`${id}-erro`} className="nm-campo__erro">
          {erro.mensagem}
        </p>
      )}
    </div>
  )
}
