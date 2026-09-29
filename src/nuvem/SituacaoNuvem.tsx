import { Cloud, CloudAlert, CloudOff, CloudUpload, LogIn, type LucideIcon } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useNuvem } from './contexto'
import { TEXTO_CURTO } from './formularios'
import type { Situacao } from './sincronizador'
import './nuvem.css'

/** Id do título da seção "Conta e nuvem" na tela Dados: o link do topo leva até ele. */
export const ID_SECAO_NUVEM = 'dados-nuvem'

const ICONES: Record<Situacao['tipo'], LucideIcon> = {
  conferindo: CloudUpload,
  sincronizado: Cloud,
  salvando: CloudUpload,
  'sem-conexao': CloudOff,
  'sem-sessao': LogIn,
  conflito: CloudAlert,
  erro: CloudAlert,
  parado: CloudOff,
}

/** Situações em que a pessoa precisa fazer algo na tela Dados. */
const PEDE_ACAO: ReadonlySet<Situacao['tipo']> = new Set(['sem-sessao', 'conflito', 'erro'])

/** Situações que o leitor de tela anuncia; "Salvando..." e "Sincronizado" a cada mudança seriam barulho. */
const ANUNCIADAS: ReadonlySet<Situacao['tipo']> = new Set([...PEDE_ACAO, 'sem-conexao'])

/** Já na tela Dados, o hash não muda e o App não mexe no foco: leva até a seção. */
function irParaSecao(e: MouseEvent<HTMLAnchorElement>) {
  const secao = document.getElementById(ID_SECAO_NUVEM)
  if (!secao) return
  e.preventDefault()
  secao.focus()
  secao.scrollIntoView?.({ block: 'start' })
}

/** A situação da sincronização no topo, ao lado do título. Só aparece com conta. */
export function SituacaoNuvem() {
  const nuvem = useNuvem()
  if (!nuvem?.conta) return null
  const { tipo } = nuvem.situacao
  const Icone = ICONES[tipo]
  const texto = TEXTO_CURTO[tipo]
  const classe = `situacao-nuvem${PEDE_ACAO.has(tipo) || tipo === 'sem-conexao' ? ' situacao-nuvem--atencao' : ''}`
  const conteudo = (
    <>
      <Icone className="icone" size={16} aria-hidden="true" />
      {texto}
    </>
  )
  return (
    <>
      {PEDE_ACAO.has(tipo) ? (
        <a href="#/dados" className={classe} onClick={irParaSecao}>
          {conteudo}
        </a>
      ) : (
        <p className={classe}>{conteudo}</p>
      )}
      <p role="status" className="invisivel">
        {ANUNCIADAS.has(tipo) ? texto : ''}
      </p>
    </>
  )
}
