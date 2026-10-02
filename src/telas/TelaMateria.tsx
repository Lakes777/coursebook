import { ArrowLeft, Pencil } from 'lucide-react'
import { useRef } from 'react'
import { flushSync } from 'react-dom'
import { BotaoRemover } from '../componentes/BotaoRemover'
import { CabecalhoTela } from '../componentes/CabecalhoTela'
import { Selo } from '../componentes/Selo'
import { usePainel } from '../estado/contexto'
import { paraHash } from '../navegacao/rota'
import { plural, resumoMateria, textoFaltas, textoNota } from '../tema/textos'
import { tomFaltas, tomNota } from '../tema/tons'
import { SecaoExtras } from './materia/SecaoExtras'
import { SecaoFaltas } from './materia/SecaoFaltas'
import { SecaoNotas } from './materia/SecaoNotas'
import { explicacaoNota, textoHorarios, textoRegra } from './materiaUtil'
import './materia.css'

const LISTA = paraHash({ tela: 'materias' })

export function TelaMateria({ id }: { id: string }) {
  const { dados, despachar } = usePainel()
  const tituloRegra = useRef<HTMLHeadingElement>(null)
  const materia = dados.materias.find((m) => m.id === id)
  if (!materia) {
    return (
      <CabecalhoTela titulo="Matéria não encontrada">
        <p className="muted">
          Ela pode ter sido removida. <a href={LISTA}>Voltar para as matérias</a>
        </p>
      </CabecalhoTela>
    )
  }

  const { regra, nota, faltas } = resumoMateria(materia, dados.regraPadrao)
  const explicacao = explicacaoNota(nota, regra)
  const eventos = dados.eventos.filter((e) => e.materiaId === materia.id).length
  const detalhes = [
    materia.professor,
    materia.cargaHoraria > 0 && `${materia.cargaHoraria} aulas no semestre`,
    materia.horarios.length > 0 && textoHorarios(materia.horarios),
  ].filter(Boolean)

  function remover() {
    despachar({ tipo: 'materia/remover', materiaId: id })
    // A tela da lista recebe o foco no título (App), então nada se perde.
    window.location.hash = LISTA
  }

  function usarRegraPadrao() {
    // O botão some junto com a regra própria; o foco fica no título da seção.
    flushSync(() => despachar({ tipo: 'materia/editar', materiaId: id, campos: { regra: undefined } }))
    tituloRegra.current?.focus()
  }

  return (
    <CabecalhoTela titulo={materia.nome}>
      <p className="materia__voltar">
        <a className="link-icone" href={LISTA}>
          <ArrowLeft className="icone" size={14} aria-hidden="true" />
          Todas as matérias
        </a>
      </p>
      <div className="materia__topo">
        {detalhes.length > 0 && <p className="muted materia__detalhes">{detalhes.join(' · ')}</p>}
        <a className="botao botao--fantasma botao--pequeno" href={paraHash({ tela: 'editar-materia', id })}>
          <Pencil className="icone" size={14} />
          Editar matéria
        </a>
      </div>

      <div className="cartao materia__resumo">
        <div className="materia__selos">
          <Selo tom={tomNota(nota)}>{textoNota(nota)}</Selo>
          <Selo tom={tomFaltas(faltas.nivel)}>{textoFaltas(faltas)}</Selo>
        </div>
        {explicacao && <p className="materia__texto">{explicacao}</p>}
      </div>

      <div className="materia">
        <div className="materia__principal">
          <SecaoNotas materia={materia} regra={regra} situacao={nota} />
        </div>
        <div className="materia__lateral">
          <SecaoFaltas materia={materia} situacao={faltas} />
          <SecaoExtras materia={materia} />

          <section className="cartao materia__secao" aria-labelledby="secao-regra">
            <h3 id="secao-regra" ref={tituloRegra} tabIndex={-1} className="materia__subtitulo">
              Regra de aprovação
            </h3>
            <p className="materia__texto">
              {materia.regra ? 'Regra própria desta matéria.' : 'Regra padrão do painel (a da PUC-PR).'}
            </p>
            <ul className="materia__regra">
              {textoRegra(regra).map((linha) => (
                <li key={linha}>{linha}</li>
              ))}
            </ul>
            {materia.regra && (
              <button
                type="button"
                className="botao botao--fantasma botao--pequeno"
                onClick={usarRegraPadrao}
              >
                Usar a regra padrão
              </button>
            )}
          </section>

          <section className="cartao materia__secao materia__perigo" aria-labelledby="secao-remover">
            <h3 id="secao-remover" className="materia__subtitulo">
              Remover matéria
            </h3>
            <p className="materia__texto muted">
              Apaga as notas, as faltas e os pontos extras
              {eventos > 0 && `, e ${eventos} ${plural(eventos, 'evento', 'eventos')} dela na agenda`}. Não dá
              para desfazer.
            </p>
            <BotaoRemover nome={materia.nome} texto="Remover matéria" aoConfirmar={remover} />
          </section>
        </div>
      </div>
    </CabecalhoTela>
  )
}
