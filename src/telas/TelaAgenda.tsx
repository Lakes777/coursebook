import { useEffect, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { BotaoRemover } from '../componentes/BotaoRemover'
import { CabecalhoTela, ID_TITULO_TELA } from '../componentes/CabecalhoTela'
import { Selo } from '../componentes/Selo'
import { usePainel } from '../estado/contexto'
import { formatarData, paraDataISO } from '../logica/datas'
import { agenda, NOMES_TIPO, textoPrazo, TIPOS_EVENTO, type EventoNaAgenda } from '../logica/eventos'
import { novoId } from '../logica/ids'
import type { Evento, TipoEvento } from '../logica/tipos'
import { ICONE_TIPO_EVENTO } from '../tema/icones'
import { textoSelo } from '../tema/textos'
import { tomPrazo } from '../tema/tons'
import { erroDoFormulario, type CampoEvento } from './agendaUtil'
import './agenda.css'

const ID_A_FAZER = 'agenda-a-fazer'
const ID_CONCLUIDOS = 'agenda-concluidos'

export function TelaAgenda() {
  const { dados, despachar } = usePainel()
  // "Hoje" é lido ao abrir a tela, e de novo quando a aba volta a ficar visível:
  // ler a hora a cada desenho faria a tela mudar sozinha, e só ao abrir deixaria a
  // aba esquecida de um dia para o outro mostrando "Amanhã" para a prova de hoje.
  const [hoje, setHoje] = useState(() => new Date())
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') setHoje(new Date())
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [])
  const itens = agenda(dados.eventos, hoje)
  const pendentes = itens.filter((e) => !e.concluido)
  const concluidos = itens.filter((e) => e.concluido)
  const nomeMateria = new Map(dados.materias.map((m) => [m.id, m.nome]))
  // Marcar como feito leva o item para a outra lista, e ele é montado de novo lá.
  // Guardar o id aqui deixa o item novo pegar o foco, em vez de o foco cair no começo da página.
  const focoPendente = useRef<string | null>(null)
  const tituloAFazer = useRef<HTMLHeadingElement>(null)
  const tituloConcluidos = useRef<HTMLHeadingElement>(null)

  /** O item recém-montado pergunta se é ele que deve pegar o foco (e só um pega). */
  function tomarFoco(id: string) {
    if (focoPendente.current !== id) return false
    focoPendente.current = null
    return true
  }

  function marcar(evento: EventoNaAgenda, concluido: boolean) {
    focoPendente.current = evento.id
    despachar({ tipo: 'evento/editar', eventoId: evento.id, campos: { concluido } })
  }

  function remover(evento: EventoNaAgenda) {
    // flushSync: o item some já, e o foco vai para um lugar que continua na tela,
    // o mais perto possível de onde estava: o título da parte do item, se ela
    // ainda existe; senão "A fazer"; senão (agenda vazia) o título da tela.
    flushSync(() => despachar({ tipo: 'evento/remover', eventoId: evento.id }))
    const daParte = evento.concluido ? tituloConcluidos.current : tituloAFazer.current
    ;(daParte ?? tituloAFazer.current ?? document.getElementById(ID_TITULO_TELA))?.focus()
  }

  const lista = (eventos: EventoNaAgenda[], idTitulo: string) => (
    <ul className="agenda__lista" aria-labelledby={idTitulo}>
      {eventos.map((evento) => (
        <ItemAgenda
          key={evento.id}
          evento={evento}
          materia={evento.materiaId ? nomeMateria.get(evento.materiaId) : undefined}
          tomarFoco={tomarFoco}
          aoMarcar={(concluido) => marcar(evento, concluido)}
          aoRemover={() => remover(evento)}
        />
      ))}
    </ul>
  )

  return (
    <CabecalhoTela titulo="Agenda">
      <div className="agenda">
        <div className="agenda__listas">
          {itens.length === 0 ? (
            <p className="cartao muted agenda__vazia">
              Nada na agenda ainda. Cadastre suas provas, trabalhos e apresentações, com a data e a matéria, para
              ver o que está chegando e o que já passou do prazo.
            </p>
          ) : (
            <>
              <h3 id={ID_A_FAZER} ref={tituloAFazer} tabIndex={-1} className="agenda__subtitulo">
                A fazer
              </h3>
              {pendentes.length > 0 ? (
                lista(pendentes, ID_A_FAZER)
              ) : (
                <p className="muted">Tudo feito por enquanto.</p>
              )}
              {concluidos.length > 0 && (
                <>
                  <h3 id={ID_CONCLUIDOS} ref={tituloConcluidos} tabIndex={-1} className="agenda__subtitulo">
                    Concluídos
                  </h3>
                  {lista(concluidos, ID_CONCLUIDOS)}
                </>
              )}
            </>
          )}
        </div>
        <FormNovoEvento />
      </div>
    </CabecalhoTela>
  )
}

interface PropsItem {
  evento: EventoNaAgenda
  materia: string | undefined
  tomarFoco: (id: string) => boolean
  aoMarcar: (concluido: boolean) => void
  aoRemover: () => void
}

function ItemAgenda({ evento, materia, tomarFoco, aoMarcar, aoRemover }: PropsItem) {
  const caixa = useRef<HTMLInputElement>(null)
  const Icone = ICONE_TIPO_EVENTO[evento.tipo]
  const selo = textoSelo(evento)

  useEffect(() => {
    if (tomarFoco(evento.id)) caixa.current?.focus()
    // Só ao montar: é quando o item chega na outra lista.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [])

  return (
    <li className={`cartao item-agenda item-agenda--${evento.destaque}`}>
      <div className="item-agenda__info">
        <p className="item-agenda__tipo">
          <Icone className="icone" size={16} />
          {NOMES_TIPO[evento.tipo]}
        </p>
        <p className="item-agenda__titulo">{evento.titulo}</p>
        {materia && <p className="item-agenda__materia muted">{materia}</p>}
        <p className="item-agenda__data">
          <time dateTime={evento.data}>{formatarData(evento.data)}</time> · {textoPrazo(evento.dias)}
        </p>
        {selo && <Selo tom={tomPrazo(evento.destaque)}>{selo}</Selo>}
      </div>
      <div className="item-agenda__acoes">
        <label className="item-agenda__feito">
          <input
            ref={caixa}
            type="checkbox"
            checked={evento.concluido}
            onChange={(e) => aoMarcar(e.target.checked)}
            aria-label={`Marcar ${evento.titulo} como feito`}
          />
          Feito
        </label>
        <BotaoRemover nome={evento.titulo} aoConfirmar={aoRemover} />
      </div>
    </li>
  )
}

const ID_ERRO = 'novo-evento-erro'

function FormNovoEvento() {
  const { dados, despachar } = usePainel()
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoEvento>('prova')
  // Começa em hoje: é mais perto da data certa do que um campo vazio.
  const [data, setData] = useState(() => paraDataISO(new Date()))
  const [materiaId, setMateriaId] = useState('')
  const [erro, setErro] = useState<{ campo: CampoEvento; mensagem: string } | null>(null)
  const [adicionado, setAdicionado] = useState('')
  const campoTitulo = useRef<HTMLInputElement>(null)
  const campoTipo = useRef<HTMLSelectElement>(null)
  const campoData = useRef<HTMLInputElement>(null)

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const evento: Evento = {
      id: novoId(),
      titulo: titulo.trim(),
      tipo,
      data,
      concluido: false,
      ...(materiaId ? { materiaId } : {}),
    }
    const problema = erroDoFormulario(evento)
    if (problema) {
      setErro(problema)
      setAdicionado('')
      const campos = { titulo: campoTitulo, tipo: campoTipo, data: campoData }
      campos[problema.campo].current?.focus()
      return
    }
    despachar({ tipo: 'evento/adicionar', evento })
    setTitulo('')
    setErro(null)
    setAdicionado(`Adicionado à agenda: ${evento.titulo}.`)
    campoTitulo.current?.focus()
  }

  /** Liga o campo à mensagem de erro, só quando o erro é dele. */
  const invalido = (campo: CampoEvento) =>
    erro?.campo === campo ? { 'aria-invalid': true, 'aria-describedby': ID_ERRO } : {}
  const mensagem = (campo: CampoEvento) =>
    erro?.campo === campo && (
      <p id={ID_ERRO} className="agenda-form__erro">
        {erro.mensagem}
      </p>
    )
  // Mexer no campo com erro tira a mensagem: ela descrevia o valor antigo.
  const limparErro = (campo: CampoEvento) => {
    if (erro?.campo === campo) setErro(null)
  }

  return (
    <form className="cartao agenda-form" onSubmit={enviar} noValidate aria-labelledby="novo-evento-titulo">
      <h3 id="novo-evento-titulo" className="agenda__subtitulo">
        Novo evento
      </h3>
      <div className="agenda-form__campo">
        <label htmlFor="novo-evento-nome">Título</label>
        <input
          id="novo-evento-nome"
          ref={campoTitulo}
          className="campo"
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value)
            limparErro('titulo')
            // O aviso falava do evento anterior; limpar faz o próximo ser anunciado,
            // mesmo que tenha o mesmo título.
            setAdicionado('')
          }}
          {...invalido('titulo')}
        />
        {mensagem('titulo')}
      </div>
      <div className="agenda-form__campo">
        <label htmlFor="novo-evento-tipo">Tipo</label>
        <select
          id="novo-evento-tipo"
          ref={campoTipo}
          className="campo"
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as TipoEvento)
            limparErro('tipo')
          }}
          {...invalido('tipo')}
        >
          {TIPOS_EVENTO.map((t) => (
            <option key={t} value={t}>
              {NOMES_TIPO[t]}
            </option>
          ))}
        </select>
        {mensagem('tipo')}
      </div>
      <div className="agenda-form__campo">
        <label htmlFor="novo-evento-data">Data</label>
        <input
          id="novo-evento-data"
          ref={campoData}
          type="date"
          className="campo"
          value={data}
          onChange={(e) => {
            setData(e.target.value)
            limparErro('data')
          }}
          {...invalido('data')}
        />
        {mensagem('data')}
      </div>
      <div className="agenda-form__campo">
        <label htmlFor="novo-evento-materia">Matéria</label>
        <select
          id="novo-evento-materia"
          className="campo"
          value={materiaId}
          onChange={(e) => setMateriaId(e.target.value)}
        >
          <option value="">Sem matéria</option>
          {dados.materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="botao">
        Adicionar
      </button>
      {/* Fica sempre na página: o leitor de tela só anuncia mudanças numa região que já existia. */}
      <p role="status" className="agenda-form__status muted">
        {adicionado}
      </p>
    </form>
  )
}
