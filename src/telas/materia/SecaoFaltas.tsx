import { UserX } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { BotaoRemover } from '../../componentes/BotaoRemover'
import { Selo } from '../../componentes/Selo'
import { useHoje } from '../../componentes/useHoje'
import { usePainel } from '../../estado/contexto'
import { formatarData, paraDataISO } from '../../logica/datas'
import { erroFalta, type SituacaoFaltas } from '../../logica/faltas'
import { aulasNoDia } from '../../logica/horarios'
import { novoId } from '../../logica/ids'
import { formatarPorcentagem } from '../../logica/numeros'
import type { DiaSemana, Falta, Materia } from '../../logica/tipos'
import { plural, textoFaltas } from '../../tema/textos'
import { tomFaltas } from '../../tema/tons'
import { erroDaFalta, faltasOrdenadas, lerCampoNumero, type ErroCampo, type CampoFalta } from '../materiaUtil'

interface Props {
  materia: Materia
  situacao: SituacaoFaltas
}

const ID_TITULO = 'secao-faltas'

/** "Pode faltar mais 5 aulas", ou o aviso de que chegou ou passou do limite. */
function textoRestantes(situacao: SituacaoFaltas): string | null {
  if (situacao.nivel === 'sem-carga-horaria') {
    return 'Sem a carga horária não dá para calcular o limite de faltas. Ela está no plano de ensino (em horas-aula).'
  }
  const { restantes } = situacao
  if (restantes > 0) return `Pode faltar mais ${restantes} ${plural(restantes, 'aula', 'aulas')}.`
  if (restantes === 0) return 'Chegou no limite: não pode faltar mais nenhuma aula.'
  return `Passou do limite em ${-restantes} ${plural(-restantes, 'aula', 'aulas')}.`
}

export function SecaoFaltas({ materia, situacao }: Props) {
  const { despachar } = usePainel()
  const [anuncio, setAnuncio] = useState('')
  const titulo = useRef<HTMLHeadingElement>(null)
  const hoje = useHoje()

  function adicionar(falta: Falta) {
    // Última garantia: uma falta que o carregamento recusaria impediria o painel de abrir os dados.
    if (erroFalta(falta) !== null) return
    despachar({ tipo: 'falta/adicionar', materiaId: materia.id, falta })
    const aulas = `${falta.quantidade} ${plural(falta.quantidade, 'aula', 'aulas')}`
    setAnuncio(`Falta lançada: ${aulas} em ${formatarData(falta.data)}.`)
  }

  function remover(falta: Falta) {
    // A linha some junto com o botão; o foco vai para o título da seção, que continua na tela.
    flushSync(() => despachar({ tipo: 'falta/remover', materiaId: materia.id, faltaId: falta.id }))
    setAnuncio(`Falta de ${formatarData(falta.data)} removida.`)
    titulo.current?.focus()
  }

  const restantes = textoRestantes(situacao)
  const faltas = faltasOrdenadas(materia.faltas)
  /** Aulas da matéria no dia da semana de `data`, pelos horários (0 se não tem aula). */
  const aulasDeHoje = (data: Date) => aulasNoDia(materia.horarios, data.getDay() as DiaSemana)
  const aulasHoje = aulasDeHoje(hoje)

  return (
    <section className="cartao materia__secao" aria-labelledby={ID_TITULO}>
      <h3 id={ID_TITULO} ref={titulo} tabIndex={-1} className="materia__subtitulo">
        Faltas
      </h3>
      <Selo tom={tomFaltas(situacao.nivel)}>{textoFaltas(situacao)}</Selo>
      <p className="materia__texto">
        {situacao.frequencia !== null && <>Frequência de {formatarPorcentagem(situacao.frequencia)}. </>}
        {restantes}
      </p>
      <p className="muted materia__nota-rodape">Cada aula de 45 minutos perdida é uma falta.</p>

      <button
        type="button"
        className="botao"
        // O mesmo "hoje" do texto do botão: o que está escrito é o que é lançado.
        onClick={() => adicionar({ id: novoId(), data: paraDataISO(hoje), quantidade: aulasHoje || 1 })}
        aria-describedby={aulasHoje === 0 ? 'faltas-sem-aula' : undefined}
      >
        <UserX className="icone" size={16} />
        {aulasHoje > 0 ? `Faltei hoje (${aulasHoje} ${plural(aulasHoje, 'aula', 'aulas')})` : 'Faltei hoje (1 aula)'}
      </button>
      {aulasHoje === 0 && (
        <p id="faltas-sem-aula" className="muted materia__nota-rodape">
          {materia.horarios.length === 0
            ? 'Com os horários da matéria cadastrados, o botão lança as aulas do dia de uma vez.'
            : 'Hoje não tem aula desta matéria pelos horários; para outro dia ou mais aulas, use o formulário abaixo.'}
        </p>
      )}

      <FormFalta aoAdicionar={adicionar} />

      {faltas.length > 0 && (
        <ul className="lista-simples" aria-label="Faltas lançadas">
          {faltas.map((falta) => {
            const aulas = `${falta.quantidade} ${plural(falta.quantidade, 'aula', 'aulas')}`
            return (
              <li key={falta.id} className="lista-simples__item">
                <span>
                  <time dateTime={falta.data}>{formatarData(falta.data)}</time>
                  <span className="muted"> · {aulas}</span>
                </span>
                <BotaoRemover nome={`a falta de ${formatarData(falta.data)}, ${aulas}`} aoConfirmar={() => remover(falta)} />
              </li>
            )
          })}
        </ul>
      )}
      {/* Visível: com várias aulas por clique, um toque duplo sem querer precisa ser notado (e removido). */}
      <p role="status" className="muted materia__nota-rodape">
        {anuncio}
      </p>
    </section>
  )
}

/** Falta em outro dia, ou mais de uma aula no mesmo dia. */
function FormFalta({ aoAdicionar }: { aoAdicionar: (falta: Falta) => void }) {
  const [data, setData] = useState(() => paraDataISO(new Date()))
  const [quantidade, setQuantidade] = useState('1')
  const [erro, setErro] = useState<ErroCampo<CampoFalta> | null>(null)
  const campoData = useRef<HTMLInputElement>(null)
  const campoQuantidade = useRef<HTMLInputElement>(null)

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const falta: Falta = { id: novoId(), data, quantidade: lerCampoNumero(quantidade) }
    const problema = erroDaFalta(falta)
    if (problema) {
      setErro(problema)
      ;(problema.campo === 'data' ? campoData : campoQuantidade).current?.focus()
      return
    }
    setErro(null)
    aoAdicionar(falta)
  }

  const invalido = (campo: CampoFalta) =>
    erro?.campo === campo ? { 'aria-invalid': true, 'aria-describedby': 'falta-erro' } : {}

  return (
    <form className="form-linha" onSubmit={enviar} noValidate aria-label="Lançar falta em outro dia">
      <div className="form-linha__campo">
        <label htmlFor="falta-data">Dia</label>
        <input
          id="falta-data"
          ref={campoData}
          type="date"
          className="campo"
          value={data}
          onChange={(e) => {
            setData(e.target.value)
            if (erro?.campo === 'data') setErro(null)
          }}
          {...invalido('data')}
        />
      </div>
      <div className="form-linha__campo form-linha__campo--curto">
        <label htmlFor="falta-quantidade">Aulas</label>
        <input
          id="falta-quantidade"
          ref={campoQuantidade}
          className="campo"
          inputMode="numeric"
          autoComplete="off"
          value={quantidade}
          onChange={(e) => {
            setQuantidade(e.target.value)
            if (erro?.campo === 'quantidade') setErro(null)
          }}
          {...invalido('quantidade')}
        />
      </div>
      <button type="submit" className="botao botao--fantasma">
        Lançar
      </button>
      {erro && (
        <p id="falta-erro" className="erro-campo form-linha__erro">
          {erro.mensagem}
        </p>
      )}
    </form>
  )
}
