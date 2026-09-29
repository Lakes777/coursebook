import { Eye, Plus } from 'lucide-react'
import { CabecalhoTela } from '../componentes/CabecalhoTela'
import { useHoje } from '../componentes/useHoje'
import { useVerExemplo } from '../componentes/useVerExemplo'
import { usePainel } from '../estado/contexto'
import { paraHash } from '../navegacao/rota'
import { gradeDaSemana, textoAulas, textoFaixa, type DiaNaGrade } from './semanaUtil'
// As classes do estado vazio (.vazio, .vazio__botoes) são as da tela de matérias.
import './materias.css'
import './semana.css'

export function TelaSemana() {
  const { dados } = usePainel()
  const { verExemplo, podeVerExemplo } = useVerExemplo()
  const hoje = useHoje()
  const { materias } = dados

  if (materias.length === 0) {
    return (
      <CabecalhoTela titulo="Semana">
        <div className="cartao vazio">
          <p>
            A grade da semana junta os horários de todas as matérias. Cadastre as matérias do semestre com os
            dias e horários das aulas para ver a semana aqui.
          </p>
          <div className="vazio__botoes">
            <a className="botao" href={paraHash({ tela: 'nova-materia' })}>
              <Plus className="icone" size={16} />
              Cadastrar a primeira matéria
            </a>
            <button type="button" className="botao botao--fantasma" onClick={verExemplo} disabled={!podeVerExemplo}>
              <Eye className="icone" size={16} />
              Ver com dados de exemplo
            </button>
          </div>
        </div>
      </CabecalhoTela>
    )
  }

  if (materias.every((m) => m.horarios.length === 0)) {
    return (
      <CabecalhoTela titulo="Semana">
        <div className="cartao vazio">
          <p>
            Nenhuma matéria tem horário ainda. Para ver a grade, adicione os dias e horários das aulas ao editar
            cada matéria.
          </p>
          <ul className="semana__editar">
            {materias.map((m) => (
              <li key={m.id}>
                <a href={paraHash({ tela: 'editar-materia', id: m.id })}>Editar {m.nome}</a>
              </li>
            ))}
          </ul>
        </div>
      </CabecalhoTela>
    )
  }

  const diaDeHoje = hoje.getDay()
  return (
    <CabecalhoTela titulo="Semana">
      <div className="semana">
        {gradeDaSemana(materias).map((d) => (
          <DiaDaSemana key={d.dia} dia={d} ehHoje={d.dia === diaDeHoje} />
        ))}
      </div>
    </CabecalhoTela>
  )
}

function DiaDaSemana({ dia, ehHoje }: { dia: DiaNaGrade; ehHoje: boolean }) {
  const idTitulo = `semana-dia-${dia.dia}`
  return (
    <section
      aria-labelledby={idTitulo}
      aria-current={ehHoje ? 'date' : undefined}
      className={`cartao semana__dia${ehHoje ? ' semana__dia--hoje' : ''}`}
    >
      <h3 id={idTitulo} className="semana__nome">
        {dia.nome}
        {ehHoje && (
          <>
            {/* O rótulo visível fica fora do nome; o leitor ouve "Quinta-feira, hoje". */}
            <span className="invisivel">, hoje</span>
            <span aria-hidden="true" className="semana__hoje">
              Hoje
            </span>
          </>
        )}
      </h3>
      {dia.aulas.length === 0 ? (
        <p className="muted semana__sem-aulas">Sem aulas</p>
      ) : (
        <ul className="semana__aulas" aria-labelledby={idTitulo}>
          {dia.aulas.map(({ materiaId, materia, horario }, i) => {
            const aulas = textoAulas(horario)
            return (
              // A mesma matéria pode ter dois horários no mesmo dia (e no mesmo início, se o dado vier torto).
              <li key={`${materiaId}-${horario.inicio}-${i}`} className="aula-semana">
                <p className="aula-semana__hora">{textoFaixa(horario)}</p>
                <a className="aula-semana__materia" href={paraHash({ tela: 'materia', id: materiaId })}>
                  {materia}
                </a>
                {aulas && <p className="aula-semana__aulas muted">{aulas}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
