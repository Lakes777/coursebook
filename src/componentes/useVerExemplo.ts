import { flushSync } from 'react-dom'
import { usePainel } from '../estado/contexto'
import { dadosDeExemplo } from '../logica/exemplo'
import { mesclar } from '../logica/transferencia'
import { ID_TITULO_TELA } from './CabecalhoTela'

/**
 * A ação "Ver com dados de exemplo" das telas vazias (Matérias, Semana). Junta, e não
 * substitui: a lista pode estar vazia com eventos na agenda. O botão some com a lista
 * cheia; o foco vai para o título da tela. Sem poder salvar (dados ilegíveis, outra
 * aba), o exemplo pareceria guardado sem estar: aí o botão fica desativado.
 */
export function useVerExemplo(): { verExemplo: () => void; podeVerExemplo: boolean } {
  const { dados, despachar, podeSalvar } = usePainel()
  function verExemplo() {
    flushSync(() => despachar({ tipo: 'dados/substituir', dados: mesclar(dados, dadosDeExemplo()) }))
    document.getElementById(ID_TITULO_TELA)?.focus()
  }
  return { verExemplo, podeVerExemplo: podeSalvar }
}
