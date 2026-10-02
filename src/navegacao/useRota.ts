import { useEffect, useRef, useSyncExternalStore } from 'react'
import { lerRota, paraHash, type Rota } from './rota'

// O hash é "estado de fora do React": useSyncExternalStore lê ele e redesenha
// quando muda (clique num link, botão voltar), sem copiar para um useState.
//
// Um formulário preenchido pode BLOQUEAR a saída: aí a troca de tela não chega às
// telas; o hash volta para o de antes e quem bloqueou decide (pergunta "Sair sem
// salvar?" e, se a pessoa quiser, chama sairPara()).

const ouvintes = new Set<() => void>()
/** O hash que as telas estão mostrando (o último que não foi bloqueado). */
let hashAceito = ''
/** Quem está bloqueando: recebe o hash para onde a pessoa tentou ir. */
let bloqueio: ((destino: string) => void) | null = null
/** Hash liberado por navegar()/sairPara(): mudança pedida pelo próprio painel, não pela pessoa. */
let liberado: string | null = null
/**
 * Para onde ia o "voltar" bloqueado. Quando o hashchange chega, o navegador já está
 * na entrada anterior do histórico; o painel avança de novo (history.go(1)) em vez
 * de reescrever essa entrada, e, se a pessoa confirmar a saída, volta de verdade.
 */
let destinoDoHistorico: string | null = null

/** "#", "#/" e "" são todos o lobby ("#/materias/" e "#/materias", a lista): compara pela tela, não pelo texto. */
const normalizar = (hash: string) => paraHash(lerRota(hash))

function aceitar(hash: string) {
  liberado = null
  destinoDoHistorico = null
  hashAceito = hash
  ouvintes.forEach((avisar) => avisar())
}

function aoMudarHash() {
  const destino = window.location.hash
  // Inclui a volta para o formulário feita pelo history.go(1) abaixo.
  if (destino === hashAceito) return
  if (bloqueio && destino !== liberado) {
    // Limitação: um hash digitado na barra de endereço não tem entrada seguinte, então
    // o go(1) não faz nada; o endereço fica diferente da tela até a pessoa decidir.
    destinoDoHistorico = destino
    history.go(1)
    bloqueio(destino)
    return
  }
  aceitar(destino)
}

/**
 * Link do próprio painel ("#/agenda") clicado com a saída bloqueada: segura antes
 * de o navegador criar uma entrada no histórico (desfazer isso depois deixaria uma
 * entrada repetida, e o "voltar" pareceria não funcionar).
 */
function aoClicar(e: MouseEvent) {
  if (!bloqueio || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
  const link = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null
  const href = link?.getAttribute('href')
  if (href == null || link?.hasAttribute('target')) return
  const destino = normalizar(href)
  if (destino === normalizar(hashAceito)) return
  e.preventDefault()
  bloqueio(destino)
}

function assinar(avisar: () => void) {
  if (ouvintes.size === 0) {
    hashAceito = window.location.hash
    window.addEventListener('hashchange', aoMudarHash)
  }
  ouvintes.add(avisar)
  return () => {
    ouvintes.delete(avisar)
    if (ouvintes.size === 0) window.removeEventListener('hashchange', aoMudarHash)
  }
}

// Sem ninguém assinando (antes da 1ª tela), vale o endereço de verdade.
const lerHash = () => (ouvintes.size > 0 ? hashAceito : window.location.hash)

/** A tela atual, lida do endereço. */
export function useRota(): Rota {
  return lerRota(useSyncExternalStore(assinar, lerHash))
}

/** Vai para o hash sem passar pelo bloqueio (entra no histórico, então "voltar" funciona). */
export function sairPara(hash: string): void {
  if (hash === destinoDoHistorico && window.location.hash === hashAceito) {
    // A pessoa tinha apertado "voltar": volta de verdade, sem criar entrada nova.
    liberado = hash
    history.back()
    return
  }
  if (window.location.hash === hash) {
    // Já está no endereço (nenhum hashchange viria): só troca a tela.
    aceitar(hash)
    return
  }
  liberado = hash
  window.location.hash = hash
}

/**
 * Vai para outra tela. É o painel que pede (ex.: depois de salvar), então passa por
 * cima do bloqueio. Ir para a tela em que já está não faz nada: o hash não muda e o
 * navegador não avisa.
 */
export function navegar(rota: Rota): void {
  sairPara(paraHash(rota))
}

/**
 * Enquanto `ativo`, sair da tela pelas abas, por links ou pelo voltar do navegador
 * chama `aoTentarSair(destino)` em vez de trocar de tela. Um bloqueio por vez: é o
 * da tela aberta.
 */
export function useBloquearSaida(ativo: boolean, aoTentarSair: (destino: string) => void): void {
  // Guardado num ref: a função muda a cada desenho, e o bloqueio não precisa ser refeito por isso.
  const atual = useRef(aoTentarSair)
  useEffect(() => {
    atual.current = aoTentarSair
  })
  useEffect(() => {
    if (!ativo) return
    const esteBloqueio = (destino: string) => atual.current(destino)
    bloqueio = esteBloqueio
    // Fase de captura: vem antes do clique chegar ao link.
    document.addEventListener('click', aoClicar, true)
    return () => {
      if (bloqueio === esteBloqueio) bloqueio = null
      document.removeEventListener('click', aoClicar, true)
    }
  }, [ativo])
}
