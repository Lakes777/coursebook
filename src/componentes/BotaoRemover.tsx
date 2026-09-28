import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'

interface Props {
  /** O que vai ser removido, para os rótulos: "Remover Prova do RA1". */
  nome: string
  /** Remove de verdade. Quem chama decide para onde vai o foco, porque este botão some junto. */
  aoConfirmar: () => void
  /** Texto do botão; o padrão é "Remover". */
  texto?: string
}

/**
 * Remover em 2 passos: "Remover" troca por "Confirmar" e "Cancelar", para um clique
 * sem querer não apagar nada. Os botões trocam de lugar; sem mover o foco, ele se
 * perderia com o botão que sumiu.
 */
export function BotaoRemover({ nome, aoConfirmar, texto = 'Remover' }: Props) {
  const [confirmando, setConfirmando] = useState(false)
  const botaoRemover = useRef<HTMLButtonElement>(null)
  const botaoCancelar = useRef<HTMLButtonElement>(null)

  function pedirConfirmacao() {
    flushSync(() => setConfirmando(true))
    botaoCancelar.current?.focus()
  }

  function cancelar() {
    flushSync(() => setConfirmando(false))
    botaoRemover.current?.focus()
  }

  if (confirmando) {
    return (
      <span className="confirmar-remocao">
        <button
          type="button"
          className="botao botao--perigo botao--pequeno"
          onClick={aoConfirmar}
          aria-label={`Confirmar remoção de ${nome}`}
        >
          Confirmar
        </button>
        <button
          ref={botaoCancelar}
          type="button"
          className="botao botao--fantasma botao--pequeno"
          onClick={cancelar}
          aria-label={`Cancelar remoção de ${nome}`}
        >
          Cancelar
        </button>
      </span>
    )
  }
  return (
    <button
      ref={botaoRemover}
      type="button"
      className="botao botao--fantasma botao--pequeno"
      onClick={pedirConfirmacao}
      aria-label={`${texto} ${nome}`}
    >
      {texto}
    </button>
  )
}
