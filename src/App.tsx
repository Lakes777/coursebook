import { CalendarDays, CalendarRange, DatabaseBackup, GraduationCap, LibraryBig } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Avisos } from './componentes/Avisos'
import { AvisoDesfazer } from './componentes/AvisoDesfazer'
import { ID_TITULO_TELA } from './componentes/CabecalhoTela'
import { paraHash, type Rota } from './navegacao/rota'
import { useRota } from './navegacao/useRota'
import { SituacaoNuvem } from './nuvem/SituacaoNuvem'
import { TelaAgenda } from './telas/TelaAgenda'
import { TelaDados } from './telas/TelaDados'
import { TelaEditarMateria } from './telas/TelaEditarMateria'
import { TelaMateria } from './telas/TelaMateria'
import { TelaMaterias } from './telas/TelaMaterias'
import { TelaNovaMateria } from './telas/TelaNovaMateria'
import { TelaSemana } from './telas/TelaSemana'

const ABAS = [
  { tela: 'materias', nome: 'Matérias', Icone: LibraryBig },
  { tela: 'semana', nome: 'Semana', Icone: CalendarRange },
  { tela: 'agenda', nome: 'Agenda', Icone: CalendarDays },
  { tela: 'dados', nome: 'Dados', Icone: DatabaseBackup },
] as const

/** Qual aba fica marcada: a matéria aberta, a nova e a editada ficam dentro de "Matérias". */
function abaDe(rota: Rota): (typeof ABAS)[number]['tela'] {
  return rota.tela === 'semana' || rota.tela === 'agenda' || rota.tela === 'dados' ? rota.tela : 'materias'
}

function Tela({ rota }: { rota: Rota }) {
  switch (rota.tela) {
    case 'materias':
      return <TelaMaterias />
    case 'materia':
      // key: de uma matéria para outra, começa uma tela nova (sem rascunho da anterior).
      return <TelaMateria key={rota.id} id={rota.id} />
    case 'editar-materia':
      return <TelaEditarMateria key={rota.id} id={rota.id} />
    case 'nova-materia':
      return <TelaNovaMateria />
    case 'semana':
      return <TelaSemana />
    case 'agenda':
      return <TelaAgenda />
    case 'dados':
      return <TelaDados />
  }
}

/**
 * Quando a tela muda, o foco vai para o título dela: sem isso, o foco de quem usa
 * teclado ou leitor de tela cai no começo da página e nada é anunciado. Na primeira
 * carga não mexe, para não roubar o foco de quem acabou de abrir a página.
 */
function useFocoAoTrocarDeTela(rota: Rota) {
  const chave = paraHash(rota)
  const anterior = useRef(chave)
  useEffect(() => {
    // Comparar com a anterior (e não "é a primeira vez?") funciona no StrictMode,
    // que roda o efeito duas vezes ao montar.
    if (anterior.current === chave) return
    anterior.current = chave
    document.getElementById(ID_TITULO_TELA)?.focus()
  }, [chave])
}

/** Quanto dura a entrada da tela (o último bloco começa em 0,5 s e leva 0,5 s). */
const DURACAO_ENTRADA_MS = 1100

/**
 * Cada tela entra em blocos, como no portfólio: o título, depois o conteúdo principal
 * e por fim o resto (CSS em .tela--entrando). A classe sai quando a entrada acaba,
 * para o que aparecer depois na tela (um aviso, uma confirmação) surgir na hora.
 */
function EntradaDaTela({ children }: { children: ReactNode }) {
  const [entrando, setEntrando] = useState(true)
  useEffect(() => {
    const temporizador = setTimeout(() => setEntrando(false), DURACAO_ENTRADA_MS)
    return () => clearTimeout(temporizador)
  }, [])
  return <div className={entrando ? 'tela tela--entrando' : 'tela'}>{children}</div>
}

/** Pílula atrás da aba ativa: desliza de uma aba para a outra (mede a posição do link). */
function usePilulaDasAbas(aba: string) {
  const nav = useRef<HTMLElement>(null)
  const pilula = useRef<HTMLSpanElement>(null)
  const primeira = useRef(true)

  useLayoutEffect(() => {
    function mover() {
      const ativo = nav.current?.querySelector<HTMLElement>('[aria-current="page"]')
      const fundo = pilula.current
      if (!ativo || !fundo) return
      fundo.style.width = `${ativo.offsetWidth}px`
      fundo.style.height = `${ativo.offsetHeight}px`
      fundo.style.transform = `translate(${ativo.offsetLeft}px, ${ativo.offsetTop}px)`
    }
    // Na primeira vez a pílula já nasce no lugar, sem deslizar a partir do canto.
    if (primeira.current && pilula.current) {
      primeira.current = false
      pilula.current.style.transition = 'none'
      mover()
      void pilula.current.offsetWidth
      pilula.current.style.transition = ''
    } else {
      mover()
    }
    // A largura das abas muda quando a fonte termina de carregar e quando a janela muda.
    void document.fonts?.ready.then(mover)
    window.addEventListener('resize', mover)
    return () => window.removeEventListener('resize', mover)
  }, [aba])

  return { nav, pilula }
}

/** Brilho que segue o mouse nos cartões com .spot (um ouvinte só, na página toda). */
function useBrilhoNosCartoes() {
  useEffect(() => {
    function aoMover(evento: PointerEvent) {
      const cartao = (evento.target as Element | null)?.closest?.<HTMLElement>('.spot')
      if (!cartao) return
      const caixa = cartao.getBoundingClientRect()
      cartao.style.setProperty('--mx', `${evento.clientX - caixa.left}px`)
      cartao.style.setProperty('--my', `${evento.clientY - caixa.top}px`)
    }
    document.addEventListener('pointermove', aoMover)
    return () => document.removeEventListener('pointermove', aoMover)
  }, [])
}

/**
 * Guarda a altura do topo em --altura-topo: com o topo fixo, a rolagem até um campo ou
 * seção para logo abaixo dele (scroll-padding-top), mesmo quando ele quebra em 2 linhas.
 */
function useAlturaDoTopo() {
  const topo = useRef<HTMLElement>(null)
  useEffect(() => {
    const elemento = topo.current
    if (!elemento || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--altura-topo', `${elemento.offsetHeight}px`)
    })
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])
  return topo
}

function App() {
  const rota = useRota()
  const aba = abaDe(rota)
  useFocoAoTrocarDeTela(rota)
  const { nav, pilula } = usePilulaDasAbas(aba)
  useBrilhoNosCartoes()
  const topo = useAlturaDoTopo()
  return (
    <>
      <header className="topo" ref={topo}>
        <div className="container topo__conteudo">
          <div className="topo__marca">
            <h1 className="topo__titulo">
              <GraduationCap className="icone" size={26} />
              Painel de estudos
            </h1>
            <SituacaoNuvem />
          </div>
          <nav aria-label="Seções" className="abas" ref={nav}>
            <span className="abas__pilula" ref={pilula} aria-hidden="true" />
            {ABAS.map(({ tela, nome, Icone }) => (
              <a
                key={tela}
                href={`#/${tela}`}
                className="abas__item"
                aria-current={aba === tela ? 'page' : undefined}
              >
                <Icone className="icone" size={18} />
                {nome}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="container conteudo">
        <Avisos />
        {/* key: cada endereço é uma tela nova, que entra com a animação. */}
        <EntradaDaTela key={paraHash(rota)}>
          <Tela rota={rota} />
        </EntradaDaTela>
      </main>
      <AvisoDesfazer />
    </>
  )
}

export default App
