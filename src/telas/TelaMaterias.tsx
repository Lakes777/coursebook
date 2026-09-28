import { Plus } from 'lucide-react'
import { CabecalhoTela } from '../componentes/CabecalhoTela'
import { Selo } from '../componentes/Selo'
import { usePainel } from '../estado/contexto'
import { paraHash } from '../navegacao/rota'
import { tomFaltas, tomNota } from '../tema/tons'
import { resumoMateria, textoFaltas, textoNota } from '../tema/textos'
import './materias.css'

const NOVA_MATERIA = paraHash({ tela: 'nova-materia' })

export function TelaMaterias() {
  const { dados } = usePainel()
  const { materias, regraPadrao } = dados

  return (
    <CabecalhoTela titulo="Matérias">
      {materias.length === 0 ? (
        <div className="cartao vazio">
          <p>
            Cadastre as matérias do semestre com os RAs e as avaliações de cada uma, como estão no plano de
            ensino. O painel calcula quanto falta para passar e acompanha as faltas.
          </p>
          <a className="botao" href={NOVA_MATERIA}>
            <Plus className="icone" size={16} />
            Cadastrar a primeira matéria
          </a>
        </div>
      ) : (
        <>
          <div className="barra-acoes">
            <a className="botao" href={NOVA_MATERIA}>
              <Plus className="icone" size={16} />
              Nova matéria
            </a>
          </div>
          <ul className="grade-materias">
            {materias.map((materia) => {
              const { nota, faltas } = resumoMateria(materia, regraPadrao)
              return (
                <li key={materia.id} className="cartao cartao-materia">
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
              )
            })}
          </ul>
        </>
      )}
    </CabecalhoTela>
  )
}
