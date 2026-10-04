import { Copy, KeyRound } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { LIMITES, ROTAS, type ChaveAcesso, type RespostaChaveCriada } from '../api/contrato'
import { BotaoRemover } from '../componentes/BotaoRemover'
import type { ErroCampo } from '../telas/novaMateriaUtil'
import { Rotulado } from '../telas/Rotulado'
import { useNuvem, type Nuvem } from './contexto'
import './nuvem.css'

const ID_TITULO = 'chaves-titulo'
const ID_NOME = 'chaves-nome'

/** "04/10/2026 às 12:00", no horário do aparelho. */
function formatarMomento(iso: string): string {
  const d = new Date(iso)
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} às ${dois(d.getHours())}:${dois(d.getMinutes())}`
}

type Lista = { tipo: 'carregando' } | { tipo: 'erro'; mensagem: string } | { tipo: 'pronta'; chaves: ChaveAcesso[] }

/**
 * "Chaves de acesso" na tela Dados: para um programa da própria pessoa (o bot do
 * Telegram) ler os prazos sem a senha. Só aparece com a conta conectada.
 */
export function SecaoChaves() {
  const nuvem = useNuvem()
  if (!nuvem?.conta || nuvem.situacao.tipo === 'sem-sessao') return null
  // key: trocar de conta começa do zero (sem a lista nem o token da outra).
  return <Chaves key={nuvem.conta.email} nuvem={nuvem} />
}

function Chaves({ nuvem }: { nuvem: Nuvem }) {
  const [lista, setLista] = useState<Lista>({ tipo: 'carregando' })
  const [nome, setNome] = useState('')
  const [erroNome, setErroNome] = useState<ErroCampo | null>(null)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [criada, setCriada] = useState<RespostaChaveCriada | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const titulo = useRef<HTMLHeadingElement>(null)
  const geral = useRef<HTMLParagraphElement>(null)
  const caixaToken = useRef<HTMLDivElement>(null)
  // O nuvem muda a cada troca da situação; a lista só precisa ser lida ao abrir.
  const { listarChaves } = nuvem
  const listar = useRef(listarChaves)

  useEffect(() => {
    let vivo = true
    void listar.current().then((r) => {
      if (!vivo) return
      setLista(r.ok ? { tipo: 'pronta', chaves: r.valor.chaves } : { tipo: 'erro', mensagem: r.erro.erro })
    })
    return () => {
      vivo = false
    }
  }, [])

  const chaves = lista.tipo === 'pronta' ? lista.chaves : []
  const noLimite = chaves.length >= LIMITES.chavesPorConta

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (enviando) return
    const limpo = nome.trim()
    if (limpo === '') {
      flushSync(() => setErroNome({ campo: ID_NOME, mensagem: 'Dê um nome à chave (ex.: "Bot do Telegram").' }))
      document.getElementById(ID_NOME)?.focus()
      return
    }
    flushSync(() => {
      setEnviando(true)
      setErroNome(null)
      setErroGeral(null)
    })
    const r = await nuvem.criarChave({ nome: limpo })
    if (!r.ok) {
      const noCampo = r.erro.codigo === 'pedido-invalido'
      flushSync(() => {
        setEnviando(false)
        if (noCampo) setErroNome({ campo: ID_NOME, mensagem: r.erro.erro })
        else setErroGeral(r.erro.erro)
      })
      if (noCampo) document.getElementById(ID_NOME)?.focus()
      else geral.current?.focus()
      return
    }
    flushSync(() => {
      setEnviando(false)
      setNome('')
      setCriada(r.valor)
      setAnuncio('')
      setLista((l) => (l.tipo === 'pronta' ? { tipo: 'pronta', chaves: [...l.chaves, r.valor.chave] } : l))
    })
    caixaToken.current?.focus()
  }

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(token)
      setAnuncio('Chave copiada.')
    } catch {
      setAnuncio('Não deu para copiar sozinho: selecione a chave e copie.')
    }
  }

  function fecharToken() {
    flushSync(() => {
      setCriada(null)
      setAnuncio('')
    })
    document.getElementById(ID_NOME)?.focus()
  }

  async function apagar(chave: ChaveAcesso) {
    setErroGeral(null)
    const r = await nuvem.apagarChave(chave.id)
    // Já apagada (em outro aparelho): some da lista do mesmo jeito.
    if (!r.ok && r.erro.codigo !== 'nao-encontrada') {
      flushSync(() => setErroGeral(r.erro.erro))
      geral.current?.focus()
      return
    }
    flushSync(() => {
      setLista((l) => (l.tipo === 'pronta' ? { tipo: 'pronta', chaves: l.chaves.filter((c) => c.id !== chave.id) } : l))
      if (criada?.chave.id === chave.id) setCriada(null)
      setAnuncio(`Chave "${chave.nome}" apagada. Ela não abre mais os prazos.`)
    })
    // O botão sumiu com a chave: o foco vai para o título da seção.
    titulo.current?.focus()
  }

  return (
    <section className="cartao dados__secao" aria-labelledby={ID_TITULO}>
      <h3 id={ID_TITULO} ref={titulo} tabIndex={-1} className="dados__subtitulo nuvem__titulo">
        Chaves de acesso
      </h3>
      <p className="dados__texto">
        Para um programa seu, como um bot do Telegram, avisar das provas e entregas sem precisar da sua senha. A chave
        só lê os prazos dos próximos dias: não muda nada no painel nem abre a conta.
      </p>

      {criada && (
        <div ref={caixaToken} tabIndex={-1} className="chaves__nova" role="group" aria-labelledby="chaves-nova">
          <p id="chaves-nova" className="chaves__nova-titulo">
            Chave "{criada.chave.nome}" criada
          </p>
          <p className="dados__texto dados__aviso">
            Copie agora: ela não aparece de novo. Quem tiver esta chave consegue ler os seus prazos; se ela vazar, apague
            e crie outra.
          </p>
          <code className="chaves__token">{criada.token}</code>
          <div className="dados__botoes">
            <button type="button" className="botao" onClick={() => void copiar(criada.token)}>
              <Copy className="icone" size={16} />
              Copiar chave
            </button>
            <button type="button" className="botao botao--fantasma" onClick={fecharToken}>
              Pronto, já guardei
            </button>
          </div>
          <p className="dados__nota muted">
            No programa, mande o cabeçalho <code>Authorization: Bearer {'<chave>'}</code> para{' '}
            <code>{ROTAS.prazos}?dias=7</code>.
          </p>
        </div>
      )}

      {lista.tipo === 'carregando' && <p className="muted dados__nota">Carregando as chaves...</p>}
      {lista.tipo === 'erro' && <p className="nuvem__erro">Não deu para carregar as chaves: {lista.mensagem}</p>}
      {lista.tipo === 'pronta' &&
        (chaves.length === 0 ? (
          <p className="muted dados__nota">Nenhuma chave criada.</p>
        ) : (
          <ul className="chaves__lista" aria-label="Chaves criadas">
            {chaves.map((chave) => (
              <li key={chave.id} className="chaves__item">
                <div className="chaves__dados">
                  <span className="chaves__nome">
                    <KeyRound className="icone" size={14} aria-hidden="true" />
                    {chave.nome}
                  </span>
                  <span className="muted chaves__datas">
                    Criada em {formatarMomento(chave.criadaEm)} ·{' '}
                    {chave.usadaEm ? `usada pela última vez em ${formatarMomento(chave.usadaEm)}` : 'nunca usada'}
                  </span>
                </div>
                <BotaoRemover nome={`a chave ${chave.nome}`} texto="Apagar" aoConfirmar={() => void apagar(chave)} />
              </li>
            ))}
          </ul>
        ))}

      {erroGeral && (
        <p ref={geral} role="alert" tabIndex={-1} className="nuvem__erro">
          {erroGeral}
        </p>
      )}

      {lista.tipo === 'pronta' && (
        <form className="nuvem__form" onSubmit={criar} noValidate aria-label="Criar chave de acesso">
          <Rotulado
            id={ID_NOME}
            rotulo="Nome da chave"
            dica={
              noLimite
                ? `Cada conta pode ter até ${LIMITES.chavesPorConta} chaves. Apague uma para criar outra.`
                : 'Para lembrar onde ela está em uso (ex.: "Bot do Telegram").'
            }
            erro={erroNome}
          >
            {(props) => (
              <input
                {...props}
                className="campo"
                autoComplete="off"
                maxLength={LIMITES.nomeChaveMaximo}
                disabled={noLimite}
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value)
                  setErroNome(null)
                }}
              />
            )}
          </Rotulado>
          <div className="dados__botoes">
            <button type="submit" className="botao" disabled={enviando || noLimite}>
              <KeyRound className="icone" size={16} />
              {enviando ? 'Criando...' : 'Criar chave'}
            </button>
          </div>
        </form>
      )}

      <p role="status" className="dados__status muted">
        {anuncio}
      </p>
    </section>
  )
}
