import { ArrowRight, Eye, Plus } from 'lucide-react'
import { CabecalhoTela, ID_TITULO_TELA } from '../componentes/CabecalhoTela'
import { Selo } from '../componentes/Selo'
import { useHoje } from '../componentes/useHoje'
import { useVerExemplo } from '../componentes/useVerExemplo'
import { usePainel } from '../estado/contexto'
import { formatarData } from '../logica/datas'
import { agenda, NOMES_TIPO, textoPrazo } from '../logica/eventos'
import { paraHash } from '../navegacao/rota'
import { ICONE_TIPO_EVENTO } from '../tema/icones'
import { tomFaltas, tomNota, tomPrazo } from '../tema/tons'
import { resumoMateria, resumoSemestre, textoFaltas, textoNota, textoSelo } from '../tema/textos'
import './materias.css'

const NOVA_MATERIA = paraHash({ tela: 'nova-materia' })
/** Quantos prazos da agenda aparecem embaixo das matérias. */
const PRAZOS_NA_LISTA = 3
const ID_PRAZOS = 'materias-prazos'

export function TelaMaterias() {
  const { dados } = usePainel()
  const { materias, regraPadrao } = dados
  const { verExemplo, podeVerExemplo } = useVerExemplo()
  const resumos = materias.map((materia) => ({ materia, ...resumoMateria(materia, regraPadrao) }))

  return (
    <CabecalhoTela titulo="Matérias">
      {materias.length === 0 ? (
        <div className="cartao vazio">
          <p>
            Cadastre as matérias do semestre com os RAs e as avaliações de cada uma, como estão no plano de
            ensino. O painel calcula quanto falta para passar e acompanha as faltas.
          </p>
          <div className="vazio__botoes">
            <a className="botao botao--vivo" href={NOVA_MATERIA}>
              <Plus className="icone" size={16} />
              Cadastrar a primeira matéria
            </a>
            <button type="button" className="botao botao--fantasma" onClick={verExemplo} disabled={!podeVerExemplo}>
              <Eye className="icone" size={16} />
              Ver com dados de exemplo
            </button>
          </div>
          <p className="vazio__alternativa">
            Tem um backup, ou quer que uma IA leia o plano de ensino?{' '}
            <a href={paraHash({ tela: 'dados' })}>Importe em Dados</a>. O exemplo pode ser apagado depois,
            também em Dados.
          </p>
        </div>
      ) : (
        <>
          <div className="barra-acoes">
            <p className="muted barra-acoes__resumo">
              {resumoSemestre(resumos).map((parte, i) => (
                <span key={parte}>
                  {i > 0 && ' · '}
                  <span className="barra-acoes__parte">{parte}</span>
                </span>
              ))}
            </p>
            <a className="botao botao--vivo" href={NOVA_MATERIA}>
              <Plus className="icone" size={16} />
              Nova matéria
            </a>
          </div>
          <ul className="grade-materias" aria-labelledby={ID_TITULO_TELA}>
            {resumos.map(({ materia, nota, faltas }) => (
              <li key={materia.id} className="cartao cartao-materia spot">
                <h3 className="cartao-materia__nome">
                  {/* O link cobre o cartão inteiro (pelo CSS), mas o nome é o texto dele. */}
                  <a href={paraHash({ tela: 'materia', id: materia.id })}>{materia.nome}</a>
                </h3>
                {materia.professor && <p className="muted cartao-materia__professor">{materia.professor}</p>}
                <div className="cartao-materia__selos">
                  <Selo tom={tomNota(nota)}>{textoNota(nota)}</Selo>
                  <Selo tom={tomFaltas(faltas.nivel)}>{textoFaltas(faltas)}</Selo>
                </div>
              </li>
            ))}
          </ul>
          <ProximosPrazos />
        </>
      )}
    </CabecalhoTela>
  )
}

/**
 * Os próximos itens da agenda que ainda não foram feitos (os atrasados primeiro), para
 * a lista de matérias mostrar o que está chegando sem precisar abrir a Agenda.
 * Sem nada pendente, não aparece.
 */
function ProximosPrazos() {
  const { dados } = usePainel()
  const hoje = useHoje()
  const pendentes = agenda(dados.eventos, hoje).filter((e) => !e.concluido)
  if (pendentes.length === 0) return null
  const nomeMateria = new Map(dados.materias.map((m) => [m.id, m.nome]))
  const mais = pendentes.length - PRAZOS_NA_LISTA

  return (
    <section className="cartao prazos" aria-labelledby={ID_PRAZOS}>
      <div className="prazos__topo">
        <h3 id={ID_PRAZOS} className="prazos__titulo">
          Próximos prazos
        </h3>
        <a className="link-icone prazos__agenda" href={paraHash({ tela: 'agenda' })}>
          {mais > 0 ? `Ver a agenda (mais ${mais})` : 'Ver a agenda'}
          <ArrowRight className="icone" size={16} aria-hidden="true" />
        </a>
      </div>
      <ul className="prazos__lista" aria-labelledby={ID_PRAZOS}>
        {pendentes.slice(0, PRAZOS_NA_LISTA).map((evento) => {
          const Icone = ICONE_TIPO_EVENTO[evento.tipo]
          const selo = textoSelo(evento)
          const materia = evento.materiaId ? nomeMateria.get(evento.materiaId) : undefined
          return (
            <li key={evento.id} className="prazos__item">
              <Icone className="icone prazos__icone" size={18} aria-hidden="true" />
              <span className="prazos__texto">
                <span className="prazos__nome">
                  {/* O ícone diz o tipo só para quem vê; o leitor de tela ouve "Prova: Prova do RA2". */}
                  <span className="invisivel">{NOMES_TIPO[evento.tipo]}: </span>
                  {evento.titulo}
                </span>
                <span className="muted prazos__detalhe">
                  {materia && `${materia} · `}
                  <time dateTime={evento.data}>{formatarData(evento.data)}</time> · {textoPrazo(evento.dias)}
                </span>
              </span>
              {selo && <Selo tom={tomPrazo(evento.destaque)}>{selo}</Selo>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
