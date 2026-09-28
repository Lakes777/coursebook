import { GraduationCap } from 'lucide-react'
import { usePainel } from './estado/contexto'
import { ICONE_AVISO } from './tema/icones'

const { info: Info, atencao: Atencao, erro: Erro } = ICONE_AVISO

function App() {
  const { dados, aviso, fecharAviso, erroAoSalvar, podeSalvar, mudouEmOutraAba } = usePainel()
  return (
    <>
      <header className="topo">
        <div className="container topo__conteudo">
          <h1 className="topo__titulo">
            <GraduationCap className="icone" size={26} />
            Painel de estudos
          </h1>
        </div>
      </header>
      <main className="container conteudo">
        {aviso && (
          <div role="alert" className="aviso aviso--atencao">
            <Atencao className="icone" size={18} />
            <p className="aviso__texto">{aviso}</p>
            <button type="button" className="botao botao--fantasma botao--pequeno" onClick={fecharAviso}>
              Entendi
            </button>
          </div>
        )}
        {/* Fica sempre visível: sem ela, quem fecha o aviso não sabe que nada está sendo salvo. */}
        {mudouEmOutraAba ? (
          <p role="status" className="aviso aviso--atencao">
            <Info className="icone" size={18} />
            <span className="aviso__texto">
              O painel foi alterado em outra aba. Recarregue a página para ver os dados atuais; até lá, nada
              feito aqui será salvo.
            </span>
          </p>
        ) : (
          !podeSalvar && (
            <p role="status" className="aviso aviso--atencao">
              <Info className="icone" size={18} />
              <span className="aviso__texto">
                Nada está sendo salvo neste navegador. Exporte seus dados em JSON antes de fechar a página.
              </span>
            </p>
          )
        )}
        {erroAoSalvar && (
          <p role="alert" className="aviso aviso--perigo">
            <Erro className="icone" size={18} />
            <span className="aviso__texto">{erroAoSalvar}</span>
          </p>
        )}
        <p className="muted">
          {dados.materias.length === 0
            ? 'Matérias, notas, faltas e provas num lugar só.'
            : `${dados.materias.length} matéria(s) cadastrada(s).`}
        </p>
      </main>
    </>
  )
}

export default App
