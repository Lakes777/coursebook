import { useState } from 'react'
import { CabecalhoTela } from '../componentes/CabecalhoTela'
import { usePainel } from '../estado/contexto'
import type { Materia } from '../logica/tipos'
import { paraHash } from '../navegacao/rota'
import { navegar } from '../navegacao/useRota'
import { ICONE_AVISO } from '../tema/icones'
import { FormularioMateria } from './TelaNovaMateria'
import { aplicarEdicao, erroNotasNaEdicao, materiaParaForm, perdasDaEdicao } from './novaMateriaUtil'

const Atencao = ICONE_AVISO.atencao

export function TelaEditarMateria({ id }: { id: string }) {
  const { dados } = usePainel()
  const materia = dados.materias.find((m) => m.id === id)
  if (!materia) {
    return (
      <CabecalhoTela titulo="Matéria não encontrada">
        <p className="muted">
          Ela pode ter sido removida. <a href={paraHash({ tela: 'materias' })}>Voltar para as matérias</a>
        </p>
      </CabecalhoTela>
    )
  }
  return <EditarMateria materia={materia} />
}

/** Separado para o formulário começar uma vez só, com a matéria de quando a tela abriu. */
function EditarMateria({ materia }: { materia: Materia }) {
  const { dados, despachar } = usePainel()
  const [inicial] = useState(() => materiaParaForm(materia, dados.regraPadrao))
  const voltar = paraHash({ tela: 'materia', id: materia.id })

  return (
    <FormularioMateria
      titulo={`Editar ${materia.nome}`}
      introducao="As notas, as faltas e os pontos extras continuam como estão. Nada muda até o último passo."
      inicial={inicial}
      sair={voltar}
      montar={(form) => aplicarEdicao(materia, form)}
      conferirExtra={(form) => erroNotasNaEdicao(materia, form)}
      avisoRevisar={(form) => {
        const perdas = perdasDaEdicao(materia, form)
        if (perdas.length === 0) return null
        return (
          <div className="aviso aviso--atencao">
            <Atencao className="icone" size={18} />
            <div className="aviso__texto">
              <p className="nm-perdas__titulo">Ao salvar, estas notas serão apagadas:</p>
              <ul className="nm-perdas">
                {/* A posição como chave: duas "Nota 8,0 de Prova" iguais podem aparecer. */}
                {perdas.map((perda, i) => (
                  <li key={i}>{perda}</li>
                ))}
              </ul>
            </div>
          </div>
        )
      }}
      salvar={(editada) => {
        despachar({ tipo: 'materia/substituir', materia: editada })
        navegar({ tela: 'materia', id: editada.id })
      }}
    />
  )
}
