import { usePainel } from '../estado/contexto'
import { ICONE_AVISO } from '../tema/icones'

const { info: Info, atencao: Atencao, erro: Erro } = ICONE_AVISO

/** Avisos sobre os dados salvos, que valem para todas as telas. */
export function Avisos() {
  const { aviso, fecharAviso, erroAoSalvar, podeSalvar, mudouEmOutraAba } = usePainel()
  return (
    <>
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
            O painel foi alterado em outra aba. Recarregue a página para ver os dados atuais; até lá, nada feito
            aqui será salvo.
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
    </>
  )
}
