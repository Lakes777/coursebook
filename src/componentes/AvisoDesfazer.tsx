import { Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { usePainel } from '../estado/contexto'
import { ID_TITULO_TELA } from './CabecalhoTela'

/** Quanto tempo o aviso fica na tela (parado enquanto o mouse ou o foco estão nele). */
export const TEMPO_DESFAZER_MS = 12_000

/** Onde Ctrl+Z é do próprio campo (desfaz o que foi digitado), e não do painel. */
function ehCampoDeTexto(alvo: EventTarget | null): boolean {
  return alvo instanceof HTMLElement && (alvo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName))
}

/**
 * "Falta removida. Desfazer" no pé da página, depois de uma ação que apaga algo.
 * Some sozinho depois de um tempo, ao fechar ou na próxima ação; Ctrl+Z (fora dos
 * campos) também desfaz.
 */
export function AvisoDesfazer() {
  const { desfazer, aoDesfazer, esquecerDesfazer } = usePainel()
  const [parado, setParado] = useState(false)
  const [desfeito, setDesfeito] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  // Cada ação nova (mesmo com o mesmo texto) recomeça o tempo.
  useEffect(() => {
    if (!desfazer || parado) return
    const id = setTimeout(esquecerDesfazer, TEMPO_DESFAZER_MS)
    return () => clearTimeout(id)
  }, [desfazer, parado, esquecerDesfazer])

  // "Desfeito." fica um pouco na região de status, para o leitor de tela anunciar.
  useEffect(() => {
    if (!desfeito) return
    const id = setTimeout(() => setDesfeito(false), 4000)
    return () => clearTimeout(id)
  }, [desfeito])

  function voltar() {
    // O botão vai sumir: o foco iria para o começo da página. Vai para o título da tela.
    const focoNoAviso = caixa.current?.contains(document.activeElement)
    aoDesfazer()
    setDesfeito(true)
    // O aviso some sem "mouseleave": sem isto, o próximo ficaria parado para sempre.
    setParado(false)
    if (focoNoAviso) document.getElementById(ID_TITULO_TELA)?.focus()
  }

  function fechar() {
    esquecerDesfazer()
    setParado(false)
    document.getElementById(ID_TITULO_TELA)?.focus()
  }

  const voltarRef = useRef(voltar)
  useEffect(() => {
    voltarRef.current = voltar
  })

  useEffect(() => {
    if (!desfazer) return
    const aoTeclar = (e: KeyboardEvent) => {
      const atalho = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z'
      if (!atalho || ehCampoDeTexto(e.target)) return
      e.preventDefault()
      voltarRef.current()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [desfazer])

  // O texto fica num <p role="status"> que existe sempre (o leitor de tela só anuncia
  // mudanças numa região que já estava na página), e os botões ficam fora dele: senão
  // o anúncio seria "Falta removida. Desfazer Fechar aviso".
  const texto = desfazer ? desfazer.texto : desfeito ? 'Desfeito.' : ''
  return (
    <div
      ref={caixa}
      className="desfazer"
      onMouseEnter={() => setParado(true)}
      onMouseLeave={() => setParado(false)}
      onFocus={() => setParado(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setParado(false)
      }}
    >
      <div className={texto ? 'desfazer__caixa' : undefined}>
        <p role="status" className={texto ? 'desfazer__texto' : 'invisivel'}>
          {texto}
        </p>
        {desfazer && (
          <>
            <button type="button" className="botao botao--pequeno" onClick={voltar}>
              <Undo2 className="icone" size={16} aria-hidden="true" />
              Desfazer
            </button>
            <button
              type="button"
              className="botao botao--fantasma botao--pequeno desfazer__fechar"
              onClick={fechar}
              aria-label="Fechar aviso"
            >
              <X className="icone" size={16} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
