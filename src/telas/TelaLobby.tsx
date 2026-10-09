import { ArrowRight, CodeXml } from 'lucide-react'
import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react'
import { ID_TITULO_TELA } from '../componentes/CabecalhoTela'
import { useAgora } from '../componentes/useHoje'
import { usePainel } from '../estado/contexto'
import { dadosDeExemplo } from '../logica/exemplo'
import type { DiaSemana } from '../logica/tipos'
import { INICIO, paraHash } from '../navegacao/rota'
import { diasPerto, ladoDoTexto } from './lobbyUtil'
import { aulaDeAgora, gradeDaSemana } from './semanaUtil'
import './lobby.css'

const GITHUB = 'https://github.com/Lakes777/coursebook'

const DESTAQUES = [
  'A semana por aula, com a aula de agora marcada',
  'Notas por RA, faltas e quanto falta para passar',
  'Funciona sem conta; com ela, PC e celular com os mesmos dados',
]

/**
 * O fundo do lobby: a grade da semana de verdade (a mesma da aba Semana), com a aula
 * de agora acesa. Sem matérias (ou sem nenhum horário na tabela da PUC), mostra a do
 * exemplo, para a tela não ficar vazia.
 * No celular só cabem dois dias: ficam hoje e o próximo dia com coluna na grade.
 * É decoração (a grade de verdade, acessível, fica na aba Semana).
 */
function useGradeDoLobby() {
  const { dados } = usePainel()
  const agora = useAgora()
  // O exemplo só muda de dia para dia; sem o useMemo ele seria recriado a cada minuto.
  const exemplo = useMemo(() => gradeDaSemana(dadosDeExemplo().materias), [])
  const grade = useMemo(() => {
    const minha = gradeDaSemana(dados.materias)
    return minha.linhas.length > 0 ? minha : exemplo
  }, [dados.materias, exemplo])
  return { grade, aulaAgora: aulaDeAgora(agora), hoje: agora.getDay() as DiaSemana }
}

type GradeDoLobby = ReturnType<typeof useGradeDoLobby>

function GradeDeFundo({ grade, aulaAgora, hoje }: GradeDoLobby) {
  const perto = diasPerto(grade, hoje)

  const coluna = (dia: DiaSemana) => (perto.has(dia) ? ' lobby__celula--perto' : '')

  return (
    <div
      className="lobby__grade"
      aria-hidden="true"
      style={{ '--dias': grade.dias.length } as CSSProperties}
    >
      <div className="lobby__celula lobby__celula--canto" />
      {grade.dias.map(({ dia, nome }) => (
        <div
          key={dia}
          className={`lobby__celula lobby__celula--dia${dia === hoje ? ' lobby__celula--hoje' : ''}${coluna(dia)}`}
        >
          {nome.slice(0, 3)}
        </div>
      ))}
      {grade.linhas.map((linha, i) =>
        linha.tipo === 'vazio' ? (
          <div key={`v${i}`} className="lobby__celula lobby__celula--intervalo">
            {linha.de} – {linha.ate}
          </div>
        ) : (
          [
            <div key={`h${i}`} className="lobby__celula lobby__celula--hora">
              {linha.aula.inicio}
            </div>,
            ...linha.celulas.map((aulas, d) => {
              const dia = grade.dias[d].dia
              const acesa = aulas.length > 0 && dia === hoje && aulaAgora?.numero === linha.aula.numero
              return (
                <div key={`${i}-${dia}`} className={`lobby__celula${coluna(dia)}`}>
                  {aulas.length > 0 && (
                    <span className={acesa ? 'lobby__aula lobby__aula--agora' : 'lobby__aula'}>
                      {aulas[0].materia}
                      {aulas.length > 1 && ` +${aulas.length - 1}`}
                      {acesa && <small> · agora</small>}
                    </span>
                  )}
                </div>
              )
            }),
          ]
        ),
      )}
    </div>
  )
}

/**
 * A página de entrada, no endereço raiz: a grade da semana ocupa o fundo e o nome,
 * enorme e em letra larga, fica por cima, com o que é o painel e o botão para começar.
 * O topo e as abas ficam por cima, como nas outras telas; `avisos` são os do
 * armazenamento, mostrados acima do título.
 */
export function TelaLobby({ avisos }: { avisos?: ReactNode }) {
  useEffect(() => {
    document.title = 'Coursebook'
  }, [])
  const gradeDoLobby = useGradeDoLobby()

  return (
    <div className={`lobby lobby--${ladoDoTexto(gradeDoLobby.grade, gradeDoLobby.hoje)}`}>
      <GradeDeFundo {...gradeDoLobby} />

      <div className="lobby__conteudo">
        {avisos && <div className="lobby__avisos">{avisos}</div>}
        <section aria-labelledby={ID_TITULO_TELA} className="lobby__secao">
          <p className="lobby__selo">Organizador do semestre · PUC-PR</p>
          {/* tabIndex -1: ao voltar para o lobby, o App põe o foco aqui (como nas outras telas).
              As duas partes viram duas linhas no CSS; o aria-label garante que o leitor de
              tela diga "Coursebook", e não "Course book". */}
          <h1 id={ID_TITULO_TELA} tabIndex={-1} className="lobby__titulo titulo-tela" aria-label="Coursebook">
            <span>Course</span>
            <span>book</span>
          </h1>
          <div className="lobby__tarja">
            <p className="lobby__frase">
              Matérias, aulas, provas e notas da faculdade num lugar só: a semana, os prazos e quanto falta para
              passar em cada matéria.
            </p>
            <ul className="lobby__destaques">
              {DESTAQUES.map((texto, i) => (
                <li key={texto}>
                  <span className="lobby__numero" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {texto}
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
          </div>
        </section>
      </div>
    </div>
  )
}
