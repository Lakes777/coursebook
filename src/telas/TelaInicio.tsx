import { ArrowRight, CalendarClock, CircleAlert, Clock, CodeXml, Eye, Flag, GraduationCap, Plus } from 'lucide-react'
import { useEffect, type CSSProperties } from 'react'
import { ID_TITULO_TELA } from '../componentes/CabecalhoTela'
import { useAgora } from '../componentes/useHoje'
import { useVerExemplo } from '../componentes/useVerExemplo'
import { usePainel } from '../estado/contexto'
import { agenda, NOMES_TIPO, textoPrazo, type EventoNaAgenda } from '../logica/eventos'
import type { Materia } from '../logica/tipos'
import { paraHash } from '../navegacao/rota'
import { ICONE_TIPO_EVENTO } from '../tema/icones'
import { resumoMateria } from '../tema/textos'
import {
  aulasDeHoje,
  contarAtencao,
  fraseDoDia,
  hora,
  limitesDaRegua,
  piorFalta,
  textoDoDia,
  type AulaDeHoje,
  type TrechoFrase,
} from './inicioUtil'
import './inicio.css'

const GITHUB = 'https://github.com/Lakes777/coursebook'

const DESTAQUES = [
  'O dia numa régua, com a aula de agora marcada',
  'Notas por RA, faltas e quanto falta para passar',
  'Funciona sem conta; com ela, PC e celular com os mesmos dados',
]

/**
 * Início "vidro": a frase do dia como título, os números do semestre, a régua com as
 * aulas de hoje e, embaixo, o que está atrasado e os próximos prazos. Sem nada
 * cadastrado, vira a apresentação do painel com os botões para começar.
 */
export function TelaInicio() {
  const { dados } = usePainel()
  // Atualiza a cada minuto: a linha de agora anda e a aula em andamento muda sozinha.
  const agora = useAgora()

  useEffect(() => {
    document.title = 'Coursebook'
  }, [])

  if (dados.materias.length === 0 && dados.eventos.length === 0) return <InicioVazio />

  const resumos = dados.materias.map((materia) => ({ materia, resumo: resumoMateria(materia, dados.regraPadrao) }))
  const atencao = contarAtencao(resumos.map((r) => r.resumo))
  const pendentes = agenda(dados.eventos, agora).filter((e) => !e.concluido)
  const aulas = aulasDeHoje(dados.materias, agora)
  const nomes = new Map(dados.materias.map((m) => [m.id, m.nome]))

  return (
    <section className="inicio" aria-labelledby={ID_TITULO_TELA}>
      <h1 id={ID_TITULO_TELA} tabIndex={-1} className="inicio__frase">
        <Frase trechos={fraseDoDia(agora, aulas, pendentes, atencao)} />
      </h1>
      <Semestre
        atencao={atencao}
        total={dados.materias.length}
        falta={piorFalta(resumos)}
        proximaProva={pendentes.find((e) => e.tipo === 'prova' && e.dias >= 0)}
      />
      <Hoje agora={agora} aulas={aulas} paraHoje={pendentes.filter((e) => e.dias === 0)} nomes={nomes} />
      <Atrasados atrasados={pendentes.filter((e) => e.dias < 0)} nomes={nomes} />
      <ProximosPrazos prazos={pendentes.filter((e) => e.dias > 0)} nomes={nomes} />
    </section>
  )
}

function Frase({ trechos }: { trechos: TrechoFrase[] }) {
  return trechos.map((t, i) => (t.forte ? <strong key={i}>{t.texto}</strong> : <span key={i}>{t.texto}</span>))
}

/** "Prova do RA2 (Programação Orientada a Objetos)"; sem matéria, só o título. */
function comMateria(evento: EventoNaAgenda, nomes: Map<string, string>) {
  const materia = evento.materiaId && nomes.get(evento.materiaId)
  return materia ? `${evento.titulo} · ${materia}` : evento.titulo
}

interface PropsSemestre {
  atencao: number
  total: number
  falta: { materia: Materia; total: number; limite: number } | null
  proximaProva: EventoNaAgenda | undefined
}

/** Só números que medem algo: nada de barra de "100%" que é sempre cheia. */
function Semestre({ atencao, total, falta, proximaProva }: PropsSemestre) {
  return (
    <section className="vidro spot inicio__semestre" aria-labelledby="inicio-semestre">
      <h2 id="inicio-semestre" className="inicio__rotulo">
        <GraduationCap className="icone" size={15} aria-hidden="true" />
        Semestre
      </h2>
      <dl className="numeros">
        <div className="numeros__item">
          <dt>Pedem atenção</dt>
          <dd>
            <span className="numeros__valor">{atencao}</span> de {total}
          </dd>
        </div>
        {falta && (
          <div className="numeros__item">
            <dt>Faltas · {falta.materia.nome}</dt>
            <dd>
              <span className="numeros__valor">{falta.total}</span> de {falta.limite}
              <span className="numeros__barra" aria-hidden="true">
                <span
                  style={{
                    width: `${falta.limite === 0 ? 100 : Math.min(100, (falta.total / falta.limite) * 100)}%`,
                  }}
                />
              </span>
            </dd>
          </div>
        )}
        {proximaProva && (
          <div className="numeros__item">
            <dt>Próxima prova</dt>
            <dd>
              {proximaProva.dias === 0 ? (
                <span className="numeros__valor">Hoje</span>
              ) : proximaProva.dias === 1 ? (
                <span className="numeros__valor">Amanhã</span>
              ) : (
                <>
                  <span className="numeros__valor">{proximaProva.dias}</span> dias
                </>
              )}
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}

interface PropsHoje {
  agora: Date
  aulas: AulaDeHoje[]
  paraHoje: EventoNaAgenda[]
  nomes: Map<string, string>
}

/** A régua do dia: as aulas como blocos sobre as horas, e uma linha marcando agora. */
function Hoje({ agora, aulas, paraHoje, nomes }: PropsHoje) {
  const limites = limitesDaRegua(aulas)
  const minutoAgora = agora.getHours() * 60 + agora.getMinutes()
  return (
    <section className="vidro spot inicio__hoje" aria-labelledby="inicio-hoje">
      <h2 id="inicio-hoje" className="inicio__rotulo">
        <Clock className="icone" size={15} aria-hidden="true" />
        Hoje · {textoDoDia(agora)}
      </h2>
      {limites ? (
        <Regua aulas={aulas} limites={limites} minutoAgora={minutoAgora} />
      ) : (
        <p className="inicio__vazio">Sem aulas hoje.</p>
      )}
      {paraHoje.length > 0 && (
        <p className="inicio__para-hoje">
          <Flag className="icone" size={16} aria-hidden="true" />
          <strong>Para hoje:</strong> {paraHoje.map((e) => comMateria(e, nomes)).join('; ')}
        </p>
      )}
    </section>
  )
}

interface PropsRegua {
  aulas: AulaDeHoje[]
  limites: { de: number; ate: number }
  minutoAgora: number
}

function Regua({ aulas, limites, minutoAgora }: PropsRegua) {
  const duracao = limites.ate - limites.de
  const posicao = (min: number) => ((min - limites.de) / duracao) * 100
  const horas = Array.from({ length: duracao / 60 + 1 }, (_, i) => limites.de + i * 60)
  const faixas = Math.max(...aulas.map((a) => a.faixa)) + 1
  const agoraNaRegua = minutoAgora >= limites.de && minutoAgora <= limites.ate
  return (
    <div className="regua" style={{ '--faixas': faixas } as CSSProperties}>
      {/* As horas e a linha de agora são só desenho: cada aula já diz o horário dela. */}
      <div className="regua__horas" aria-hidden="true">
        {horas.map((h) => (
          <span key={h} style={{ '--x': posicao(h) } as CSSProperties}>
            {String(h / 60).padStart(2, '0')}h
          </span>
        ))}
      </div>
      {agoraNaRegua && (
        <div className="regua__agora" aria-hidden="true" style={{ '--x': posicao(minutoAgora) } as CSSProperties}>
          <span>{hora(minutoAgora)}</span>
        </div>
      )}
      <ul className="regua__aulas" aria-label="Aulas de hoje">
        {aulas.map((a) => {
          const emAndamento = a.de <= minutoAgora && minutoAgora < a.ate
          return (
            <li
              key={`${a.materiaId}-${a.de}`}
              className={`regua__aula${emAndamento ? ' regua__aula--agora' : ''}`}
              aria-current={emAndamento ? 'time' : undefined}
              style={
                {
                  '--x': posicao(a.de),
                  '--largura': posicao(a.ate) - posicao(a.de),
                  '--faixa': a.faixa,
                } as CSSProperties
              }
            >
              {a.divisoes.map((d) => (
                <span
                  key={d}
                  className="regua__divisao"
                  aria-hidden="true"
                  style={{ '--x': ((d - a.de) / (a.ate - a.de)) * 100 } as CSSProperties}
                />
              ))}
              <span className="regua__faixa">
                {hora(a.de)} – {hora(a.ate)} · {a.aulas} {a.aulas === 1 ? 'aula' : 'aulas'}
              </span>
              <a className="regua__materia" href={paraHash({ tela: 'materia', id: a.materiaId })}>
                {a.materia}
              </a>
              {a.professor && <span className="regua__professor">{a.professor}</span>}
              {emAndamento && (
                <span className="regua__selo">
                  <span className="invisivel">, </span>Agora
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** O ícone do tipo (prova, trabalho, apresentação), com o nome do tipo para o leitor de tela. */
function IconeTipo({ evento }: { evento: EventoNaAgenda }) {
  const Icone = ICONE_TIPO_EVENTO[evento.tipo]
  return (
    <>
      <Icone className="icone inicio__tipo" size={15} aria-hidden="true" />
      <span className="invisivel">{NOMES_TIPO[evento.tipo]}: </span>
    </>
  )
}

interface PropsLista {
  nomes: Map<string, string>
}

function Atrasados({ atrasados, nomes }: PropsLista & { atrasados: EventoNaAgenda[] }) {
  const mostrar = atrasados.slice(0, 3)
  return (
    <section className="vidro spot inicio__atrasado" aria-labelledby="inicio-atrasado">
      <h2 id="inicio-atrasado" className="inicio__rotulo">
        <CircleAlert className="icone" size={15} aria-hidden="true" />
        Atrasado
      </h2>
      {mostrar.length === 0 ? (
        <p className="inicio__vazio">Nada atrasado.</p>
      ) : (
        <ul className="inicio__lista">
          {mostrar.map((e) => (
            <li key={e.id}>
              <span className="inicio__titulo-item">
                <IconeTipo evento={e} />
                {e.titulo}
              </span>
              <span className="inicio__detalhe">
                {[e.materiaId && nomes.get(e.materiaId), textoPrazo(e.dias)].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {atrasados.length > mostrar.length && (
        <a className="link-icone inicio__mais" href={paraHash({ tela: 'agenda' })}>
          Mais {atrasados.length - mostrar.length} na agenda
          <ArrowRight className="icone" size={16} />
        </a>
      )}
    </section>
  )
}

function ProximosPrazos({ prazos, nomes }: PropsLista & { prazos: EventoNaAgenda[] }) {
  const mostrar = prazos.slice(0, 3)
  return (
    <section className="vidro spot inicio__prazos" aria-labelledby="inicio-prazos">
      <h2 id="inicio-prazos" className="inicio__rotulo">
        <CalendarClock className="icone" size={15} aria-hidden="true" />
        Próximos prazos
      </h2>
      {mostrar.length === 0 ? (
        <p className="inicio__vazio">Nenhum prazo pela frente.</p>
      ) : (
        <ul className="inicio__lista">
          {mostrar.map((e) => (
            <li key={e.id}>
              <span className="inicio__quando">{textoPrazo(e.dias)}</span>
              <span className="inicio__titulo-item">
                <IconeTipo evento={e} />
                {comMateria(e, nomes)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <a className="link-icone inicio__mais" href={paraHash({ tela: 'agenda' })}>
        Ver a agenda
        <ArrowRight className="icone" size={16} />
      </a>
    </section>
  )
}

/** Painel sem nada cadastrado: a apresentação, com os dois jeitos de começar. */
function InicioVazio() {
  const { verExemplo, podeVerExemplo } = useVerExemplo()
  return (
    <section className="inicio inicio--vazio" aria-labelledby={ID_TITULO_TELA}>
      <h1 id={ID_TITULO_TELA} tabIndex={-1} className="inicio__frase">
        <span>Coursebook. </span>
        <strong>Notas, faltas e prazos do semestre</strong>
        <span> num lugar só.</span>
      </h1>
      <div className="vidro spot inicio__apresentacao">
        <ol className="inicio__destaques">
          {DESTAQUES.map((texto, i) => (
            <li key={texto}>
              <span className="inicio__numero" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              {texto}
            </li>
          ))}
        </ol>
        <div className="inicio__botoes">
          <a className="botao botao--vivo" href={paraHash({ tela: 'nova-materia' })}>
            <Plus className="icone" size={16} />
            Cadastrar a primeira matéria
          </a>
          <button type="button" className="botao botao--fantasma" onClick={verExemplo} disabled={!podeVerExemplo}>
            <Eye className="icone" size={16} />
            Ver com dados de exemplo
          </button>
        </div>
        <a href={GITHUB} className="link-icone inicio__codigo" target="_blank" rel="noreferrer">
          <CodeXml className="icone" size={16} />
          Ver o código no GitHub
        </a>
      </div>
    </section>
  )
}
