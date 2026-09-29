import { LogIn, LogOut, Trash2, UserPlus } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import type { RespostaErro } from '../api/contrato'
import { LIMITES } from '../api/contrato'
import { usePainel } from '../estado/contexto'
import { resumoDados } from '../logica/transferencia'
import type { ErroCampo } from '../telas/novaMateriaUtil'
import { Rotulado } from '../telas/Rotulado'
import type { ContaGuardada } from './conta'
import { useNuvem, type Nuvem } from './contexto'
import { campoDoErro, erroConta, textoSituacao, type FormConta, type IdsConta } from './formularios'
import type { Situacao } from './sincronizador'
import { ID_SECAO_NUVEM } from './SituacaoNuvem'
import './nuvem.css'

const IDS: IdsConta = { email: 'nuvem-email', senha: 'nuvem-senha', convite: 'nuvem-convite' }
const ID_SENHA_EXCLUIR = 'nuvem-excluir-senha'

/** O que a seção faz quando uma ação termina: anuncia e leva o foco para o título (o conteúdo trocou). */
type Concluir = (mensagem: string) => void

/** "Conta e nuvem" na tela Dados: entrar, criar conta, a situação, a pergunta do conflito, sair e excluir. */
export function SecaoNuvem() {
  const nuvem = useNuvem()
  const [anuncio, setAnuncio] = useState('')
  const titulo = useRef<HTMLHeadingElement>(null)
  if (!nuvem) return null

  const concluir: Concluir = (mensagem) => {
    flushSync(() => setAnuncio(mensagem))
    titulo.current?.focus()
  }

  return (
    <section className="cartao dados__secao" aria-labelledby={ID_SECAO_NUVEM}>
      <h3 id={ID_SECAO_NUVEM} ref={titulo} tabIndex={-1} className="dados__subtitulo nuvem__titulo">
        Conta e nuvem
      </h3>
      {nuvem.conta ? (
        <ComConta nuvem={nuvem} conta={nuvem.conta} concluir={concluir} />
      ) : (
        <SemConta nuvem={nuvem} concluir={concluir} />
      )}
      <p role="status" className="dados__status muted">
        {anuncio}
      </p>
    </section>
  )
}

function SemConta({ nuvem, concluir }: { nuvem: Nuvem; concluir: Concluir }) {
  const [cadastro, setCadastro] = useState(false)

  function alternar() {
    flushSync(() => setCadastro((c) => !c))
    document.getElementById(IDS.email)?.focus()
  }

  return (
    <>
      <p className="dados__texto">
        Guarde seus dados na nuvem para usar em mais de um aparelho. Sem conta, eles ficam só neste navegador.
      </p>
      {/* key: trocar entre entrar e criar conta começa sem os erros do outro formulário. */}
      <FormularioConta
        key={cadastro ? 'cadastro' : 'entrar'}
        nuvem={nuvem}
        cadastro={cadastro}
        email=""
        aoEntrar={(email) =>
          concluir(cadastro ? `Conta criada. Você entrou como ${email}.` : `Você entrou como ${email}.`)
        }
      />
      <p className="dados__nota muted">
        {cadastro ? 'Já tem conta? ' : 'Ainda não tem conta? '}
        <button type="button" className="nuvem__alternar" onClick={alternar}>
          {cadastro ? 'Entrar' : 'Criar conta'}
        </button>
      </p>
    </>
  )
}

interface PropsFormulario {
  nuvem: Nuvem
  cadastro: boolean
  /** O e-mail já preenchido. */
  email: string
  /**
   * "Entre de novo" com a sessão acabada: o e-mail não muda, para os dados e o pendente
   * desta conta não irem para outra. Quem quer outra conta sai primeiro.
   */
  emailFixo?: boolean
  aoEntrar: (email: string) => void
}

function FormularioConta({ nuvem, cadastro, email: emailInicial, emailFixo, aoEntrar }: PropsFormulario) {
  const [form, setForm] = useState<FormConta>({ email: emailInicial, senha: '', convite: '' })
  const [erro, setErro] = useState<ErroCampo | null>(null)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const geral = useRef<HTMLParagraphElement>(null)

  function mudar(campo: keyof FormConta, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }))
    // Mexer no campo com erro tira a mensagem: ela descrevia o valor antigo.
    if (erro?.campo === IDS[campo]) setErro(null)
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (enviando) return
    const problema = erroConta(form, IDS, cadastro)
    if (problema) {
      flushSync(() => {
        setErro(problema)
        setErroGeral(null)
      })
      document.getElementById(problema.campo)?.focus()
      return
    }
    flushSync(() => {
      setEnviando(true)
      setErro(null)
      setErroGeral(null)
    })
    const email = form.email.trim()
    const r = cadastro
      ? await nuvem.cadastrar({ email, senha: form.senha, convite: form.convite.trim() })
      : await nuvem.entrar({ email, senha: form.senha })
    if (!r) {
      aoEntrar(email)
      return
    }
    mostrarErro(r)
  }

  /** O erro da API vai no campo a que ele se refere; os outros (bloqueado, sem conexão...) ficam no geral. */
  function mostrarErro(r: RespostaErro) {
    const campo = campoDoErro(r.codigo)
    // Sem o campo do convite (entrar), o erro vai no geral.
    const id = campo && (campo !== 'convite' || cadastro) ? IDS[campo] : null
    flushSync(() => {
      setEnviando(false)
      if (id) setErro({ campo: id, mensagem: r.erro })
      else setErroGeral(r.erro)
    })
    if (id) document.getElementById(id)?.focus()
    else geral.current?.focus()
  }

  const nome = cadastro ? 'Criar conta' : 'Entrar'
  return (
    <form className="nuvem__form" onSubmit={enviar} noValidate aria-label={nome} aria-busy={enviando || undefined}>
      <Rotulado
        id={IDS.email}
        rotulo="E-mail"
        dica={emailFixo ? 'Para entrar com outra conta, use "Sair" primeiro.' : undefined}
        erro={erro}
      >
        {(props) => (
          <input
            {...props}
            className="campo"
            type="email"
            autoComplete="username"
            maxLength={LIMITES.emailMaximo}
            readOnly={emailFixo}
            value={form.email}
            onChange={(e) => mudar('email', e.target.value)}
          />
        )}
      </Rotulado>
      <Rotulado
        id={IDS.senha}
        rotulo="Senha"
        dica={cadastro ? `Pelo menos ${LIMITES.senhaMinima} caracteres.` : undefined}
        erro={erro}
      >
        {(props) => (
          <input
            {...props}
            className="campo"
            type="password"
            autoComplete={cadastro ? 'new-password' : 'current-password'}
            value={form.senha}
            onChange={(e) => mudar('senha', e.target.value)}
          />
        )}
      </Rotulado>
      {cadastro && (
        <Rotulado
          id={IDS.convite}
          rotulo="Código de convite"
          dica="Por enquanto, a nuvem é só para convidados."
          erro={erro}
        >
          {(props) => (
            <input
              {...props}
              className="campo"
              autoComplete="off"
              value={form.convite}
              onChange={(e) => mudar('convite', e.target.value)}
            />
          )}
        </Rotulado>
      )}
      {erroGeral && (
        <p ref={geral} role="alert" tabIndex={-1} className="nuvem__erro">
          {erroGeral}
        </p>
      )}
      <div className="dados__botoes">
        <button type="submit" className="botao" disabled={enviando}>
          {cadastro ? <UserPlus className="icone" size={16} /> : <LogIn className="icone" size={16} />}
          {enviando ? (cadastro ? 'Criando conta...' : 'Entrando...') : nome}
        </button>
      </div>
    </form>
  )
}

const EM_ATENCAO: ReadonlySet<Situacao['tipo']> = new Set(['sem-conexao', 'sem-sessao', 'conflito', 'erro', 'parado'])

type Confirmando = 'nada' | 'apagar' | 'excluir'

function ComConta({ nuvem, conta, concluir }: { nuvem: Nuvem; conta: ContaGuardada; concluir: Concluir }) {
  const { dados } = usePainel()
  const { situacao } = nuvem
  const [confirmando, setConfirmando] = useState<Confirmando>('nada')
  const [enviando, setEnviando] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [senha, setSenha] = useState('')
  const [erroSenha, setErroSenha] = useState<ErroCampo | null>(null)
  const geral = useRef<HTMLParagraphElement>(null)
  const botaoApagar = useRef<HTMLButtonElement>(null)
  const botaoExcluir = useRef<HTMLButtonElement>(null)
  const botaoCancelar = useRef<HTMLButtonElement>(null)

  function abrir(qual: Confirmando) {
    flushSync(() => {
      setConfirmando(qual)
      setErroGeral(null)
      setErroSenha(null)
      setSenha('')
    })
    if (qual === 'excluir') document.getElementById(ID_SENHA_EXCLUIR)?.focus()
    else botaoCancelar.current?.focus()
  }

  function cancelar() {
    const voltar = confirmando === 'excluir' ? botaoExcluir : botaoApagar
    flushSync(() => setConfirmando('nada'))
    voltar.current?.focus()
  }

  /** Roda a ação com os botões desativados; no erro, mostra no geral ou (senha errada) no campo. */
  async function executar(acao: () => Promise<RespostaErro | null>, sucesso: string) {
    flushSync(() => {
      setEnviando(true)
      setErroGeral(null)
      setErroSenha(null)
    })
    const erro = await acao()
    if (!erro) {
      // A conta some e esta parte da seção junto: quem anuncia e recebe o foco é a seção.
      concluir(sucesso)
      return
    }
    const naSenha = confirmando === 'excluir' && erro.codigo === 'credenciais'
    flushSync(() => {
      setEnviando(false)
      if (naSenha) setErroSenha({ campo: ID_SENHA_EXCLUIR, mensagem: erro.erro })
      else setErroGeral(erro.erro)
    })
    if (naSenha) document.getElementById(ID_SENHA_EXCLUIR)?.focus()
    else geral.current?.focus()
  }

  function excluir(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (enviando) return
    if (senha === '') {
      flushSync(() => setErroSenha({ campo: ID_SENHA_EXCLUIR, mensagem: 'Informe a senha para excluir a conta.' }))
      document.getElementById(ID_SENHA_EXCLUIR)?.focus()
      return
    }
    void executar(
      () => nuvem.excluirConta({ senha }),
      'Conta excluída, com os dados que estavam na nuvem. Os dados deste aparelho continuam aqui.',
    )
  }

  return (
    <>
      <p className="nuvem__conta">
        Conta: <strong>{conta.email}</strong>
      </p>
      <p className={`nuvem__situacao${EM_ATENCAO.has(situacao.tipo) ? ' nuvem__situacao--atencao' : ''}`}>
        {textoSituacao(situacao)}
      </p>

      {situacao.tipo === 'conflito' && <Pergunta nuvem={nuvem} conflito={situacao} concluir={concluir} />}

      {situacao.tipo === 'sem-sessao' && (
        <FormularioConta
          nuvem={nuvem}
          cadastro={false}
          email={conta.email}
          emailFixo
          aoEntrar={(email) => concluir(`Você entrou de novo como ${email}.`)}
        />
      )}

      {erroGeral && (
        <p ref={geral} role="alert" tabIndex={-1} className="nuvem__erro">
          {erroGeral}
        </p>
      )}

      {confirmando === 'nada' && (
        <div className="dados__botoes">
          <button
            type="button"
            className="botao botao--fantasma"
            disabled={enviando}
            onClick={() =>
              void executar(() => nuvem.sair(false), 'Você saiu da conta. Os dados continuam neste aparelho.')
            }
          >
            <LogOut className="icone" size={16} />
            Sair
          </button>
          <button
            ref={botaoApagar}
            type="button"
            className="botao botao--fantasma"
            disabled={enviando}
            onClick={() => abrir('apagar')}
          >
            Sair e apagar os dados deste aparelho
          </button>
          <button
            ref={botaoExcluir}
            type="button"
            className="botao botao--perigo"
            disabled={enviando}
            onClick={() => abrir('excluir')}
          >
            <Trash2 className="icone" size={16} />
            Excluir conta
          </button>
        </div>
      )}

      {confirmando === 'apagar' && (
        <div className="dados__confirmar">
          <p className="dados__texto">
            Para computador emprestado: sai da conta e apaga deste navegador tudo o que o painel guardou (hoje,{' '}
            {resumoDados(dados)}). Os dados na nuvem continuam na sua conta.
          </p>
          {conta.pendente && (
            <p className="dados__texto dados__aviso">
              Há mudanças feitas aqui que ainda não foram para a nuvem. Elas vão se perder.
            </p>
          )}
          <div className="dados__botoes">
            <button
              type="button"
              className="botao botao--perigo"
              disabled={enviando}
              onClick={() =>
                void executar(() => nuvem.sair(true), 'Você saiu da conta e os dados deste aparelho foram apagados.')
              }
            >
              Sair e apagar
            </button>
            <button ref={botaoCancelar} type="button" className="botao botao--fantasma" onClick={cancelar}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {confirmando === 'excluir' && (
        <form className="dados__confirmar nuvem__form" onSubmit={excluir} noValidate aria-label="Excluir conta">
          <p className="dados__texto">
            Isto apaga a conta e os dados guardados na nuvem, e não dá para desfazer. Os dados deste aparelho ficam
            aqui. Para confirmar, digite a senha.
          </p>
          <Rotulado id={ID_SENHA_EXCLUIR} rotulo="Senha" erro={erroSenha}>
            {(props) => (
              <input
                {...props}
                className="campo"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value)
                  setErroSenha(null)
                }}
              />
            )}
          </Rotulado>
          <div className="dados__botoes">
            <button type="submit" className="botao botao--perigo" disabled={enviando}>
              {enviando ? 'Excluindo...' : 'Excluir conta'}
            </button>
            <button type="button" className="botao botao--fantasma" onClick={cancelar}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </>
  )
}

interface PropsPergunta {
  nuvem: Nuvem
  conflito: Extract<Situacao, { tipo: 'conflito' }>
  concluir: Concluir
}

/** "Qual versão manter?" do conflito, ou "Esta conta já tem dados na nuvem." da primeira vez. */
function Pergunta({ nuvem, conflito, concluir }: PropsPergunta) {
  const { dados, podeSalvar } = usePainel()
  const { primeiraVez } = conflito
  const textos = primeiraVez
    ? {
        titulo: 'Esta conta já tem dados na nuvem.',
        nuvem: 'Usar os da nuvem',
        aparelho: 'Substituir pelos deste aparelho',
        explicacao:
          'Usar os da nuvem troca os dados deste aparelho pelos da conta (dá para desfazer logo em seguida). ' +
          'Substituir apaga o que está na nuvem e põe os deste aparelho no lugar.',
      }
    : {
        titulo: 'Os dados mudaram em outro aparelho e também aqui.',
        nuvem: 'Usar a da nuvem',
        aparelho: 'Manter a deste aparelho',
        explicacao:
          'Usar a da nuvem troca os dados deste aparelho (dá para desfazer logo em seguida). ' +
          'Manter a deste aparelho passa por cima da versão da nuvem.',
      }

  function escolher(escolha: 'nuvem' | 'aparelho') {
    nuvem.resolver(escolha)
    concluir(
      escolha === 'nuvem'
        ? 'Pronto: o painel está com os dados da nuvem.'
        : 'Enviando os dados deste aparelho para a nuvem.',
    )
  }

  return (
    <div className="nuvem__pergunta" role="group" aria-labelledby="nuvem-pergunta">
      <h4 id="nuvem-pergunta" className="nuvem__pergunta-titulo">
        {textos.titulo}
      </h4>
      <p className="dados__texto">
        Na nuvem: {resumoDados(conflito.dados)}. Neste aparelho: {resumoDados(dados)}.
      </p>
      <p className="dados__nota muted">{textos.explicacao}</p>
      <div className="dados__botoes">
        <button type="button" className="botao" disabled={!podeSalvar} onClick={() => escolher('nuvem')}>
          {textos.nuvem}
        </button>
        <button
          type="button"
          className="botao botao--fantasma"
          disabled={!podeSalvar}
          onClick={() => escolher('aparelho')}
        >
          {textos.aparelho}
        </button>
      </div>
    </div>
  )
}
