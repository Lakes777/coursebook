import { useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { BotaoRemover } from '../../componentes/BotaoRemover'
import { usePainel } from '../../estado/contexto'
import { dataValida, formatarData } from '../../logica/datas'
import { novoId } from '../../logica/ids'
import { escalaRA, NOTA_MAXIMA, TAMANHO_MAXIMO_COMENTARIO } from '../../logica/notas'
import { formatarNota } from '../../logica/numeros'
import type { Materia, PontoExtra, ResultadoAprendizagem } from '../../logica/tipos'
import { erroDoPontoExtra, lerCampoNumero, type CampoPontoExtra, type ErroCampo } from '../materiaUtil'

const ID_TITULO = 'secao-extras'
/** Valor do seletor para os pontos que vão para a nota final (os RAs usam o id deles). */
const NOTA_FINAL = ''

/** "no RA2" ou "na nota final", para a lista e os anúncios. */
function destino(extra: PontoExtra, ras: ResultadoAprendizagem[]): string {
  if (extra.raId === undefined) return 'na nota final'
  const ra = ras.find((r) => r.id === extra.raId)
  return ra ? `no ${ra.nome}` : 'num RA removido'
}

export function SecaoExtras({ materia }: { materia: Materia }) {
  const { despachar } = usePainel()
  const [anuncio, setAnuncio] = useState('')
  const titulo = useRef<HTMLHeadingElement>(null)
  const extras = materia.pontosExtras

  function adicionar(extra: PontoExtra) {
    despachar({ tipo: 'pontoExtra/adicionar', materiaId: materia.id, pontoExtra: extra })
    setAnuncio(`Adicionados ${formatarNota(extra.pontos)} pontos extras ${destino(extra, materia.ras)}.`)
  }

  function remover(extra: PontoExtra) {
    flushSync(() => despachar({ tipo: 'pontoExtra/remover', materiaId: materia.id, pontoExtraId: extra.id }))
    setAnuncio(`Removidos ${formatarNota(extra.pontos)} pontos extras ${destino(extra, materia.ras)}.`)
    titulo.current?.focus()
  }

  return (
    <section className="cartao materia__secao" aria-labelledby={ID_TITULO}>
      <h3 id={ID_TITULO} ref={titulo} tabIndex={-1} className="materia__subtitulo">
        Pontos extras
      </h3>
      <p className="materia__texto">
        {extras.length === 0
          ? 'Nenhum ponto extra. Eles somam na nota do RA escolhido (ou na nota final), até a nota máxima.'
          : 'Somam na nota do RA escolhido (ou na nota final), até a nota máxima.'}
      </p>
      {extras.length > 0 && (
        <ul className="lista-simples" aria-label="Pontos extras lançados">
          {extras.map((extra) => (
            <li key={extra.id} className="lista-simples__item">
              <span className="lista-simples__texto">
                <strong>
                  +{formatarNota(extra.pontos)} {destino(extra, materia.ras)}
                </strong>{' '}
                · {extra.comentario}
                {extra.data && <span className="muted"> · {formatarData(extra.data)}</span>}
              </span>
              <BotaoRemover
                nome={`os ${formatarNota(extra.pontos)} pontos de ${extra.comentario}`}
                aoConfirmar={() => remover(extra)}
              />
            </li>
          ))}
        </ul>
      )}
      <FormExtra ras={materia.ras} aoAdicionar={adicionar} />
      <p role="status" className="invisivel">
        {anuncio}
      </p>
    </section>
  )
}

interface PropsForm {
  ras: ResultadoAprendizagem[]
  aoAdicionar: (extra: PontoExtra) => void
}

function FormExtra({ ras, aoAdicionar }: PropsForm) {
  // O RA vem primeiro: é o caso mais comum (a atividade extra vale para um RA).
  const [raId, setRaId] = useState(() => ras[0]?.id ?? NOTA_FINAL)
  const [pontos, setPontos] = useState('')
  const [comentario, setComentario] = useState('')
  const [data, setData] = useState('')
  const [erro, setErro] = useState<ErroCampo<CampoPontoExtra> | null>(null)
  const campoPontos = useRef<HTMLInputElement>(null)
  const campoComentario = useRef<HTMLInputElement>(null)
  // Se o RA escolhido sumiu (matéria editada), volta para a nota final.
  const ra = ras.find((r) => r.id === raId)
  const escala = ra ? escalaRA(ra) : NOTA_MAXIMA
  const textoEscala = ra
    ? `No ${ra.nome}, que vale ${formatarNota(escala)}.`
    : `Na nota final, de 0 a ${formatarNota(NOTA_MAXIMA)}.`

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const extra: PontoExtra = {
      id: novoId(),
      pontos: lerCampoNumero(pontos),
      comentario: comentario.trim(),
      ...(ra ? { raId: ra.id } : {}),
      // A data é opcional; uma incompleta no campo é ignorada em vez de travar o formulário.
      ...(dataValida(data) ? { data } : {}),
    }
    const problema = erroDoPontoExtra(extra, escala)
    if (problema) {
      setErro(problema)
      ;(problema.campo === 'pontos' ? campoPontos : campoComentario).current?.focus()
      return
    }
    setErro(null)
    aoAdicionar(extra)
    setPontos('')
    setComentario('')
    setData('')
    campoPontos.current?.focus()
  }

  const limparErro = (campo: CampoPontoExtra) => {
    if (erro?.campo === campo) setErro(null)
  }
  const restam = TAMANHO_MAXIMO_COMENTARIO - comentario.trim().length

  return (
    <form className="form-linha" onSubmit={enviar} noValidate aria-label="Adicionar pontos extras">
      <div className="form-linha__campo form-linha__campo--largo">
        <label htmlFor="extra-destino">Vale para</label>
        <select
          id="extra-destino"
          className="campo"
          value={ra ? raId : NOTA_FINAL}
          onChange={(e) => {
            setRaId(e.target.value)
            limparErro('pontos')
          }}
        >
          {ras.map((r) => (
            <option key={r.id} value={r.id}>
              {r.peso > 0 ? r.nome : `${r.nome} (não conta na nota final)`}
            </option>
          ))}
          <option value={NOTA_FINAL}>Nota final</option>
        </select>
      </div>
      <div className="form-linha__campo form-linha__campo--curto">
        <label htmlFor="extra-pontos">Pontos</label>
        <input
          id="extra-pontos"
          ref={campoPontos}
          className="campo"
          inputMode="decimal"
          autoComplete="off"
          value={pontos}
          onChange={(e) => {
            setPontos(e.target.value)
            limparErro('pontos')
          }}
          aria-invalid={erro?.campo === 'pontos' ? true : undefined}
          aria-describedby={erro?.campo === 'pontos' ? 'extra-escala extra-erro' : 'extra-escala'}
        />
      </div>
      <p id="extra-escala" className="form-linha__contador form-linha__escala">
        {textoEscala}
      </p>
      <div className="form-linha__campo form-linha__campo--largo">
        <label htmlFor="extra-comentario">De onde vieram</label>
        <input
          id="extra-comentario"
          ref={campoComentario}
          className="campo"
          placeholder="Ex.: lista de exercícios 3"
          value={comentario}
          onChange={(e) => {
            setComentario(e.target.value)
            limparErro('comentario')
          }}
          aria-describedby={erro?.campo === 'comentario' ? 'extra-erro extra-restam' : 'extra-restam'}
          aria-invalid={erro?.campo === 'comentario' ? true : undefined}
        />
        <p id="extra-restam" className={`form-linha__contador${restam < 0 ? ' form-linha__contador--passou' : ''}`}>
          {restam >= 0 ? `Restam ${restam} caracteres` : `Passou ${-restam} caracteres do limite`}
        </p>
      </div>
      <div className="form-linha__campo">
        <label htmlFor="extra-data">Data (opcional)</label>
        <input id="extra-data" type="date" className="campo" value={data} onChange={(e) => setData(e.target.value)} />
      </div>
      <button type="submit" className="botao botao--fantasma">
        Adicionar
      </button>
      {erro && (
        <p id="extra-erro" className="erro-campo form-linha__erro">
          {erro.mensagem}
        </p>
      )}
    </form>
  )
}
