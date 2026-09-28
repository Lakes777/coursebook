import { Eye, Plus } from 'lucide-react'
import { flushSync } from 'react-dom'
import { CabecalhoTela, ID_TITULO_TELA } from '../componentes/CabecalhoTela'
import { Selo } from '../componentes/Selo'
import { usePainel } from '../estado/contexto'
import { dadosDeExemplo } from '../logica/exemplo'
import { mesclar } from '../logica/transferencia'
import { paraHash } from '../navegacao/rota'
import { tomFaltas, tomNota } from '../tema/tons'
import { resumoMateria, textoFaltas, textoNota } from '../tema/textos'
import './materias.css'

const NOVA_MATERIA = paraHash({ tela: 'nova-materia' })

export function TelaMaterias() {
  const { dados, despachar, podeSalvar } = usePainel()
  const { materias, regraPadrao } = dados

  function verExemplo() {
    // Junta, e não substitui: a lista pode estar vazia com eventos na agenda.
    // O botão some com a lista cheia; o foco vai para o título da tela.
    flushSync(() => despachar({ tipo: 'dados/substituir', dados: mesclar(dados, dadosDeExemplo()) }))
    document.getElementById(ID_TITULO_TELA)?.focus()
  }

  return (
    <CabecalhoTela titulo="Matérias">
      {materias.length === 0 ? (
        <div className="cartao vazio">
          <p>
            Cadastre as matérias do semestre com os RAs e as avaliações de cada uma, como estão no plano de
            ensino. O painel calcula quanto falta para passar e acompanha as faltas.
          </p>
          <div className="vazio__botoes">
            <a className="botao" href={NOVA_MATERIA}>
              <Plus className="icone" size={16} />
              Cadastrar a primeira matéria
            </a>
            {/* Sem salvar (dados ilegíveis, outra aba), o exemplo pareceria guardado sem estar. */}
            <button type="button" className="botao botao--fantasma" onClick={verExemplo} disabled={!podeSalvar}>
              <Eye className="icone" size={16} />
              Ver com dados de exemplo
            </button>
          </div>
          <p className="vazio__alternativa">
            Tem um backup, ou quer que uma IA leia o plano de ensino?{' '}
            <a href={paraHash({ tela: 'dados' })}>Importe em Dados</a>. O exemplo pode ser apagado depois,
            também em Dados.
          </p>
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
