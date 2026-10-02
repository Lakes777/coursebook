import { useId, useState } from 'react'
import { Selo } from '../../componentes/Selo'
import { usePainel } from '../../estado/contexto'
import { formatarData } from '../../logica/datas'
import { extrasPorRA, NOTA_MAXIMA, notaRA, pontosDoRA, type SituacaoNota } from '../../logica/notas'
import { formatarNota, formatarPorcentagem } from '../../logica/numeros'
import type { Avaliacao, Materia, RegraAprovacao, ResultadoAprendizagem } from '../../logica/tipos'
import { dicaAvaliacao, fracaoDoRA } from '../materiaUtil'
import { CampoNota } from './CampoNota'

interface Props {
  materia: Materia
  regra: RegraAprovacao
  situacao: SituacaoNota
}

export function SecaoNotas({ materia, regra, situacao }: Props) {
  const { despachar } = usePainel()
  // Diz o que acabou de ser salvo: sem isto, quem usa leitor de tela sai do campo sem saber.
  const [salvo, setSalvo] = useState('')
  const extras = extrasPorRA(materia.ras, materia.pontosExtras)

  function salvarNota(ra: ResultadoAprendizagem, avaliacao: Avaliacao, nota: number | null) {
    despachar({
      tipo: 'avaliacao/editar',
      materiaId: materia.id,
      raId: ra.id,
      avaliacaoId: avaliacao.id,
      campos: { nota },
    })
    setSalvo(nota === null ? `Nota de ${avaliacao.nome} apagada.` : `Nota de ${avaliacao.nome} salva: ${formatarNota(nota)}.`)
  }

  function salvarRecuperacao(ra: ResultadoAprendizagem, nota: number | null) {
    despachar({ tipo: 'ra/editar', materiaId: materia.id, raId: ra.id, campos: { notaRecuperacao: nota } })
    setSalvo(
      nota === null
        ? `Recuperação de ${ra.nome} apagada.`
        : `Recuperação de ${ra.nome} salva: ${formatarNota(nota)}.`,
    )
  }

  return (
    <section className="cartao materia__secao materia__notas" aria-labelledby="secao-notas">
      <h3 id="secao-notas" className="materia__subtitulo">
        Notas
      </h3>
      {materia.ras.length === 0 ? (
        <p className="muted materia__texto">Esta matéria não tem RAs cadastrados.</p>
      ) : (
        <div className="lista-ras">
          {materia.ras.map((ra) => (
            <CartaoRA
              key={ra.id}
              ra={ra}
              fracao={fracaoDoRA(ra, materia.ras)}
              regra={regra}
              situacao={situacao}
              extra={extras[ra.id] ?? 0}
              pontosExtras={pontosDoRA(ra.id, materia.pontosExtras)}
              aoSalvarNota={(avaliacao, nota) => salvarNota(ra, avaliacao, nota)}
              aoSalvarRecuperacao={(nota) => salvarRecuperacao(ra, nota)}
            />
          ))}
        </div>
      )}
      <p role="status" className="invisivel">
        {salvo}
      </p>
    </section>
  )
}

interface PropsRA {
  ra: ResultadoAprendizagem
  fracao: number
  regra: RegraAprovacao
  situacao: SituacaoNota
  /** Os pontos extras do RA já de 0 a 10 (para a conta) e como foram dados (para mostrar). */
  extra: number
  pontosExtras: number
  aoSalvarNota: (avaliacao: Avaliacao, nota: number | null) => void
  aoSalvarRecuperacao: (nota: number | null) => void
}

function CartaoRA({ ra, fracao, regra, situacao, extra, pontosExtras, aoSalvarNota, aoSalvarRecuperacao }: PropsRA) {
  const nota = notaRA(ra, regra, extra)
  const rec = regra.recuperacao
  const precisaRecuperar = situacao.tipo === 'recuperacao' && situacao.ras.includes(ra.id)
  // Com a recuperação lançada, o RA está fechado: as avaliações sem nota contam 0 e não há o que pedir.
  // RA de peso 0 também não pede nada: ele não entra na nota final.
  const fechado = rec !== undefined && ra.notaRecuperacao !== null
  const semDica = fechado || fracao === 0
  const mostrarRecuperacao = rec !== undefined && (ra.recuperacaoNoSemestre || fechado || precisaRecuperar)
  // Gerado: o id do RA pode ter espaços (JSON importado), e aria-labelledby separa por espaço.
  const idTitulo = useId()
  const variasAvaliacoes = ra.avaliacoes.length > 1

  return (
    <section className="cartao ra" aria-labelledby={idTitulo}>
      <div className="ra__cabecalho">
        <h4 id={idTitulo} className="ra__nome">
          {ra.nome}
        </h4>
        <span className="muted ra__peso">
          {fracao > 0 ? `${formatarPorcentagem(fracao)} da nota final` : 'Não conta na nota final'}
        </span>
      </div>
      <p className="ra__nota">
        Nota do RA: <strong>{nota === null ? 'sem notas ainda' : formatarNota(nota)}</strong>
        {nota !== null && <span className="muted"> (de 10)</span>}
      </p>
      {pontosExtras > 0 && (
        <p className="muted ra__extras">
          {fracao === 0
            ? `Tem +${formatarNota(pontosExtras)} de pontos extras, mas este RA não conta na nota final.`
            : nota === null
              ? `Tem +${formatarNota(pontosExtras)} de pontos extras, que já contam na nota final.`
              : `Inclui +${formatarNota(pontosExtras)} de pontos extras.`}
        </p>
      )}
      {precisaRecuperar && <Selo tom="atencao">Precisa de recuperação</Selo>}

      {ra.avaliacoes.length === 0 ? (
        <p className="muted ra__vazio">Nenhuma avaliação cadastrada neste RA.</p>
      ) : (
        <ul className="avaliacoes" aria-label={`Avaliações de ${ra.nome}`}>
          {ra.avaliacoes.map((avaliacao) => {
            const detalhes = [
              avaliacao.data && formatarData(avaliacao.data),
              avaliacao.peso === 0 ? 'não conta na nota' : variasAvaliacoes && `peso ${formatarNota(avaliacao.peso)}`,
            ].filter(Boolean)
            return (
              <li key={avaliacao.id} className="avaliacao">
                <div className="avaliacao__info">
                  <p className="avaliacao__nome">{avaliacao.nome}</p>
                  {detalhes.length > 0 && <p className="muted avaliacao__detalhes">{detalhes.join(' · ')}</p>}
                </div>
                <CampoNota
                  rotulo={
                    <>
                      <span aria-hidden="true">Nota</span>
                      <span className="invisivel">Nota de {avaliacao.nome}</span>
                    </>
                  }
                  valor={avaliacao.nota}
                  maximo={avaliacao.valorMaximo}
                  dica={semDica ? undefined : dicaAvaliacao(avaliacao, situacao)}
                  aoSalvar={(n) => aoSalvarNota(avaliacao, n)}
                />
              </li>
            )
          })}
        </ul>
      )}

      {rec && mostrarRecuperacao && (
        <div className="ra__recuperacao">
          <CampoNota
            rotulo={
              <>
                <span aria-hidden="true">Recuperação</span>
                <span className="invisivel">Recuperação de {ra.nome}</span>
              </>
            }
            valor={ra.notaRecuperacao}
            maximo={NOTA_MAXIMA}
            dica={`Vale a maior entre ela e a nota do RA, até ${formatarNota(rec.teto)}.${
              ra.recuperacaoNoSemestre ? ' O plano prevê esta recuperação durante o semestre.' : ''
            }`}
            aoSalvar={aoSalvarRecuperacao}
          />
        </div>
      )}
    </section>
  )
}
