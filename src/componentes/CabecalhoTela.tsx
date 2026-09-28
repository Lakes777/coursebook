import { useEffect, type ReactNode } from 'react'

/** Id do título de cada tela; o App põe o foco nele quando a tela muda. */
export const ID_TITULO_TELA = 'titulo-tela'

interface Props {
  titulo: string
  children?: ReactNode
}

/**
 * Moldura de toda tela: a seção com nome acessível, o título (que recebe o foco
 * ao trocar de tela) e o título da aba do navegador, que aparece no histórico.
 */
export function CabecalhoTela({ titulo, children }: Props) {
  useEffect(() => {
    document.title = `${titulo} · Painel de estudos`
  }, [titulo])

  return (
    <section aria-labelledby={ID_TITULO_TELA}>
      {/* tabIndex -1: dá para pôr o foco pelo código, mas o Tab não para aqui. */}
      <h2 id={ID_TITULO_TELA} tabIndex={-1} className="titulo-tela">
        {titulo}
      </h2>
      {children}
    </section>
  )
}
