import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { CHAVE, salvar, type Carregamento } from '../logica/armazenamento'
import { ContextoPainel, type Painel } from './contexto'
import { reduzir } from './reduzir'

interface Props {
  /** O resultado de carregar(), chamado UMA vez fora dos componentes (ver main.tsx). */
  inicial: Carregamento
  /** Onde salvar; os testes passam um falso. Sem ele, o localStorage. */
  armazenamento?: Pick<Storage, 'getItem' | 'setItem'>
  children: ReactNode
}

export function ProvedorPainel({ inicial, armazenamento, children }: Props) {
  const [dados, despachar] = useReducer(reduzir, inicial.dados)
  const [aviso, setAviso] = useState(inicial.aviso)
  const [erroAoSalvar, setErroAoSalvar] = useState<string | null>(null)
  const [mudouEmOutraAba, setMudouEmOutraAba] = useState(false)
  // Cada aba grava o objeto inteiro: depois que outra aba salvou, gravar daqui
  // apagaria o que ela fez. Então para de salvar e pede para recarregar.
  const podeSalvar = inicial.podeSalvar && !mudouEmOutraAba

  useEffect(() => {
    // O evento "storage" só chega nas OUTRAS abas; a que gravou não recebe.
    const aoMudar = (e: StorageEvent) => {
      if (e.key === CHAVE || e.key === null) setMudouEmOutraAba(true)
    }
    window.addEventListener('storage', aoMudar)
    return () => window.removeEventListener('storage', aoMudar)
  }, [])

  // Salva quando os dados ficam diferentes do que já está gravado (os iniciais
  // acabaram de ser lidos). Comparar com o último salvo, e não com os iniciais,
  // faz voltar ao começo (desfazer) também gravar.
  const ultimoSalvo = useRef(inicial.dados)
  useEffect(() => {
    if (!podeSalvar || dados === ultimoSalvo.current) return
    ultimoSalvo.current = dados
    // Efeito certo para isto: sincroniza com o localStorage (sistema externo) e só
    // guarda o resultado; quando continua null, o React nem redesenha.
    // oxlint-disable-next-line react/set-state-in-effect
    setErroAoSalvar(salvar(dados, armazenamento))
  }, [dados, podeSalvar, armazenamento])

  const painel = useMemo<Painel>(
    () => ({
      dados,
      despachar,
      aviso,
      fecharAviso: () => setAviso(null),
      erroAoSalvar,
      podeSalvar,
      mudouEmOutraAba,
    }),
    [dados, aviso, erroAoSalvar, podeSalvar, mudouEmOutraAba],
  )
  return <ContextoPainel.Provider value={painel}>{children}</ContextoPainel.Provider>
}
