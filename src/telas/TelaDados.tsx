import { Bot, Download, Eye, Pencil, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { CabecalhoTela } from '../componentes/CabecalhoTela'
import { usePainel } from '../estado/contexto'
import { dadosVazios } from '../logica/armazenamento'
import { dadosDeExemplo } from '../logica/exemplo'
import { INSTRUCOES_IA } from '../logica/instrucoesIA'
import { REGRA_PUCPR, type Dados } from '../logica/tipos'
import {
  TAMANHO_MAXIMO_IMPORTACAO,
  lerImportacao,
  mesclar,
  nomeArquivo,
  nomesRepetidos,
  resumoDados,
  textoExportacao,
  vazio,
} from '../logica/transferencia'
import type { Resultado } from '../logica/validacao'
import { plural } from '../tema/textos'
import { CamposRegra } from './CamposRegra'
import {
  erroRegra,
  idsRegra,
  montarRegra,
  regraParaForm,
  regrasIguais,
  textoRegra,
  type ErroCampo,
  type RegraForm,
} from './novaMateriaUtil'
import './dados.css'

export function TelaDados() {
  return (
    <CabecalhoTela titulo="Dados">
      <p className="muted dados__intro">
        Os dados ficam só neste navegador. Baixe um backup de vez em quando e antes de trocar de computador ou
        limpar o navegador.
      </p>
      <div className="dados">
        {/* Uma coluna com as partes curtas, para não sobrar buraco ao lado do "Importar", que é alto. */}
        <div className="dados__coluna">
          <SecaoExportar />
          <SecaoRecomecar />
          <SecaoRegra />
        </div>
        <SecaoImportar />
        <SecaoIA />
      </div>
    </CabecalhoTela>
  )
}

function SecaoExportar() {
  const { dados } = usePainel()
  const [anuncio, setAnuncio] = useState('')

  function baixar() {
    const nome = nomeArquivo(new Date())
    const url = URL.createObjectURL(new Blob([textoExportacao(dados)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = nome
    link.click()
    // O navegador já começou o download; a URL pode ser liberada depois.
    setTimeout(() => URL.revokeObjectURL(url), 0)
    setAnuncio(`Backup baixado: ${nome}.`)
  }

  return (
    <section className="cartao dados__secao" aria-labelledby="dados-exportar">
      <h3 id="dados-exportar" className="dados__subtitulo">
        Exportar
      </h3>
      <p className="dados__texto">
        Hoje o painel tem {resumoDados(dados)}. O arquivo guarda tudo: matérias, notas, faltas, pontos extras e
        agenda.
      </p>
      <button type="button" className="botao" onClick={baixar}>
        <Download className="icone" size={16} />
        Baixar backup (JSON)
      </button>
      <p role="status" className="dados__status muted">
        {anuncio}
      </p>
    </section>
  )
}

/** Ver o painel com o exemplo, ou apagar tudo para começar do zero. */
function SecaoRecomecar() {
  const { dados, despachar, podeSalvar } = usePainel()
  const [confirmando, setConfirmando] = useState(false)
  const [anuncio, setAnuncio] = useState('')
  const titulo = useRef<HTMLHeadingElement>(null)
  const botaoApagar = useRef<HTMLButtonElement>(null)
  const botaoCancelar = useRef<HTMLButtonElement>(null)
  // Adicionar de novo duplicaria as 3 matérias.
  const jaTemExemplo = nomesRepetidos(dados, dadosDeExemplo()).length > 0

  function adicionarExemplo() {
    // O botão fica desativado em seguida (o exemplo já está lá); o foco vai para o título.
    flushSync(() => {
      despachar({ tipo: 'dados/substituir', dados: mesclar(dados, dadosDeExemplo()) })
      setAnuncio('Adicionadas 3 matérias de exemplo e os eventos delas.')
    })
    titulo.current?.focus()
  }

  function apagarTudo() {
    // A regra padrão fica: ela é uma configuração, não um dado do semestre.
    flushSync(() => {
      despachar({ tipo: 'dados/substituir', dados: { ...dadosVazios(), regraPadrao: dados.regraPadrao } })
      setConfirmando(false)
      setAnuncio('Tudo apagado. O painel está vazio.')
    })
    titulo.current?.focus()
  }

  function pedirConfirmacao() {
    flushSync(() => setConfirmando(true))
    botaoCancelar.current?.focus()
  }

  function cancelar() {
    flushSync(() => setConfirmando(false))
    botaoApagar.current?.focus()
  }

  return (
    <section className="cartao dados__secao" aria-labelledby="dados-recomecar">
      <h3 id="dados-recomecar" ref={titulo} tabIndex={-1} className="dados__subtitulo">
        Exemplo e recomeço
      </h3>
      <p className="dados__texto">
        Veja o painel em uso com 3 matérias inventadas. Depois, apague tudo para cadastrar as suas.
      </p>
      <div className="dados__botoes">
        <button
          type="button"
          className="botao botao--fantasma"
          onClick={adicionarExemplo}
          disabled={!podeSalvar || jaTemExemplo}
          aria-describedby={jaTemExemplo ? 'dados-exemplo-ja' : undefined}
        >
          <Eye className="icone" size={16} />
          Adicionar dados de exemplo
        </button>
        {!vazio(dados) && !confirmando && (
          <button
            ref={botaoApagar}
            type="button"
            className="botao botao--fantasma"
            onClick={pedirConfirmacao}
            disabled={!podeSalvar}
          >
            <Trash2 className="icone" size={16} />
            Apagar tudo
          </button>
        )}
      </div>
      {jaTemExemplo && (
        <p id="dados-exemplo-ja" className="muted dados__nota">
          O exemplo já está no painel.
        </p>
      )}
      {confirmando && (
        <div className="dados__confirmar">
          <p className="dados__texto">
            Isto apaga {resumoDados(dados)}, com as notas e as faltas. Só dá para desfazer logo em seguida, pelo aviso
            no pé da página: baixe um backup antes, se quiser guardar.
          </p>
          <div className="dados__botoes">
            {/* Outra aba pode gravar algo que esta não lê com a confirmação aberta: aí apagar não seria gravado. */}
            <button type="button" className="botao botao--perigo" onClick={apagarTudo} disabled={!podeSalvar}>
              Apagar tudo
            </button>
            <button ref={botaoCancelar} type="button" className="botao botao--fantasma" onClick={cancelar}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      <p role="status" className="dados__status muted">
        {anuncio}
      </p>
    </section>
  )
}

const IDS_REGRA = idsRegra('dados')

/** Para quem vale a regra padrão: as matérias sem regra própria. */
function alcanceDaRegra(dados: Dados): string {
  const total = dados.materias.length
  const semPropria = dados.materias.filter((m) => m.regra === undefined).length
  if (total === 0) return 'Ainda não há matérias no painel.'
  if (semPropria === total) {
    return total === 1 ? 'Vale para a única matéria do painel.' : `Vale para todas as ${total} matérias do painel.`
  }
  if (semPropria === 0) {
    return total === 1
      ? 'Hoje não vale para nenhuma: a única matéria do painel tem regra própria.'
      : `Hoje não vale para nenhuma: as ${total} matérias do painel têm regra própria.`
  }
  return `Vale para ${semPropria} das ${total} matérias (${plural(total - semPropria, 'a outra tem', 'as outras têm')} regra própria).`
}

/** A regra de aprovação das matérias que não têm regra própria. */
function SecaoRegra() {
  const { dados, despachar, podeSalvar, mudouEmOutraAba } = usePainel()
  const [form, setForm] = useState<RegraForm | null>(null)
  const [erro, setErro] = useState<ErroCampo | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [anuncio, setAnuncio] = useState('')
  const titulo = useRef<HTMLHeadingElement>(null)
  const botaoEditar = useRef<HTMLButtonElement>(null)
  const botaoVoltar = useRef<HTMLButtonElement>(null)
  const botaoCancelarVolta = useRef<HTMLButtonElement>(null)
  const ehPUCPR = regrasIguais(dados.regraPadrao, REGRA_PUCPR)

  function editar() {
    flushSync(() => {
      setForm(regraParaForm(dados.regraPadrao))
      setErro(null)
      setConfirmando(false)
      setAnuncio('')
    })
    document.getElementById(IDS_REGRA.media)?.focus()
  }

  function mudar(campos: Partial<RegraForm>, campo?: string) {
    setForm((f) => (f === null ? f : { ...f, ...campos }))
    // Mexer no campo com erro tira a mensagem: ela descrevia o valor antigo.
    if (campo && erro?.campo === campo) setErro(null)
  }

  /** Fecha os campos, anuncia e devolve o foco ao "Editar" (ou ao título, se ele estiver desativado). */
  function fechar(mensagem: string) {
    flushSync(() => {
      setForm(null)
      setErro(null)
      setAnuncio(mensagem)
    })
    const editar = botaoEditar.current
    ;(editar && !editar.disabled ? editar : titulo.current)?.focus()
  }

  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form) return
    const problema = erroRegra(form, IDS_REGRA)
    if (problema) {
      flushSync(() => setErro(problema))
      document.getElementById(problema.campo)?.focus()
      return
    }
    despachar({ tipo: 'regraPadrao/definir', regra: montarRegra(form) })
    fechar('Regra padrão salva.')
  }

  function pedirConfirmacao() {
    flushSync(() => setConfirmando(true))
    botaoCancelarVolta.current?.focus()
  }

  function cancelarVolta() {
    flushSync(() => setConfirmando(false))
    botaoVoltar.current?.focus()
  }

  function voltarParaPUCPR() {
    flushSync(() => {
      despachar({ tipo: 'regraPadrao/definir', regra: structuredClone(REGRA_PUCPR) })
      setConfirmando(false)
      setAnuncio('A regra padrão voltou a ser a da PUC-PR.')
    })
    titulo.current?.focus()
  }

  const semSalvar = podeSalvar ? undefined : 'dados-regra-nao-salva'

  return (
    <section className="cartao dados__secao" aria-labelledby="dados-regra">
      <h3 id="dados-regra" ref={titulo} tabIndex={-1} className="dados__subtitulo">
        Regra padrão de aprovação
      </h3>
      <p className="dados__texto">
        Toda matéria sem regra própria segue esta regra. {alcanceDaRegra(dados)}
      </p>
      <div className="dados__regra">
        <p className="dados__texto">
          <strong>{ehPUCPR ? 'Regra da PUC-PR' : 'Regra personalizada'}</strong>
        </p>
        <ul className="dados__lista dados__regra-resumo">
          {textoRegra(dados.regraPadrao).map((frase) => (
            <li key={frase}>{frase}</li>
          ))}
        </ul>
      </div>

      {form ? (
        <form className="dados__regra-form" onSubmit={salvar} noValidate>
          <CamposRegra legenda="Nova regra padrão" regra={form} ids={IDS_REGRA} erro={erro} mudar={mudar} />
          <div className="dados__botoes">
            <button type="submit" className="botao" disabled={!podeSalvar} aria-describedby={semSalvar}>
              Salvar
            </button>
            <button type="button" className="botao botao--fantasma" onClick={() => fechar('Edição cancelada.')}>
              Cancelar
            </button>
          </div>
        </form>
      ) : confirmando ? (
        <div className="dados__confirmar">
          <p className="dados__texto">
            A regra padrão volta a ser a da PUC-PR: média 7,0, frequência de 75% e recuperação de 4,0 a 6,9. As
            matérias com regra própria não mudam.
          </p>
          <div className="dados__botoes">
            <button type="button" className="botao" onClick={voltarParaPUCPR} disabled={!podeSalvar}>
              Confirmar
            </button>
            <button ref={botaoCancelarVolta} type="button" className="botao botao--fantasma" onClick={cancelarVolta}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="dados__botoes">
          <button
            ref={botaoEditar}
            type="button"
            className="botao botao--fantasma"
            onClick={editar}
            disabled={!podeSalvar}
            aria-describedby={semSalvar}
          >
            <Pencil className="icone" size={16} />
            Editar regra padrão
          </button>
          {!ehPUCPR && (
            <button
              ref={botaoVoltar}
              type="button"
              className="botao botao--fantasma"
              onClick={pedirConfirmacao}
              disabled={!podeSalvar}
              aria-describedby={semSalvar}
            >
              <RotateCcw className="icone" size={16} />
              Voltar para a regra da PUC-PR
            </button>
          )}
        </div>
      )}
      {!podeSalvar && (
        <p id="dados-regra-nao-salva" className="dados__texto dados__aviso">
          {mudouEmOutraAba
            ? 'O painel foi alterado em outra aba. Recarregue a página antes de mudar a regra.'
            : 'Este navegador não está salvando os dados, então a regra nova se perderia ao fechar a página.'}
        </p>
      )}
      <p role="status" className="dados__status muted">
        {anuncio}
      </p>
    </section>
  )
}

function SecaoImportar() {
  const { dados, despachar, podeSalvar, mudouEmOutraAba } = usePainel()
  const [texto, setTexto] = useState('')
  const [leitura, setLeitura] = useState<Resultado<Dados> | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [anuncio, setAnuncio] = useState('')
  const titulo = useRef<HTMLHeadingElement>(null)
  const botaoConfirmar = useRef<HTMLButtonElement>(null)
  const botaoSubstituir = useRef<HTMLButtonElement>(null)

  function conferir(conteudo: string) {
    const lida = lerImportacao(conteudo, dados.regraPadrao)
    setLeitura(lida)
    setConfirmando(false)
    // O erro tem role="alert"; o que foi encontrado é anunciado aqui (a prévia aparece em silêncio).
    setAnuncio(lida.ok ? `Encontrado: ${resumoDados(lida.valor)}.` : '')
  }

  /** Erro de arquivo, mostrado no mesmo lugar que o erro de JSON. */
  function erroArquivo(erro: string) {
    setTexto('')
    setLeitura({ ok: false, erro })
    setConfirmando(false)
    setAnuncio('')
  }

  async function escolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    // Limpa a escolha: escolher o mesmo arquivo de novo (depois de corrigir) volta a ler.
    e.target.value = ''
    if (!arquivo) return
    // Um vídeo escolhido por engano travaria a aba ao ler.
    if (arquivo.size > TAMANHO_MAXIMO_IMPORTACAO) {
      erroArquivo(`o arquivo "${arquivo.name}" é grande demais para ser um backup do painel.`)
      return
    }
    let conteudo: string
    try {
      conteudo = await arquivo.text()
    } catch {
      erroArquivo(`não deu para ler o arquivo "${arquivo.name}" (ele foi movido ou apagado?).`)
      return
    }
    setTexto(conteudo)
    conferir(conteudo)
  }

  /** Aplica a importação, limpa o formulário e leva o foco para o título (o resto some). */
  function aplicar(novos: Dados, mensagem: string) {
    flushSync(() => {
      despachar({ tipo: 'dados/substituir', dados: novos })
      setTexto('')
      setLeitura(null)
      setConfirmando(false)
      setAnuncio(mensagem)
    })
    titulo.current?.focus()
  }

  function pedirConfirmacao() {
    flushSync(() => setConfirmando(true))
    botaoConfirmar.current?.focus()
  }

  function cancelar() {
    flushSync(() => setConfirmando(false))
    botaoSubstituir.current?.focus()
  }

  const lido = leitura?.ok ? leitura.valor : null
  const repetidos = lido ? nomesRepetidos(dados, lido) : []
  const mudaRegra = lido !== null && JSON.stringify(lido.regraPadrao) !== JSON.stringify(dados.regraPadrao)

  return (
    <section className="cartao dados__secao" aria-labelledby="dados-importar">
      <h3 id="dados-importar" ref={titulo} tabIndex={-1} className="dados__subtitulo">
        Importar
      </h3>
      <p className="dados__texto">
        Escolha um backup do painel, ou cole o JSON que uma IA montou a partir do plano de ensino.
      </p>
      <label className="botao botao--fantasma dados__arquivo">
        <Upload className="icone" size={16} />
        Escolher arquivo
        <input type="file" accept=".json,application/json" className="invisivel" onChange={escolherArquivo} />
      </label>
      <div className="dados__campo">
        <label htmlFor="dados-texto">Ou cole o JSON aqui</label>
        <textarea
          id="dados-texto"
          className="campo dados__texto-json"
          rows={6}
          spellCheck={false}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            setLeitura(null)
            setConfirmando(false)
          }}
          aria-invalid={leitura && !leitura.ok ? true : undefined}
          aria-describedby={leitura && !leitura.ok ? 'dados-erro' : undefined}
        />
      </div>
      <button type="button" className="botao botao--fantasma" onClick={() => conferir(texto)}>
        Conferir
      </button>

      {leitura && !leitura.ok && (
        <p id="dados-erro" role="alert" className="erro-campo">
          Não deu para importar: {leitura.erro}
        </p>
      )}

      {lido && (
        <div className="dados__previa" role="group" aria-labelledby="dados-previa-titulo">
          <p id="dados-previa-titulo" className="dados__texto">
            <strong>Encontrado:</strong> {resumoDados(lido)}.
          </p>
          {lido.materias.length > 0 && (
            <ul className="dados__lista">
              {lido.materias.map((m, i) => (
                <li key={i}>{m.nome}</li>
              ))}
            </ul>
          )}
          {repetidos.length > 0 && (
            <p className="dados__texto dados__aviso">
              Já existe no painel: {repetidos.join(', ')}. Adicionar cria outra com o mesmo nome.
            </p>
          )}
          {confirmando ? (
            <div className="dados__confirmar">
              <p className="dados__texto">
                Isto apaga {resumoDados(dados)} e põe o que está no arquivo no lugar.
                {mudaRegra && ' A regra padrão de aprovação também passa a ser a do arquivo.'} Só dá para desfazer
                logo em seguida, pelo aviso no pé da página.
              </p>
              <div className="dados__botoes">
                <button
                  ref={botaoConfirmar}
                  type="button"
                  className="botao botao--perigo"
                  onClick={() => aplicar(lido, `Dados substituídos: agora o painel tem ${resumoDados(lido)}.`)}
                >
                  Confirmar substituição
                </button>
                <button type="button" className="botao botao--fantasma" onClick={cancelar}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="dados__botoes">
              <button
                type="button"
                className="botao"
                disabled={!podeSalvar}
                aria-describedby={podeSalvar ? undefined : 'dados-nao-salva'}
                onClick={() => aplicar(mesclar(dados, lido), `Adicionado ao painel: ${resumoDados(lido)}.`)}
              >
                Adicionar ao painel
              </button>
              <button
                ref={botaoSubstituir}
                type="button"
                className="botao botao--fantasma"
                disabled={!podeSalvar}
                aria-describedby={podeSalvar ? undefined : 'dados-nao-salva'}
                onClick={() =>
                  vazio(dados)
                    ? aplicar(lido, `Dados importados: agora o painel tem ${resumoDados(lido)}.`)
                    : pedirConfirmacao()
                }
              >
                Substituir tudo
              </button>
            </div>
          )}
          {!podeSalvar && (
            <p id="dados-nao-salva" className="dados__texto dados__aviso">
              {mudouEmOutraAba
                ? 'O painel foi alterado em outra aba. Recarregue a página antes de importar.'
                : 'Este navegador não está salvando os dados, então a importação se perderia ao fechar a página.'}
            </p>
          )}
          <p className="muted dados__nota">
            Adicionar junta as matérias e os eventos do arquivo aos que já estão aqui. Substituir tudo é para
            restaurar um backup.
          </p>
        </div>
      )}
      <p role="status" className="dados__status muted">
        {anuncio}
      </p>
    </section>
  )
}

function SecaoIA() {
  const [anuncio, setAnuncio] = useState('')
  const [aberto, setAberto] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(INSTRUCOES_IA)
      setAnuncio('Instruções copiadas. Cole no chat da IA junto com o PDF do plano de ensino.')
    } catch {
      // Sem permissão para a área de transferência: mostra o texto para copiar à mão.
      setAberto(true)
      setAnuncio('Não deu para copiar sozinho. O texto está aberto abaixo: selecione e copie.')
    }
  }

  return (
    <section className="cartao dados__secao" aria-labelledby="dados-ia">
      <h3 id="dados-ia" className="dados__subtitulo">
        Cadastrar com uma IA
      </h3>
      <ol className="dados__passos">
        <li>Copie as instruções.</li>
        <li>Cole num chat de IA (ChatGPT, Claude, Gemini...) e anexe o PDF do plano de ensino.</li>
        <li>Copie o JSON da resposta, cole em "Importar" e escolha "Adicionar ao painel".</li>
        <li>Abra a matéria e confira: a IA pode errar. Se ela avisar algo com "Atenção:", confira no plano.</li>
      </ol>
      <p className="muted dados__nota">
        Prefere não usar IA? Cadastre pelo formulário em <a href="#/nova-materia">Nova matéria</a>.
      </p>
      <button type="button" className="botao" onClick={copiar}>
        <Bot className="icone" size={16} />
        Copiar instruções para uma IA
      </button>
      <details className="dados__instrucoes" open={aberto} onToggle={(e) => setAberto(e.currentTarget.open)}>
        <summary>Ver as instruções</summary>
        <pre>{INSTRUCOES_IA}</pre>
      </details>
      <p role="status" className="dados__status muted">
        {anuncio}
      </p>
    </section>
  )
}
