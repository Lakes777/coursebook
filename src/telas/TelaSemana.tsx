import { Eye, Plus } from 'lucide-react'
import { CabecalhoTela } from '../componentes/CabecalhoTela'
import { useHoje } from '../componentes/useHoje'
import { useVerExemplo } from '../componentes/useVerExemplo'
import { usePainel } from '../estado/contexto'
import { paraHash } from '../navegacao/rota'
import {
  faixaAula,
  gradeDaSemana,
  nomeAula,
  textoFaixa,
  type AulaNaGrade,
  type Grade,
  type LinhaDaGrade,
} from './semanaUtil'
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
            A grade da semana junta os horários de todas as matérias. Cadastre as matérias do semestre com os dias e
            horários das aulas para ver a semana aqui.
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
            Nenhuma matéria tem horário ainda. Para ver a grade, adicione os dias e horários das aulas ao editar cada
            matéria.
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
  const grade = gradeDaSemana(materias)
  return (
    <CabecalhoTela titulo="Semana">
      {grade.linhas.length > 0 && (
        <>
          <TabelaSemana grade={grade} diaDeHoje={diaDeHoje} />
          <ListaSemana grade={grade} diaDeHoje={diaDeHoje} />
        </>
      )}
      {grade.foraDaGrade.length > 0 && (
        <section className="cartao semana__fora" aria-labelledby="semana-fora">
          <h3 id="semana-fora" className="semana__nome">
            Fora da grade da PUC-PR
          </h3>
          <p className="muted">Estes horários não batem com nenhuma aula da tabela (1ª a 20ª aula).</p>
          <ul>
            {grade.foraDaGrade.map((a, i) => (
              <li key={`${a.materiaId}-${i}`}>
                {a.nomeDia}, {textoFaixa(a.horario)}:{' '}
                <a href={paraHash({ tela: 'materia', id: a.materiaId })}>{a.materia}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </CabecalhoTela>
  )
}

/** Nome e professor da matéria numa aula (uma célula pode ter duas, se o horário bater). */
function Materias({ aulas }: { aulas: AulaNaGrade[] }) {
  return aulas.map((a, i) => (
    <span key={`${a.materiaId}-${i}`} className="aula-semana">
      <a className="aula-semana__materia" href={paraHash({ tela: 'materia', id: a.materiaId })}>
        {a.materia}
      </a>
      {a.professor && <span className="aula-semana__professor muted">{a.professor}</span>}
    </span>
  ))
}

/** Tela larga: a grade do portal, com uma linha por aula e uma coluna por dia. */
function TabelaSemana({ grade, diaDeHoje }: { grade: Grade; diaDeHoje: number }) {
  return (
    <div className="grade-semana">
      <table className="grade-semana__tabela">
        <caption className="invisivel">Aulas da semana</caption>
        <thead>
          <tr>
            <td />
            {grade.dias.map((d) => (
              <th
                key={d.dia}
                scope="col"
                aria-current={d.dia === diaDeHoje ? 'date' : undefined}
                className={d.dia === diaDeHoje ? 'grade-semana__hoje' : undefined}
              >
                {d.nome}
                {d.dia === diaDeHoje && <RotuloHoje />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grade.linhas.map((linha) =>
            linha.tipo === 'vazio' ? (
              <tr key={`vazio-${linha.de}`} className="grade-semana__vazia">
                <td colSpan={grade.dias.length + 1}>
                  Sem aulas das {linha.de} às {linha.ate}
                </td>
              </tr>
            ) : (
              <tr key={linha.aula.numero}>
                <th scope="row">
                  {/* O grid fica num span: no próprio <th>, ele deixaria de ser célula e a borda sairia torta. */}
                  <span className="grade-semana__aula">
                    <span className="grade-semana__numero">{nomeAula(linha.aula)}</span>
                    <span className="grade-semana__faixa">{faixaAula(linha.aula)}</span>
                  </span>
                </th>
                {linha.celulas.map((aulas, j) => (
                  <td
                    key={grade.dias[j].dia}
                    className={grade.dias[j].dia === diaDeHoje ? 'grade-semana__hoje' : undefined}
                  >
                    <Materias aulas={aulas} />
                  </td>
                ))}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

/** Celular: um dia embaixo do outro, com uma linha por aula. */
function ListaSemana({ grade, diaDeHoje }: { grade: Grade; diaDeHoje: number }) {
  return (
    <div className="semana-lista">
      {grade.dias.map((d, j) => {
        const aulas = grade.linhas.filter((l): l is LinhaDaGrade => l.tipo === 'aula' && l.celulas[j].length > 0)
        const ehHoje = d.dia === diaDeHoje
        const idTitulo = `semana-dia-${d.dia}`
        return (
          <section
            key={d.dia}
            aria-labelledby={idTitulo}
            aria-current={ehHoje ? 'date' : undefined}
            className={`cartao semana__dia${ehHoje ? ' semana__dia--hoje' : ''}`}
          >
            <h3 id={idTitulo} className="semana__nome">
              {d.nome}
              {ehHoje && <RotuloHoje />}
            </h3>
            {aulas.length === 0 ? (
              <p className="muted semana__sem-aulas">Sem aulas</p>
            ) : (
              <ul className="semana__aulas" aria-labelledby={idTitulo}>
                {aulas.map(({ aula, celulas }) => (
                  <li key={aula.numero} className="semana__linha">
                    <span className="grade-semana__aula">
                      <span className="grade-semana__numero">{nomeAula(aula)}</span>
                      <span className="grade-semana__faixa">{faixaAula(aula)}</span>
                    </span>
                    <span>
                      <Materias aulas={celulas[j]} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function RotuloHoje() {
  return (
    <>
      {/* O rótulo visível fica fora do nome; o leitor ouve "Quinta-feira, hoje". */}
      <span className="invisivel">, hoje</span>
      <span aria-hidden="true" className="semana__hoje">
        Hoje
      </span>
    </>
  )
}
