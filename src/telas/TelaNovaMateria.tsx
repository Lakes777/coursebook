import { useState } from 'react'
import { usePainel } from '../estado/contexto'
import { paraHash } from '../navegacao/rota'
import { navegar } from '../navegacao/useRota'
import { FormularioMateria } from './FormularioMateria'
import { formularioVazio, montarMateria } from './novaMateriaUtil'

export function TelaNovaMateria() {
  const { dados, despachar } = usePainel()
  const [inicial] = useState(() => formularioVazio(dados.regraPadrao))
  return (
    <FormularioMateria
      titulo="Nova matéria"
      introducao={
        'Tenha o plano de ensino da matéria por perto: os dados abaixo estão nele. Nada é salvo até o último passo.'
      }
      inicial={inicial}
      sair={paraHash({ tela: 'materias' })}
      montar={(form) => montarMateria(form)}
      salvar={(materia) => {
        despachar({ tipo: 'materia/adicionar', materia })
        navegar({ tela: 'materia', id: materia.id })
      }}
    />
  )
}
