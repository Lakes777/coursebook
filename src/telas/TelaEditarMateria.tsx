import { useState } from 'react'
import { CabecalhoTela } from '../componentes/CabecalhoTela'
import { usePainel } from '../estado/contexto'
import { iguais } from '../logica/iguais'
import type { Materia } from '../logica/tipos'
import { paraHash } from '../navegacao/rota'
import { navegar } from '../navegacao/useRota'
import { ICONE_AVISO } from '../tema/icones'
import { FormularioMateria } from './FormularioMateria'
import { aplicarEdicao, erroNotasNaEdicao, materiaParaForm, perdasDaEdicao } from './novaMateriaUtil'

const Atencao = ICONE_AVISO.atencao

export function TelaEditarMateria({ id }: { id: string }) {
  const { dados } = usePainel()
  const atual = dados.materias.find((m) => m.id === id)
  // A matéria de quando a tela abriu: se outra aba removê-la com o formulário aberto,
  // o que foi digitado aqui não some junto.
  const [aberta] = useState(atual)
  if (!aberta) {
    return (
      <CabecalhoTela titulo="Matéria não encontrada">
        <p className="muted">
          Ela pode ter sido removida. <a href={paraHash({ tela: 'materias' })}>Voltar para as matérias</a>
        </p>
      </CabecalhoTela>
    )
  }
  return <EditarMateria aberta={aberta} atual={atual} />
}

/** O aviso de quando a matéria mudou ou sumiu em outra aba depois que o formulário abriu. */
function avisoOutraAba(aberta: Materia, atual: Materia | undefined): string | null {
  if (!atual) return 'Esta matéria foi removida em outra aba. Salvar aqui vai colocá-la de volta no painel.'
  // Comparar o conteúdo: a sincronização entre abas troca todos os objetos, mesmo os que não mudaram.
  if (!iguais(atual, aberta)) {
    return 'Esta matéria foi alterada em outra aba. Salvar aqui mantém as notas, faltas e pontos extras de agora, mas o nome, os horários, os RAs e a regra passam a ser os deste formulário.'
  }
  return null
}

/** Separado para o formulário começar uma vez só, com a matéria de quando a tela abriu. */
function EditarMateria({ aberta, atual }: { aberta: Materia; atual: Materia | undefined }) {
  const { dados, despachar } = usePainel()
  const [inicial] = useState(() => materiaParaForm(aberta, dados.regraPadrao))
  const materia = atual ?? aberta
  const voltar = paraHash({ tela: 'materia', id: materia.id })
  const outraAba = avisoOutraAba(aberta, atual)

  return (
    <FormularioMateria
      titulo={`Editar ${aberta.nome}`}
      introducao="As notas, as faltas e os pontos extras continuam como estão. Nada muda até o último passo."
      aviso={
        outraAba && (
          <p role="alert" className="aviso aviso--atencao">
            <Atencao className="icone" size={18} />
            <span className="aviso__texto">{outraAba}</span>
          </p>
        )
      }
      inicial={inicial}
      ignorarMateriaId={aberta.id}
      sair={atual ? voltar : paraHash({ tela: 'materias' })}
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
        // Removida em outra aba: substituir não acharia a matéria e não faria nada.
        despachar(atual ? { tipo: 'materia/substituir', materia: editada } : { tipo: 'materia/adicionar', materia: editada })
        navegar({ tela: 'materia', id: editada.id })
      }}
    />
  )
}
