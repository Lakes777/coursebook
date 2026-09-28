import { useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { BotaoRemover } from '../../componentes/BotaoRemover'
import { usePainel } from '../../estado/contexto'
import { dataValida, formatarData } from '../../logica/datas'
import { novoId } from '../../logica/ids'
import { TAMANHO_MAXIMO_COMENTARIO, totalPontosExtras } from '../../logica/notas'
import { formatarNota } from '../../logica/numeros'
import type { Materia, PontoExtra } from '../../logica/tipos'
import { erroDoPontoExtra, lerCampoNumero, type CampoPontoExtra, type ErroCampo } from '../materiaUtil'

const ID_TITULO = 'secao-extras'

export function SecaoExtras({ materia }: { materia: Materia }) {
  const { despachar } = usePainel()
  const [anuncio, setAnuncio] = useState('')
  const titulo = useRef<HTMLHeadingElement>(null)
  const extras = materia.pontosExtras
  const total = totalPontosExtras(extras)

  function adicionar(extra: PontoExtra) {
    despachar({ tipo: 'pontoExtra/adicionar', materiaId: materia.id, pontoExtra: extra })
    setAnuncio(`Adicionados ${formatarNota(extra.pontos)} pontos extras.`)
  }

  function remover(extra: PontoExtra) {
    flushSync(() => despachar({ tipo: 'pontoExtra/remover', materiaId: materia.id, pontoExtraId: extra.id }))
    setAnuncio(`Removidos ${formatarNota(extra.pontos)} pontos extras.`)
    titulo.current?.focus()
  }

  return (
    <section className="cartao materia__secao" aria-labelledby={ID_TITULO}>
      <h3 id={ID_TITULO} ref={titulo} tabIndex={-1} className="materia__subtitulo">
        Pontos extras
      </h3>
      <p className="materia__texto">
        {extras.length === 0
          ? 'Nenhum ponto extra. Eles somam na nota final (até 10).'
          : `Total de ${formatarNota(total)}, somado na nota final (até 10).`}
      </p>
      {extras.length > 0 && (
        <ul className="lista-simples" aria-label="Pontos extras lançados">
          {extras.map((extra) => (
            <li key={extra.id} className="lista-simples__item">
              <span className="lista-simples__texto">
                <strong>+{formatarNota(extra.pontos)}</strong> {extra.comentario}
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
      <FormExtra aoAdicionar={adicionar} />
      <p role="status" className="invisivel">
        {anuncio}
      </p>
    </section>
  )
}

function FormExtra({ aoAdicionar }: { aoAdicionar: (extra: PontoExtra) => void }) {
  const [pontos, setPontos] = useState('')
  const [comentario, setComentario] = useState('')
  const [data, setData] = useState('')
  const [erro, setErro] = useState<ErroCampo<CampoPontoExtra> | null>(null)
  const campoPontos = useRef<HTMLInputElement>(null)
  const campoComentario = useRef<HTMLInputElement>(null)

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const extra: PontoExtra = {
      id: novoId(),
      pontos: lerCampoNumero(pontos),
      comentario: comentario.trim(),
      // A data é opcional; uma incompleta no campo é ignorada em vez de travar o formulário.
      ...(dataValida(data) ? { data } : {}),
    }
    const problema = erroDoPontoExtra(extra)
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

  const invalido = (campo: CampoPontoExtra) =>
    erro?.campo === campo ? { 'aria-invalid': true, 'aria-describedby': 'extra-erro' } : {}
  const limparErro = (campo: CampoPontoExtra) => {
    if (erro?.campo === campo) setErro(null)
  }
  const restam = TAMANHO_MAXIMO_COMENTARIO - comentario.trim().length

  return (
    <form className="form-linha" onSubmit={enviar} noValidate aria-label="Adicionar pontos extras">
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
          {...invalido('pontos')}
        />
      </div>
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
