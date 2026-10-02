import { ArrowRight, CalendarRange, ChartColumn, CodeXml, GraduationCap, RefreshCw } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ID_TITULO_TELA } from '../componentes/CabecalhoTela'
import { INICIO, paraHash } from '../navegacao/rota'
import './lobby.css'

const GITHUB = 'https://github.com/Lakes777/painel-estudos'

/** As pranchas do fundo (desenhos próprios em public/pranchas/), na ordem da 1ª faixa. */
const PRANCHAS = ['grade-semanal', 'caderno', 'calendario', 'livros', 'boletim', 'relogio-cronograma']

/**
 * Cada faixa desliza de lado numa velocidade (a do meio, ao contrário) e começa por uma
 * prancha diferente, para os mesmos desenhos não ficarem um embaixo do outro.
 */
const FAIXAS = [
  { inicio: 0, duracao: 64, inverter: false },
  { inicio: 2, duracao: 78, inverter: true },
  { inicio: 4, duracao: 96, inverter: false },
]

const DESTAQUES = [
  {
    Icone: CalendarRange,
    titulo: 'A semana por aula',
    texto: 'Os horários de todas as matérias numa grade, com a aula de agora marcada.',
  },
  {
    Icone: ChartColumn,
    titulo: 'Notas e média por matéria',
    texto: 'Notas por RA, faltas e quanto falta para passar, pela regra da PUC-PR.',
  },
  {
    Icone: RefreshCw,
    titulo: 'Sincroniza com a conta',
    texto: 'Funciona sem conta; com ela, o PC e o celular ficam com os mesmos dados.',
  },
]

/**
 * A faixa gira a lista em `inicio` e põe as pranchas duas vezes: andar 50% emenda sem
 * pulo. Em tela muito larga (2560 px, ultrawide, zoom de 80%) um conjunto só não cobre a
 * tela e abriria um vão no fim de cada volta; aí cada metade repete o conjunto quantas
 * vezes precisar para passar da largura da tela.
 */
function Faixa({ inicio, duracao, inverter }: (typeof FAIXAS)[number]) {
  const ordem = [...PRANCHAS.slice(inicio), ...PRANCHAS.slice(0, inicio)]
  const trilho = useRef<HTMLDivElement>(null)
  const [repeticoes, setRepeticoes] = useState(1)

  useLayoutEffect(() => {
    function medir() {
      const elemento = trilho.current
      if (!elemento) return
      // A largura de um conjunto sai do próprio trilho (o CSS muda o tamanho das pranchas no celular).
      const conjunto = elemento.scrollWidth / 2 / repeticoes
      if (conjunto <= 0) return // sem layout (testes)
      const tela = Math.max(window.screen?.width ?? 0, window.innerWidth)
      setRepeticoes(Math.max(1, Math.ceil(tela / conjunto)))
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [repeticoes])

  const metade = Array.from({ length: repeticoes }, () => ordem).flat()
  return (
    <div className="lobby__faixa">
      <div
        ref={trilho}
        className={inverter ? 'lobby__trilho lobby__trilho--inverso' : 'lobby__trilho'}
        style={{ animationDuration: `${duracao * repeticoes}s` }}
      >
        {[...metade, ...metade].map((nome, i) => (
          <img
            key={i}
            className="lobby__prancha"
            src={`${import.meta.env.BASE_URL}pranchas/${nome}.svg`}
            alt=""
            aria-hidden="true"
            width={520}
            height={300}
            decoding="async"
            draggable={false}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * A página de entrada, no endereço raiz: o que é o painel e o botão para começar, com
 * as pranchas de estudo passando devagar no fundo. O topo e as abas ficam por cima,
 * como nas outras telas; `avisos` são os do armazenamento, mostrados acima do título.
 */
export function TelaLobby({ avisos }: { avisos?: ReactNode }) {
  useEffect(() => {
    document.title = 'Coursebook'
  }, [])

  return (
    <div className="lobby">
      <div className="lobby__fundo" aria-hidden="true">
        <div className="lobby__faixas">
          {FAIXAS.map((faixa) => (
            <Faixa key={faixa.inicio} {...faixa} />
          ))}
        </div>
        <div className="lobby__grade" />
        <div className="lobby__vinheta" />
        <div className="lobby__grao" />
      </div>

      <div className="lobby__conteudo">
        {avisos && <div className="lobby__avisos">{avisos}</div>}
        <section aria-labelledby={ID_TITULO_TELA} className="lobby__secao">
          <p className="lobby__selo">
            <GraduationCap className="icone" size={18} />
            Organizador do semestre
          </p>
          {/* tabIndex -1: ao voltar para o lobby, o App põe o foco aqui (como nas outras telas). */}
          <h1 id={ID_TITULO_TELA} tabIndex={-1} className="lobby__titulo titulo-tela">
            Coursebook
          </h1>
          <p className="lobby__frase">
            Matérias, aulas, provas e notas da faculdade num lugar só: veja a semana, os prazos e quanto falta para
            passar em cada matéria.
          </p>
          <ul className="lobby__destaques">
            {DESTAQUES.map(({ Icone, titulo, texto }) => (
              <li key={titulo} className="lobby__destaque spot">
                <span className="lobby__icone">
                  <Icone className="icone" size={20} />
                </span>
                <span>
                  <strong className="lobby__destaque-titulo">{titulo}</strong>
                  <span className="lobby__destaque-texto">{texto}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="lobby__acoes">
            <a href={paraHash(INICIO)} className="botao botao--vivo lobby__comecar">
              Começar
              <ArrowRight className="icone" size={18} />
            </a>
            <a href={GITHUB} className="lobby__codigo" target="_blank" rel="noreferrer">
              <CodeXml className="icone" size={16} />
              Ver o código no GitHub
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
