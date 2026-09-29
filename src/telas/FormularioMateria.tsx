import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { CabecalhoTela } from '../componentes/CabecalhoTela'
import { usePainel } from '../estado/contexto'
import { formatarData } from '../logica/datas'
import { AULAS_PUC } from '../logica/aulasPUC'
import { MAXIMO_AULAS_POR_DIA } from '../logica/faltas'
import { faixaHorario } from '../logica/horarios'
import { formatarNota, lerNumero } from '../logica/numeros'
import { VERSAO_ATUAL, type DiaSemana, type Materia } from '../logica/tipos'
import { validarDados } from '../logica/validacao'
import { sairPara, useBloquearSaida } from '../navegacao/useRota'
import { plural } from '../tema/textos'
import { CamposRegra } from './CamposRegra'
import {
  conferirPasso,
  DIAS_SEMANA,
  ID_CARGA,
  ID_NOME,
  ID_PROFESSOR,
  IDS_REGRA_MATERIA,
  idAvaliacao,
  idHorario,
  idRA,
  montarRegra,
  mudarHorarioForm,
  aulasEscolhidas,
  escolherAulas,
  escolherPrimeiraAula,
  trocarModoHorario,
  nomeDia,
  novaAvaliacao,
  novoHorario,
  novoRA,
  PASSOS,
  passoDoErro,
  porcentagemRA,
  somaPesos,
  textoRegra,
  type AvaliacaoForm,
  type ErroCampo,
  type Formulario,
  type HorarioForm,
  type RAForm,
  type RegraForm,
} from './novaMateriaUtil'
import { Rotulado } from './Rotulado'
import './novaMateria.css'

const ID_TITULO_PASSO = 'nm-titulo-passo'
const ULTIMO = PASSOS.length - 1
const idBotaoAdicionarAvaliacao = (chaveRA: string) => `nm-ra-${chaveRA}-adicionar`

/** Passo das avaliações: é nele que ficam os erros de `conferirExtra`. */
const PASSO_AVALIACOES = 2

interface PropsFormulario {
  titulo: string
  introducao: string
  /** Aviso logo abaixo da introdução, em todos os passos (editar: mudou em outra aba). */
  aviso?: ReactNode
  /** Como o formulário começa: vazio (nova matéria) ou com a matéria (editar). */
  inicial: Formulario
  /** Para onde o Cancelar leva. */
  sair: string
  /** A matéria a salvar, montada do formulário já conferido. */
  montar: (form: Formulario) => Materia
  salvar: (materia: Materia) => void
  /** Conferência a mais, no passo das avaliações (editar: nota maior que o valor). */
  conferirExtra?: (form: Formulario) => ErroCampo | null
  /** Aviso no passo de revisar (editar: as notas que serão apagadas). */
  avisoRevisar?: (form: Formulario) => ReactNode
}

/**
 * O formulário passo a passo de uma matéria, usado para cadastrar e para editar.
 * Quem usa decide o começo, como montar a matéria e o que fazer ao salvar.
 */
export function FormularioMateria({
  titulo,
  introducao,
  aviso,
  inicial,
  sair,
  montar,
  salvar,
  conferirExtra,
  avisoRevisar,
}: PropsFormulario) {
  const { dados } = usePainel()
  const [form, setForm] = useState<Formulario>(inicial)
  // Qualquer mudança cria um formulário novo; se ainda é o inicial, não há nada a perder.
  // Digitar e apagar conta como preenchido: perguntar à toa é melhor que apagar sem avisar.
  const preenchido = form !== inicial
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)
  /** Para onde a pessoa tentou ir pelas abas ou pelo voltar; null = pelo Cancelar. */
  const [destinoSaida, setDestinoSaida] = useState<string | null>(null)
  const botaoCancelar = useRef<HTMLButtonElement>(null)
  const botaoFicar = useRef<HTMLButtonElement>(null)
  const [passo, setPasso] = useState(0)
  const [erro, setErro] = useState<ErroCampo | null>(null)
  const [status, setStatus] = useState('')
  const tituloPasso = useRef<HTMLHeadingElement>(null)

  // Fechar ou recarregar a aba com o formulário preenchido: o navegador pergunta antes
  // (a mensagem é a padrão dele; os navegadores não deixam mudar o texto).
  useEffect(() => {
    if (!preenchido) return
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // Chrome antes da versão 119 só pergunta com isto.
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [preenchido])

  // Sair pelas abas do topo, por um link ou pelo voltar do navegador: a tela não
  // troca, e a mesma pergunta do Cancelar aparece, lembrando para onde a pessoa ia.
  useBloquearSaida(preenchido, (destino) => abrirConfirmacaoDeSaida(destino))

  function abrirConfirmacaoDeSaida(destino: string | null) {
    flushSync(() => {
      setDestinoSaida(destino)
      setConfirmandoSaida(true)
    })
    // O foco vai para a opção que não apaga nada (e rola a página até a pergunta).
    botaoFicar.current?.focus()
  }

  function pedirConfirmacaoDeSaida() {
    // Com o aviso aberto, o Cancelar fecha ele de novo (é o que o aria-expanded promete).
    if (confirmandoSaida) {
      setConfirmandoSaida(false)
      return
    }
    abrirConfirmacaoDeSaida(null)
  }

  function continuarPreenchendo() {
    flushSync(() => setConfirmandoSaida(false))
    botaoCancelar.current?.focus()
  }

  /** Troca de passo e põe o foco no título dele, que diz em que passo está. */
  function irPara(novo: number) {
    flushSync(() => {
      setPasso(novo)
      setErro(null)
      setStatus('')
    })
    tituloPasso.current?.focus()
  }

  /** Mostra o erro (no passo dele) e põe o foco no campo. */
  function mostrarErro(problema: ErroCampo, noPasso: number) {
    flushSync(() => {
      setPasso(noPasso)
      setErro(problema)
      setStatus('')
    })
    document.getElementById(problema.campo)?.focus()
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const problema = conferirPasso(passo, form)
    if (problema) {
      mostrarErro(problema, passo === ULTIMO ? (passoDoErro(form) ?? passo) : passo)
      return
    }
    if (passo === PASSO_AVALIACOES || passo === ULTIMO) {
      const extra = conferirExtra?.(form)
      if (extra) {
        mostrarErro(extra, PASSO_AVALIACOES)
        return
      }
    }
    if (passo < ULTIMO) {
      irPara(passo + 1)
      return
    }
    const materia = montar(form)
    // Última garantia: a matéria precisa passar pela mesma conferência do carregamento,
    // senão o painel não abriria de novo depois de salvar.
    const conferida = validarDados({
      versao: VERSAO_ATUAL,
      materias: [materia],
      eventos: [],
      regraPadrao: dados.regraPadrao,
    })
    if (!conferida.ok) {
      setStatus(`Não deu para salvar a matéria: ${conferida.erro}`)
      return
    }
    salvar(materia)
  }

  // ---------- Mudanças no formulário ----------
  // Mexer no campo com erro tira a mensagem: ela descrevia o valor antigo.
  function limparErro(campo: string) {
    if (erro?.campo === campo) setErro(null)
  }

  function mudar(campos: Partial<Formulario>, campo?: string) {
    setForm((f) => ({ ...f, ...campos }))
    if (campo) limparErro(campo)
  }

  function mudarHorario(chave: string, campos: Partial<HorarioForm>, campo?: string) {
    setForm((f) => ({
      ...f,
      horarios: f.horarios.map((h) => (h.chave === chave ? mudarHorarioForm(h, campos) : h)),
    }))
    if (campo) limparErro(campo)
  }

  function mudarRA(chave: string, campos: Partial<RAForm>, campo?: string) {
    setForm((f) => ({ ...f, ras: f.ras.map((ra) => (ra.chave === chave ? { ...ra, ...campos } : ra)) }))
    if (campo) limparErro(campo)
  }

  function mudarAvaliacao(chaveRA: string, chave: string, campos: Partial<AvaliacaoForm>, campo: string) {
    setForm((f) => ({
      ...f,
      ras: f.ras.map((ra) =>
        ra.chave === chaveRA
          ? { ...ra, avaliacoes: ra.avaliacoes.map((av) => (av.chave === chave ? { ...av, ...campos } : av)) }
          : ra,
      ),
    }))
    limparErro(campo)
  }

  function mudarRegra(campos: Partial<RegraForm>, campo?: string) {
    setForm((f) => ({ ...f, regra: { ...f.regra, ...campos } }))
    if (campo) limparErro(campo)
  }

  /** "Da aula" e "Até a aula": usam os ids de início e fim, onde a conferência põe os erros. */
  function camposAulas(h: HorarioForm) {
    const { primeira, ultima } = aulasEscolhidas(h)
    return (
      <>
        <Rotulado id={idHorario(h.chave, 'inicio')} rotulo="Da aula" erro={erro}>
          {(p) => (
            <select
              {...p}
              className="campo"
              value={primeira}
              onChange={(e) =>
                mudarAulas(h.chave, (atual) => escolherPrimeiraAula(atual, Number(e.target.value)), p.id)
              }
            >
              <option value={-1}>Escolha</option>
              {AULAS_PUC.map((a, i) => (
                <option key={a.numero} value={i}>
                  {a.numero}ª aula ({a.inicio})
                </option>
              ))}
            </select>
          )}
        </Rotulado>
        <Rotulado id={idHorario(h.chave, 'fim')} rotulo="Até a aula" erro={erro}>
          {(p) => (
            <select
              {...p}
              className="campo"
              value={ultima}
              onChange={(e) =>
                mudarAulas(h.chave, (atual) => escolherAulas(atual, primeira, Number(e.target.value)), p.id)
              }
            >
              <option value={-1}>Escolha</option>
              {/* Só da primeira até o máximo de aulas num dia ("da 4ª até a 2ª" não existe). A
                  escolhida fica sempre na lista, para o seletor mostrar o que está salvo. */}
              {AULAS_PUC.map((a, i) =>
                i !== ultima && (i < primeira || i >= primeira + MAXIMO_AULAS_POR_DIA) ? null : (
                  <option key={a.numero} value={i}>
                    {a.numero}ª aula (até {a.fim})
                  </option>
                ),
              )}
            </select>
          )}
        </Rotulado>
      </>
    )
  }

  /** Horário digitado, para aulas fora da tabela da PUC-PR. */
  function camposHoras(h: HorarioForm) {
    return (
      <>
        <Rotulado id={idHorario(h.chave, 'inicio')} rotulo="Começa às" erro={erro}>
          {(p) => (
            <input
              {...p}
              type="time"
              className="campo"
              value={h.inicio}
              onChange={(e) => mudarHorario(h.chave, { inicio: e.target.value }, p.id)}
            />
          )}
        </Rotulado>
        <Rotulado id={idHorario(h.chave, 'fim')} rotulo="Termina às" erro={erro}>
          {(p) => (
            <input
              {...p}
              type="time"
              className="campo"
              value={h.fim}
              onChange={(e) => mudarHorario(h.chave, { fim: e.target.value }, p.id)}
            />
          )}
        </Rotulado>
        <Rotulado
          id={idHorario(h.chave, 'aulas')}
          rotulo="Aulas"
          dica={h.aulasManual ? undefined : 'Aulas de 45 min que cabem no horário. Corrija se preciso.'}
          erro={erro}
        >
          {(p) => (
            <input
              {...p}
              className="campo nm-campo--curto"
              inputMode="numeric"
              autoComplete="off"
              value={h.aulas}
              onChange={(e) => mudarHorario(h.chave, { aulas: e.target.value }, p.id)}
            />
          )}
        </Rotulado>
      </>
    )
  }

  /** "07:50 às 11:10 · 4 aulas", quando as duas aulas foram escolhidas. */
  function resumoAulas(h: HorarioForm) {
    const { primeira, ultima } = aulasEscolhidas(h)
    if (primeira === -1 || ultima < primeira) return null
    const aulas = ultima - primeira + 1
    return (
      <p className="muted nm-horario__resumo">
        {h.inicio} às {h.fim} · {aulas} {plural(aulas, 'aula', 'aulas')}
      </p>
    )
  }

  function mudarAulas(chave: string, trocar: (h: HorarioForm) => HorarioForm, campo: string) {
    setForm((f) => ({ ...f, horarios: f.horarios.map((h) => (h.chave === chave ? trocar(h) : h)) }))
    limparErro(campo)
  }

  function trocarModo(h: HorarioForm, numero: number) {
    setForm((f) => ({ ...f, horarios: f.horarios.map((x) => (x.chave === h.chave ? trocarModoHorario(x) : x)) }))
    if (erro?.campo.startsWith(`nm-horario-${h.chave}`)) setErro(null)
    // Os campos trocam embaixo do foco (que fica no botão): o anúncio diz o que apareceu.
    setStatus(
      h.modo === 'aulas'
        ? `Horário ${numero}: informe o início, o fim e as aulas.`
        : `Horário ${numero}: escolha a primeira e a última aula.`,
    )
  }

  // Ao adicionar, o foco vai para o primeiro campo do item novo; ao remover, para o
  // botão de adicionar, que continua na tela. flushSync: o item já existe (ou já
  // sumiu) quando o foco muda.
  function adicionarHorario() {
    const novo = novoHorario()
    flushSync(() => {
      setForm((f) => ({ ...f, horarios: [...f.horarios, novo] }))
      setStatus(`Horário ${form.horarios.length + 1} adicionado.`)
    })
    document.getElementById(idHorario(novo.chave, 'dia'))?.focus()
  }

  function removerHorario(chave: string, numero: number) {
    flushSync(() => {
      setForm((f) => ({ ...f, horarios: f.horarios.filter((h) => h.chave !== chave) }))
      if (erro?.campo.startsWith(`nm-horario-${chave}`)) setErro(null)
      setStatus(`Horário ${numero} removido.`)
    })
    document.getElementById('nm-adicionar-horario')?.focus()
  }

  function adicionarRA() {
    // "RA3" ainda livre, mesmo depois de remover um do meio.
    const nomes = new Set(form.ras.map((ra) => ra.nome.trim()))
    let numero = form.ras.length + 1
    while (nomes.has(`RA${numero}`)) numero++
    const novo = novoRA(numero)
    flushSync(() => {
      setForm((f) => ({ ...f, ras: [...f.ras, novo] }))
      setStatus(`${novo.nome} adicionado.`)
    })
    document.getElementById(idRA(novo.chave, 'nome'))?.focus()
  }

  function removerRA(ra: RAForm) {
    flushSync(() => {
      setForm((f) => ({ ...f, ras: f.ras.filter((r) => r.chave !== ra.chave) }))
      setErro(null)
      setStatus(`${ra.nome.trim() || 'RA'} removido.`)
    })
    document.getElementById('nm-adicionar-ra')?.focus()
  }

  function adicionarAvaliacao(ra: RAForm) {
    const nova = novaAvaliacao()
    flushSync(() => {
      mudarRA(ra.chave, { avaliacoes: [...ra.avaliacoes, nova] })
      setStatus(`Avaliação ${ra.avaliacoes.length + 1} adicionada ao ${ra.nome}.`)
    })
    document.getElementById(idAvaliacao(nova.chave, 'nome'))?.focus()
  }

  function removerAvaliacao(ra: RAForm, chave: string, numero: number) {
    flushSync(() => {
      mudarRA(ra.chave, { avaliacoes: ra.avaliacoes.filter((av) => av.chave !== chave) })
      if (erro?.campo.startsWith(`nm-av-${chave}`)) setErro(null)
      setStatus(`Avaliação ${numero} removida do ${ra.nome}.`)
    })
    document.getElementById(idBotaoAdicionarAvaliacao(ra.chave))?.focus()
  }

  // ---------- Passos ----------

  function passoMateria() {
    return (
      <>
        <Rotulado id={ID_NOME} rotulo="Nome da matéria" erro={erro}>
          {(p) => (
            <input
              {...p}
              className="campo"
              autoComplete="off"
              value={form.nome}
              onChange={(e) => mudar({ nome: e.target.value }, ID_NOME)}
            />
          )}
        </Rotulado>
        <Rotulado id={ID_PROFESSOR} rotulo="Professor (opcional)" erro={erro}>
          {(p) => (
            <input
              {...p}
              className="campo"
              autoComplete="off"
              value={form.professor}
              onChange={(e) => mudar({ professor: e.target.value }, ID_PROFESSOR)}
            />
          )}
        </Rotulado>
        <Rotulado
          id={ID_CARGA}
          rotulo="Carga horária (aulas de 45 min)"
          dica='Está no plano de ensino como "HA" (horas-aula). Use 0 se não souber; sem ela, o painel não conta o limite de faltas.'
          erro={erro}
        >
          {(p) => (
            <input
              {...p}
              className="campo nm-campo--curto"
              inputMode="numeric"
              autoComplete="off"
              value={form.cargaHoraria}
              onChange={(e) => mudar({ cargaHoraria: e.target.value }, ID_CARGA)}
            />
          )}
        </Rotulado>

        <fieldset className="nm-grupo">
          <legend>Horários das aulas (opcional)</legend>
          {form.horarios.length === 0 && <p className="muted nm-grupo__vazio">Nenhum horário ainda.</p>}
          {form.horarios.map((h, i) => (
            <fieldset key={h.chave} className="nm-item">
              <legend>Horário {i + 1}</legend>
              <div className="nm-item__campos">
                <Rotulado id={idHorario(h.chave, 'dia')} rotulo="Dia" erro={erro}>
                  {(p) => (
                    <select
                      {...p}
                      className="campo"
                      value={h.dia}
                      onChange={(e) => mudarHorario(h.chave, { dia: Number(e.target.value) as DiaSemana })}
                    >
                      {DIAS_SEMANA.map((d) => (
                        <option key={d.dia} value={d.dia}>
                          {d.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </Rotulado>
                {h.modo === 'aulas' ? camposAulas(h) : camposHoras(h)}
              </div>
              {h.modo === 'aulas' && resumoAulas(h)}
              <button
                type="button"
                className="botao botao--fantasma botao--pequeno nm-horario__modo"
                onClick={() => trocarModo(h, i + 1)}
                aria-label={
                  h.modo === 'aulas' ? `Informar o horário ${i + 1} em horas` : `Escolher o horário ${i + 1} pelas aulas`
                }
              >
                {h.modo === 'aulas' ? 'Informar em horas' : 'Escolher pelas aulas'}
              </button>
              <button
                type="button"
                className="botao botao--fantasma botao--pequeno nm-item__remover"
                onClick={() => removerHorario(h.chave, i + 1)}
                aria-label={`Remover horário ${i + 1}`}
              >
                <Trash2 className="icone" size={16} aria-hidden="true" />
                Remover
              </button>
            </fieldset>
          ))}
          <button
            id="nm-adicionar-horario"
            type="button"
            className="botao botao--fantasma botao--pequeno"
            onClick={adicionarHorario}
          >
            <Plus className="icone" size={16} aria-hidden="true" />
            Adicionar horário
          </button>
        </fieldset>
      </>
    )
  }

  function passoRAs() {
    const soma = somaPesos(form.ras)
    return (
      <>
        <p className="muted nm-texto">
          Os RAs (Resultados de Aprendizagem) e o peso de cada um estão no plano de ensino. Os pesos não precisam
          somar 100: cada RA vale o peso dele dividido pela soma.
        </p>
        {form.ras.map((ra, i) => {
          const pct = porcentagemRA(ra, form.ras)
          return (
            <fieldset key={ra.chave} className="nm-item">
              <legend>RA {i + 1}</legend>
              <div className="nm-item__campos">
                <Rotulado id={idRA(ra.chave, 'nome')} rotulo="Nome" erro={erro}>
                  {(p) => (
                    <input
                      {...p}
                      className="campo"
                      autoComplete="off"
                      value={ra.nome}
                      onChange={(e) => mudarRA(ra.chave, { nome: e.target.value }, p.id)}
                    />
                  )}
                </Rotulado>
                <Rotulado
                  id={idRA(ra.chave, 'peso')}
                  rotulo="Peso na nota final"
                  dica={pct ? `Vale ${pct} da nota final.` : 'Ex.: 40 para 40%.'}
                  erro={erro}
                >
                  {(p) => (
                    <input
                      {...p}
                      className="campo nm-campo--curto"
                      inputMode="decimal"
                      autoComplete="off"
                      value={ra.peso}
                      onChange={(e) => mudarRA(ra.chave, { peso: e.target.value }, p.id)}
                    />
                  )}
                </Rotulado>
              </div>
              <label className="nm-caixa">
                <input
                  type="checkbox"
                  checked={ra.recuperacaoNoSemestre}
                  onChange={(e) => mudarRA(ra.chave, { recuperacaoNoSemestre: e.target.checked })}
                />
                Tem recuperação durante o semestre
              </label>
              {form.ras.length > 1 && (
                <button
                  type="button"
                  className="botao botao--fantasma botao--pequeno nm-item__remover"
                  onClick={() => removerRA(ra)}
                  aria-label={`Remover RA ${i + 1}`}
                >
                  <Trash2 className="icone" size={16} aria-hidden="true" />
                  Remover
                </button>
              )}
            </fieldset>
          )
        })}
        <p className="nm-soma">
          Soma dos pesos: <strong>{formatarNota(soma).replace(/,0$/, '')}</strong>
        </p>
        <button id="nm-adicionar-ra" type="button" className="botao botao--fantasma botao--pequeno" onClick={adicionarRA}>
          <Plus className="icone" size={16} aria-hidden="true" />
          Adicionar RA
        </button>
      </>
    )
  }

  function passoAvaliacoes() {
    return (
      <>
        <p className="muted nm-texto">
          As avaliações de cada RA estão no plano de ensino. Se o plano não diz os pesos, deixe 1 em todas (pesos
          iguais). As notas você lança depois, na tela da matéria.
        </p>
        {form.ras.map((ra) => (
          <fieldset key={ra.chave} className="nm-grupo">
            <legend>{ra.nome}</legend>
            {ra.avaliacoes.length === 0 && (
              <p className="muted nm-grupo__vazio">
                Sem avaliações: a nota do {ra.nome} fica pendente até você adicionar alguma.
              </p>
            )}
            {ra.avaliacoes.map((av, i) => (
              <fieldset key={av.chave} className="nm-item">
                <legend>
                  Avaliação {i + 1} do {ra.nome}
                </legend>
                <div className="nm-item__campos nm-item__campos--avaliacao">
                  <Rotulado id={idAvaliacao(av.chave, 'nome')} rotulo="Nome" erro={erro}>
                    {(p) => (
                      <input
                        {...p}
                        className="campo"
                        autoComplete="off"
                        placeholder="Ex.: Prova 1"
                        value={av.nome}
                        onChange={(e) => mudarAvaliacao(ra.chave, av.chave, { nome: e.target.value }, p.id)}
                      />
                    )}
                  </Rotulado>
                  <Rotulado id={idAvaliacao(av.chave, 'valor')} rotulo="Vale até" dica="Ex.: 10 ou 3,0." erro={erro}>
                    {(p) => (
                      <input
                        {...p}
                        className="campo"
                        inputMode="decimal"
                        autoComplete="off"
                        value={av.valorMaximo}
                        onChange={(e) => mudarAvaliacao(ra.chave, av.chave, { valorMaximo: e.target.value }, p.id)}
                      />
                    )}
                  </Rotulado>
                  <Rotulado id={idAvaliacao(av.chave, 'peso')} rotulo="Peso no RA" dica="1 = pesos iguais." erro={erro}>
                    {(p) => (
                      <input
                        {...p}
                        className="campo"
                        inputMode="decimal"
                        autoComplete="off"
                        value={av.peso}
                        onChange={(e) => mudarAvaliacao(ra.chave, av.chave, { peso: e.target.value }, p.id)}
                      />
                    )}
                  </Rotulado>
                  <Rotulado id={idAvaliacao(av.chave, 'data')} rotulo="Data (opcional)" erro={erro}>
                    {(p) => (
                      <input
                        {...p}
                        type="date"
                        className="campo"
                        value={av.data}
                        onChange={(e) => mudarAvaliacao(ra.chave, av.chave, { data: e.target.value }, p.id)}
                      />
                    )}
                  </Rotulado>
                </div>
                <button
                  type="button"
                  className="botao botao--fantasma botao--pequeno nm-item__remover"
                  onClick={() => removerAvaliacao(ra, av.chave, i + 1)}
                  aria-label={`Remover avaliação ${i + 1} do ${ra.nome}`}
                >
                  <Trash2 className="icone" size={16} aria-hidden="true" />
                  Remover
                </button>
              </fieldset>
            ))}
            <button
              id={idBotaoAdicionarAvaliacao(ra.chave)}
              type="button"
              className="botao botao--fantasma botao--pequeno"
              onClick={() => adicionarAvaliacao(ra)}
            >
              <Plus className="icone" size={16} aria-hidden="true" />
              Adicionar avaliação ao {ra.nome}
            </button>
          </fieldset>
        ))}
      </>
    )
  }

  function passoRegra() {
    return (
      <>
        <fieldset className="nm-grupo">
          <legend>Qual regra vale para esta matéria?</legend>
          <label className="nm-caixa">
            <input
              type="radio"
              name="nm-regra"
              checked={form.usarRegraPadrao}
              onChange={() => mudar({ usarRegraPadrao: true })}
            />
            Usar a regra padrão do painel
          </label>
          <ul className="nm-regra-resumo muted">
            {textoRegra(dados.regraPadrao).map((frase) => (
              <li key={frase}>{frase}</li>
            ))}
          </ul>
          <label className="nm-caixa">
            <input
              type="radio"
              name="nm-regra"
              checked={!form.usarRegraPadrao}
              onChange={() => mudar({ usarRegraPadrao: false })}
            />
            Regra própria desta matéria
          </label>
        </fieldset>
        {!form.usarRegraPadrao && (
          <CamposRegra legenda="Regra própria" regra={form.regra} ids={IDS_REGRA_MATERIA} erro={erro} mudar={mudarRegra} />
        )}
      </>
    )
  }

  function passoRevisar() {
    const carga = lerNumero(form.cargaHoraria) ?? 0
    const regra = form.usarRegraPadrao ? dados.regraPadrao : montarRegra(form.regra)
    // Onde há dois botões lado a lado, o texto diz qual é qual; nos outros, "Alterar" basta.
    const alterar = (numero: number, nome: string, texto = 'Alterar') => (
      <button
        type="button"
        className="botao botao--fantasma botao--pequeno"
        onClick={() => irPara(numero)}
        aria-label={`Alterar ${nome}`}
      >
        {texto}
      </button>
    )
    return (
      <>
        {avisoRevisar?.(form)}
        <section className="nm-revisao" aria-labelledby="nm-rev-materia">
          <div className="nm-revisao__topo">
            <h4 id="nm-rev-materia">Matéria</h4>
            {alterar(0, 'matéria')}
          </div>
          <dl className="nm-revisao__dados">
            <dt>Nome</dt>
            <dd>{form.nome.trim()}</dd>
            <dt>Professor</dt>
            <dd>{form.professor.trim() || 'Não informado'}</dd>
            <dt>Carga horária</dt>
            <dd>{carga === 0 ? 'Não informada' : `${carga} ${plural(carga, 'aula', 'aulas')} de 45 min`}</dd>
            <dt>Horários</dt>
            <dd>
              {form.horarios.length === 0
                ? 'Nenhum'
                : form.horarios
                    .map((h) =>
                      `${nomeDia(h.dia)}, ${faixaHorario({ inicio: h.inicio, fim: h.fim, aulas: lerNumero(h.aulas) ?? undefined })}`,
                    )
                    .join('; ')}
            </dd>
          </dl>
        </section>
        <section className="nm-revisao" aria-labelledby="nm-rev-ras">
          <div className="nm-revisao__topo">
            <h4 id="nm-rev-ras">RAs e avaliações</h4>
            {alterar(1, 'RAs', 'Alterar RAs')}
            {alterar(2, 'avaliações', 'Alterar avaliações')}
          </div>
          <ul className="nm-revisao__ras">
            {form.ras.map((ra) => (
              <li key={ra.chave}>
                <p className="nm-revisao__ra">
                  <strong>{ra.nome.trim()}</strong>: peso {ra.peso.trim()} ({porcentagemRA(ra, form.ras)} da nota
                  final)
                  {ra.recuperacaoNoSemestre && ', com recuperação durante o semestre'}
                </p>
                {ra.avaliacoes.length === 0 ? (
                  <p className="muted">Sem avaliações: a nota deste RA fica pendente.</p>
                ) : (
                  <ul>
                    {ra.avaliacoes.map((av) => (
                      <li key={av.chave}>
                        {av.nome.trim()}: vale {formatarNota(lerNumero(av.valorMaximo) ?? 0)}, peso {av.peso.trim()}
                        {av.data && `, em ${formatarData(av.data)}`}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="nm-revisao" aria-labelledby="nm-rev-regra">
          <div className="nm-revisao__topo">
            <h4 id="nm-rev-regra">Regra de aprovação</h4>
            {alterar(3, 'regra de aprovação')}
          </div>
          <p className="nm-revisao__ra">{form.usarRegraPadrao ? 'Regra padrão do painel' : 'Regra própria'}</p>
          <ul className="nm-regra-resumo muted">
            {textoRegra(regra).map((frase) => (
              <li key={frase}>{frase}</li>
            ))}
          </ul>
        </section>
      </>
    )
  }

  const conteudo = [passoMateria, passoRAs, passoAvaliacoes, passoRegra, passoRevisar][passo]

  return (
    <CabecalhoTela titulo={titulo}>
      <p className="muted nm-intro">
        {introducao}
      </p>
      {aviso}
      <ol className="nm-passos" aria-label="Passos">
        {PASSOS.map((nome, i) => (
          <li
            key={nome}
            className={`nm-passos__item${i === passo ? ' nm-passos__item--atual' : ''}${i < passo ? ' nm-passos__item--feito' : ''}`}
            aria-current={i === passo ? 'step' : undefined}
          >
            <span className="nm-passos__numero" aria-hidden="true">
              {i + 1}
            </span>
            <span className="nm-passos__nome">{nome}</span>
          </li>
        ))}
      </ol>
      <form className="cartao nm-form" onSubmit={enviar} noValidate aria-labelledby={ID_TITULO_PASSO}>
        <h3 id={ID_TITULO_PASSO} ref={tituloPasso} tabIndex={-1} className="nm-form__titulo">
          Passo {passo + 1} de {PASSOS.length}: {PASSOS[passo]}
        </h3>
        {conteudo()}
        <div className="nm-acoes">
          {passo > 0 && (
            <button type="button" className="botao botao--fantasma" onClick={() => irPara(passo - 1)}>
              <ArrowLeft className="icone" size={18} aria-hidden="true" />
              Voltar
            </button>
          )}
          <button type="submit" className="botao">
            {passo === ULTIMO ? (
              <>
                <Check className="icone" size={18} aria-hidden="true" />
                Salvar matéria
              </>
            ) : (
              <>
                Continuar
                <ArrowRight className="icone" size={18} aria-hidden="true" />
              </>
            )}
          </button>
          {preenchido ? (
            <button
              ref={botaoCancelar}
              type="button"
              className="botao botao--fantasma nm-acoes__cancelar"
              onClick={pedirConfirmacaoDeSaida}
              aria-expanded={confirmandoSaida}
              aria-controls="nm-sair"
            >
              Cancelar
            </button>
          ) : (
            <a href={sair} className="botao botao--fantasma nm-acoes__cancelar">
              Cancelar
            </a>
          )}
        </div>
        {confirmandoSaida && (
          <div id="nm-sair" className="aviso aviso--atencao nm-sair" role="group" aria-labelledby="nm-sair-texto">
            <p id="nm-sair-texto" className="aviso__texto">
              <strong>Sair sem salvar?</strong> Tudo o que você preencheu nesta matéria será apagado.
            </p>
            <div className="nm-sair__botoes">
              <button
                ref={botaoFicar}
                type="button"
                className="botao botao--fantasma botao--pequeno"
                onClick={continuarPreenchendo}
              >
                Continuar preenchendo
              </button>
              {/* Botão, e não link: um link passaria pelo bloqueio e perguntaria de novo. */}
              <button
                type="button"
                className="botao botao--perigo botao--pequeno"
                onClick={() => sairPara(destinoSaida ?? sair)}
              >
                Sair sem salvar
              </button>
            </div>
          </div>
        )}
        {/* Fica sempre na página: o leitor de tela só anuncia mudanças numa região que já existia. */}
        <p role="status" className="nm-status muted">
          {status}
        </p>
      </form>
    </CabecalhoTela>
  )
}
