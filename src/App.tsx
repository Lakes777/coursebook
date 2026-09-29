import { CalendarDays, CalendarRange, DatabaseBackup, GraduationCap, LibraryBig } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Avisos } from './componentes/Avisos'
import { ID_TITULO_TELA } from './componentes/CabecalhoTela'
import { paraHash, type Rota } from './navegacao/rota'
import { useRota } from './navegacao/useRota'
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

function App() {
  const rota = useRota()
  const aba = abaDe(rota)
  useFocoAoTrocarDeTela(rota)
  return (
    <>
      <header className="topo">
        <div className="container topo__conteudo">
          <h1 className="topo__titulo">
            <GraduationCap className="icone" size={26} />
            Painel de estudos
          </h1>
          <nav aria-label="Seções" className="abas">
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
        <Tela rota={rota} />
      </main>
    </>
  )
}

export default App
