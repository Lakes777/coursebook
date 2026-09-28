import { usePainel } from './estado/contexto'

function App() {
  const { dados, aviso, fecharAviso, erroAoSalvar, podeSalvar, mudouEmOutraAba } = usePainel()
  return (
    <main>
      <h1>Painel de estudos</h1>
      {aviso && (
        <div role="alert" className="aviso">
          <p>{aviso}</p>
          <button type="button" onClick={fecharAviso}>
            Entendi
          </button>
        </div>
      )}
      {/* Fica sempre visível: sem ela, quem fecha o aviso não sabe que nada está sendo salvo. */}
      {mudouEmOutraAba ? (
        <p role="status" className="aviso">
          O painel foi alterado em outra aba. Recarregue a página para ver os dados atuais; até lá, nada
          feito aqui será salvo.
        </p>
      ) : (
        !podeSalvar && (
          <p role="status" className="aviso">
            Nada está sendo salvo neste navegador. Exporte seus dados em JSON antes de fechar a página.
          </p>
        )
      )}
      {erroAoSalvar && (
        <p role="alert" className="aviso">
          {erroAoSalvar}
        </p>
      )}
      <p>
        {dados.materias.length === 0
          ? 'Matérias, notas, faltas e provas num lugar só.'
          : `${dados.materias.length} matéria(s) cadastrada(s).`}
      </p>
    </main>
  )
}

export default App
