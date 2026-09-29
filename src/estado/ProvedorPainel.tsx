import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { CHAVE, releer, salvar, type Carregamento } from '../logica/armazenamento'
import { ContextoPainel, type Painel } from './contexto'
import { reduzirPainel, type EstadoPainel } from './desfazer'

interface Props {
  /** O resultado de carregar(), chamado UMA vez fora dos componentes (ver main.tsx). */
  inicial: Carregamento
  /** Onde salvar; os testes passam um falso. Sem ele, o localStorage. */
  armazenamento?: Pick<Storage, 'getItem' | 'setItem'>
  children: ReactNode
}

const comecar = (inicial: Carregamento): EstadoPainel => ({ dados: inicial.dados, desfazer: null })

export function ProvedorPainel({ inicial, armazenamento, children }: Props) {
  const [{ dados, desfazer }, despachar] = useReducer(reduzirPainel, inicial, comecar)
  const [aviso, setAviso] = useState(inicial.aviso)
  const [erroAoSalvar, setErroAoSalvar] = useState<string | null>(null)
  const [mudouEmOutraAba, setMudouEmOutraAba] = useState(false)
  // Cada aba grava o objeto inteiro: se a outra aba salvou algo que esta não
  // consegue ler, gravar daqui apagaria o que ela fez. Aí para de salvar.
  const podeSalvar = inicial.podeSalvar && !mudouEmOutraAba

  // Salva quando os dados ficam diferentes do que já está gravado (os iniciais
  // acabaram de ser lidos). Comparar com o último salvo, e não com os iniciais,
  // faz voltar ao começo (desfazer) também gravar.
  const ultimoSalvo = useRef(inicial.dados)
  useEffect(() => {
    if (!podeSalvar || dados === ultimoSalvo.current) return
    ultimoSalvo.current = dados
    // Efeito certo para isto: sincroniza com o localStorage (sistema externo) e só
    // guarda o resultado; quando continua null, o React nem redesenha.
    setErroAoSalvar(salvar(dados, armazenamento))
  }, [dados, podeSalvar, armazenamento])

  useEffect(() => {
    // O evento "storage" só chega nas OUTRAS abas; a que gravou não recebe.
    const aoMudar = (e: StorageEvent) => {
      if (e.key !== CHAVE && e.key !== null) return
      const novos = releer(armazenamento)
      if (!novos) {
        setMudouEmOutraAba(true)
        return
      }
      // Marca como já salvos ANTES de trocar: senão esta aba regravaria o que acabou
      // de ler, a outra receberia o evento e faria o mesmo, sem parar.
      ultimoSalvo.current = novos
      despachar({ tipo: 'sincronizar', dados: novos })
    }
    window.addEventListener('storage', aoMudar)
    return () => window.removeEventListener('storage', aoMudar)
  }, [armazenamento])

  const painel = useMemo<Painel>(
    () => ({
      dados,
      despachar,
      sincronizar: (novos) => despachar({ tipo: 'sincronizar', dados: novos }),
      desfazer,
      aoDesfazer: () => despachar({ tipo: 'desfazer' }),
      esquecerDesfazer: () => despachar({ tipo: 'desfazer/esquecer' }),
      aviso,
      fecharAviso: () => setAviso(null),
      erroAoSalvar,
      podeSalvar,
      mudouEmOutraAba,
    }),
    [dados, desfazer, aviso, erroAoSalvar, podeSalvar, mudouEmOutraAba],
  )
  return <ContextoPainel.Provider value={painel}>{children}</ContextoPainel.Provider>
}
