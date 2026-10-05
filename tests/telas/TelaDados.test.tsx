import { render, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { CHAVE, dadosVazios } from '../../src/logica/armazenamento'
import { EXEMPLO_IA, INSTRUCOES_IA } from '../../src/logica/instrucoesIA'
import { REGRA_PUCPR, type Dados, type Materia, type RegraAprovacao } from '../../src/logica/tipos'
import { TAMANHO_MAXIMO_IMPORTACAO, textoExportacao } from '../../src/logica/transferencia'
import { TelaDados } from '../../src/telas/TelaDados'
import { criarUsuario } from '../usuario'

/** localStorage falso: os testes não mexem no do jsdom. */
function navegador() {
  const itens = new Map<string, string>()
  return {
    itens,
    getItem: (chave: string) => itens.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void itens.set(chave, valor),
  }
}

const POO: Materia = {
  id: 'poo',
  nome: 'POO',
  professor: '',
  horarios: [],
  cargaHoraria: 120,
  ras: [],
  pontosExtras: [],
  faltas: [],
}

function montar(materias: Materia[] = [POO]) {
  const nav = navegador()
  render(
    <ProvedorPainel
      inicial={{ dados: { ...dadosVazios(), materias }, aviso: null, podeSalvar: true }}
      armazenamento={nav}
    >
      <TelaDados />
    </ProvedorPainel>,
  )
  return nav
}

const salvos = (nav: ReturnType<typeof navegador>): Dados => JSON.parse(nav.itens.get(CHAVE)!)
const importar = () => screen.getByRole('region', { name: 'Importar' })
const anuncioImportar = () => within(importar()).getByRole('status')

/** Cola o texto (sem digitar tecla por tecla: "{" é especial no userEvent) e confere. */
async function colar(texto: string) {
  const campo = screen.getByLabelText('Ou cole o JSON aqui')
  await user.click(campo)
  await user.paste(texto)
  await user.click(screen.getByRole('button', { name: 'Conferir' }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

let user: UserEvent
beforeEach(() => {
  user = criarUsuario()
})

describe('TelaDados', () => {
  it('baixa o backup com tudo o que está no painel', async () => {
    const criar = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:teste')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    montar()
    expect(screen.getByText(/Hoje o painel tem 1 matéria e 0 eventos na agenda/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Baixar backup (JSON)' }))

    expect(clique).toHaveBeenCalledOnce()
    const blob = criar.mock.calls[0][0] as Blob
    expect(JSON.parse(await blob.text())).toMatchObject({ materias: [{ id: 'poo', nome: 'POO' }] })
    expect(screen.getByText(/Backup baixado: painel-estudos-\d{4}-\d{2}-\d{2}\.json\./)).toBeInTheDocument()
  })

  it('adiciona ao painel o JSON da IA, mesmo com texto e bloco de código em volta', async () => {
    const nav = montar()
    await colar(`Aqui está:\n\`\`\`json\n${JSON.stringify(EXEMPLO_IA)}\n\`\`\`\nAtenção: confira as datas.`)

    // Anunciado ao leitor de tela, e não só mostrado na prévia.
    expect(anuncioImportar()).toHaveTextContent('Encontrado: 1 matéria e 2 eventos na agenda.')
    expect(within(importar()).getByText('Estruturas de Dados')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Adicionar ao painel' }))

    const dados = salvos(nav)
    expect(dados.materias.map((m) => m.nome)).toEqual(['POO', 'Estruturas de Dados'])
    expect(dados.eventos.every((e) => e.materiaId === dados.materias[1].id)).toBe(true)
    expect(screen.getByText('Adicionado ao painel: 1 matéria e 2 eventos na agenda.')).toBeInTheDocument()
    expect(screen.getByLabelText('Ou cole o JSON aqui')).toHaveValue('')
    expect(screen.getByRole('heading', { name: 'Importar' })).toHaveFocus()
  })

  it('avisa quando a matéria já existe no painel', async () => {
    montar()
    await colar(JSON.stringify({ materias: [{ nome: 'poo', ras: [] }] }))
    expect(screen.getByText(/Já existe no painel: poo/)).toBeInTheDocument()
  })

  it('pede confirmação antes de substituir o que já existe', async () => {
    const nav = montar()
    const backup: Dados = { ...dadosVazios(), materias: [{ ...POO, id: 'filo', nome: 'Filosofia' }] }
    await colar(textoExportacao(backup))

    await user.click(screen.getByRole('button', { name: 'Substituir tudo' }))
    expect(screen.getByText(/Isto apaga 1 matéria e 0 eventos na agenda/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar substituição' })).toHaveFocus()
    expect(nav.itens.has(CHAVE)).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Substituir tudo' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Substituir tudo' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar substituição' }))
    expect(salvos(nav)).toEqual(backup)
  })

  it('substitui sem perguntar quando o painel está vazio', async () => {
    const nav = montar([])
    await colar(textoExportacao({ ...dadosVazios(), materias: [POO] }))
    await user.click(screen.getByRole('button', { name: 'Substituir tudo' }))
    expect(salvos(nav).materias).toHaveLength(1)
  })

  it('lê o arquivo escolhido', async () => {
    montar()
    const backup = textoExportacao({ ...dadosVazios(), materias: [POO, { ...POO, id: 'b', nome: 'B' }] })
    const arquivo = new File([backup], 'backup.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Escolher arquivo'), arquivo)
    await waitFor(() => expect(anuncioImportar()).toHaveTextContent('Encontrado: 2 matérias e 0 eventos'))
  })

  it('recusa arquivo grande demais sem tentar ler', async () => {
    montar()
    const grande = new File(['x'], 'video.mp4')
    Object.defineProperty(grande, 'size', { value: TAMANHO_MAXIMO_IMPORTACAO + 1 })
    const ler = vi.spyOn(grande, 'text')
    // applyAccept é opção do setup: com ela ligada, o arquivo nem chegaria ao campo.
    const semFiltro = criarUsuario({ applyAccept: false })
    await semFiltro.upload(screen.getByLabelText('Escolher arquivo'), grande)
    expect(screen.getByRole('alert')).toHaveTextContent('"video.mp4" é grande demais')
    expect(ler).not.toHaveBeenCalled()
  })

  it('não deixa importar quando nada seria salvo', async () => {
    const nav = navegador()
    render(
      <ProvedorPainel
        inicial={{ dados: { ...dadosVazios(), materias: [POO] }, aviso: null, podeSalvar: false }}
        armazenamento={nav}
      >
        <TelaDados />
      </ProvedorPainel>,
    )
    await colar(JSON.stringify(EXEMPLO_IA))
    const adicionar = screen.getByRole('button', { name: 'Adicionar ao painel' })
    expect(adicionar).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Substituir tudo' })).toBeDisabled()
    expect(adicionar).toHaveAccessibleDescription(/não está salvando os dados/)
  })

  it('avisa que a regra padrão também muda ao substituir por um backup com outra regra', async () => {
    montar()
    const outra = { mediaMinima: 6, frequenciaMinima: 0.75, arredondarUmaCasa: false }
    await colar(textoExportacao({ ...dadosVazios(), regraPadrao: outra, materias: [POO] }))
    await user.click(screen.getByRole('button', { name: 'Substituir tudo' }))
    expect(screen.getByText(/A regra padrão de aprovação também passa a ser a do arquivo/)).toBeInTheDocument()
  })

  it('mostra o erro ligado ao campo e não muda nada', async () => {
    const nav = montar()
    await colar('{"materias": [{"ras": []}]}')
    const campo = screen.getByLabelText('Ou cole o JSON aqui')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Não deu para importar: Matéria 1')
    expect(screen.queryByRole('button', { name: 'Adicionar ao painel' })).not.toBeInTheDocument()
    expect(nav.itens.has(CHAVE)).toBe(false)
  })

  it('adiciona o exemplo sem apagar o que já existe', async () => {
    const nav = montar()
    await user.click(screen.getByRole('button', { name: 'Adicionar dados de exemplo' }))
    expect(salvos(nav).materias.map((m) => m.nome)).toEqual([
      'POO',
      'Estruturas de Dados',
      'Programação Orientada a Objetos',
      'Cálculo Numérico',
    ])
    expect(screen.getByText('Adicionadas 3 matérias de exemplo e os eventos delas.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Exemplo e recomeço' })).toHaveFocus()

    // Uma segunda vez duplicaria tudo: o botão fica desativado e diz por quê.
    const botao = screen.getByRole('button', { name: 'Adicionar dados de exemplo' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAccessibleDescription('O exemplo já está no painel.')
  })

  it('cancelar o "Apagar tudo" não apaga nada e devolve o foco', async () => {
    const nav = montar()
    const secao = screen.getByRole('region', { name: 'Exemplo e recomeço' })
    await user.click(within(secao).getByRole('button', { name: 'Apagar tudo' }))
    await user.click(within(secao).getByRole('button', { name: 'Cancelar' }))
    expect(within(secao).getByRole('button', { name: 'Apagar tudo' })).toHaveFocus()
    expect(within(secao).queryByText(/Isto apaga/)).not.toBeInTheDocument()
    expect(nav.itens.has(CHAVE)).toBe(false)
  })

  it('apaga tudo depois de confirmar, mantendo a regra padrão', async () => {
    const nav = navegador()
    const regra = { mediaMinima: 6, frequenciaMinima: 0.75, arredondarUmaCasa: false }
    render(
      <ProvedorPainel
        inicial={{ dados: { ...dadosVazios(), regraPadrao: regra, materias: [POO] }, aviso: null, podeSalvar: true }}
        armazenamento={nav}
      >
        <TelaDados />
      </ProvedorPainel>,
    )
    const secao = screen.getByRole('region', { name: 'Exemplo e recomeço' })
    await user.click(within(secao).getByRole('button', { name: 'Apagar tudo' }))
    expect(within(secao).getByText(/Isto apaga 1 matéria e 0 eventos na agenda/)).toBeInTheDocument()
    expect(within(secao).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    expect(nav.itens.has(CHAVE)).toBe(false)

    await user.click(within(secao).getByRole('button', { name: 'Apagar tudo' }))
    expect(salvos(nav)).toEqual({ ...dadosVazios(), regraPadrao: regra })
    expect(screen.getByRole('heading', { name: 'Exemplo e recomeço' })).toHaveFocus()
    // Com o painel vazio, não há o que apagar.
    expect(within(secao).queryByRole('button', { name: 'Apagar tudo' })).not.toBeInTheDocument()
  })

  it('copia as instruções para a IA', async () => {
    montar()
    await user.click(screen.getByRole('button', { name: 'Copiar instruções para uma IA' }))
    expect(await navigator.clipboard.readText()).toBe(INSTRUCOES_IA)
    expect(screen.getByText(/Instruções copiadas/)).toBeInTheDocument()
  })

  it('sem acesso à área de transferência, abre o texto para copiar à mão', async () => {
    montar()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('bloqueado'))
    await user.click(screen.getByRole('button', { name: 'Copiar instruções para uma IA' }))
    // A recusa da área de transferência chega depois do clique (é uma promessa).
    expect(await screen.findByText(/Não deu para copiar sozinho/)).toBeInTheDocument()
    expect(screen.getByText('Ver as instruções').closest('details')).toHaveAttribute('open')
  })
})

describe('TelaDados: regra padrão', () => {
  const PROPRIA: RegraAprovacao = { mediaMinima: 6, frequenciaMinima: 0.7, arredondarUmaCasa: true }
  const SEIS: RegraAprovacao = { mediaMinima: 6, frequenciaMinima: 0.75, arredondarUmaCasa: false }

  function montarRegra(opcoes: { materias?: Materia[]; regraPadrao?: RegraAprovacao; podeSalvar?: boolean } = {}) {
    const { materias = [POO], regraPadrao = REGRA_PUCPR, podeSalvar = true } = opcoes
    const nav = navegador()
    render(
      <ProvedorPainel
        inicial={{ dados: { ...dadosVazios(), materias, regraPadrao }, aviso: null, podeSalvar }}
        armazenamento={nav}
      >
        <TelaDados />
      </ProvedorPainel>,
    )
    return nav
  }

  const secao = () => screen.getByRole('region', { name: 'Regra padrão de aprovação' })
  const botao = (nome: string | RegExp) => within(secao()).getByRole('button', { name: nome })
  const editar = () => user.click(botao('Editar regra padrão'))

  it('mostra a regra atual e para quantas matérias ela vale', () => {
    const materias = [
      POO,
      { ...POO, id: 'b', nome: 'B' },
      { ...POO, id: 'c', nome: 'C', regra: PROPRIA },
      { ...POO, id: 'd', nome: 'D' },
    ]
    montarRegra({ materias })
    expect(secao()).toHaveTextContent('Toda matéria sem regra própria segue esta regra.')
    expect(secao()).toHaveTextContent('Vale para 3 das 4 matérias (a outra tem regra própria).')
    expect(secao()).toHaveTextContent('Regra da PUC-PR')
    expect(secao()).toHaveTextContent('Média mínima 7,0 e frequência mínima de 75%.')
    // Já é a da PUC-PR: não há para onde voltar.
    expect(within(secao()).queryByRole('button', { name: /Voltar para a regra/ })).not.toBeInTheDocument()
  })

  it.each([
    [[], 'Ainda não há matérias no painel.'],
    [[POO], 'Vale para a única matéria do painel.'],
    [[POO, { ...POO, id: 'b', nome: 'B' }], 'Vale para todas as 2 matérias do painel.'],
    [[{ ...POO, regra: PROPRIA }], 'Hoje não vale para nenhuma: a única matéria do painel tem regra própria.'],
    [
      [POO, { ...POO, id: 'b', nome: 'B', regra: PROPRIA }, { ...POO, id: 'c', nome: 'C', regra: PROPRIA }],
      'Vale para 1 das 3 matérias (as outras têm regra própria).',
    ],
  ] as [Materia[], string][])('conta as matérias afetadas: %#', (materias, texto) => {
    montarRegra({ materias })
    expect(secao()).toHaveTextContent(texto)
  })

  it('edita e salva a regra padrão', async () => {
    const nav = montarRegra()
    await editar()
    const media = within(secao()).getByLabelText('Média mínima')
    expect(media).toHaveValue('7')
    expect(media).toHaveFocus()
    await user.clear(media)
    await user.type(media, '6,5')
    await user.click(within(secao()).getByLabelText('Tem recuperação no fim do semestre'))
    await user.click(botao('Salvar'))

    expect(salvos(nav).regraPadrao).toEqual({ mediaMinima: 6.5, frequenciaMinima: 0.75, arredondarUmaCasa: false })
    expect(within(secao()).queryByLabelText('Média mínima')).not.toBeInTheDocument()
    expect(within(secao()).getByRole('status')).toHaveTextContent('Regra padrão salva.')
    expect(secao()).toHaveTextContent('Regra personalizada')
    expect(secao()).toHaveTextContent('Média mínima 6,5')
    expect(botao('Editar regra padrão')).toHaveFocus()
  })

  it('mostra o erro ligado ao campo e não salva', async () => {
    const nav = montarRegra()
    await editar()
    const frequencia = within(secao()).getByLabelText('Frequência mínima (%)')
    await user.clear(frequencia)
    await user.type(frequencia, '120')
    await user.click(botao('Salvar'))

    expect(frequencia).toHaveFocus()
    expect(frequencia).toHaveAttribute('aria-invalid', 'true')
    expect(frequencia).toHaveAccessibleDescription(/Informe a frequência mínima em %, de 0 a 100/)
    expect(nav.itens.has(CHAVE)).toBe(false)

    // Corrigir o campo tira o erro.
    await user.clear(frequencia)
    await user.type(frequencia, '80')
    expect(frequencia).not.toHaveAttribute('aria-invalid')
    await user.click(botao('Salvar'))
    expect(salvos(nav).regraPadrao.frequenciaMinima).toBe(0.8)
  })

  it('cancelar descarta o que foi mudado', async () => {
    const nav = montarRegra()
    await editar()
    const media = within(secao()).getByLabelText('Média mínima')
    await user.clear(media)
    await user.type(media, '5')
    await user.click(botao('Cancelar'))

    expect(nav.itens.has(CHAVE)).toBe(false)
    expect(secao()).toHaveTextContent('Média mínima 7,0')
    expect(botao('Editar regra padrão')).toHaveFocus()

    // Abrir de novo começa da regra salva, não do que foi descartado.
    await editar()
    expect(within(secao()).getByLabelText('Média mínima')).toHaveValue('7')
  })

  it('volta para a regra da PUC-PR depois de confirmar', async () => {
    const nav = montarRegra({ regraPadrao: SEIS })
    expect(secao()).toHaveTextContent('Regra personalizada')
    await user.click(botao('Voltar para a regra da PUC-PR'))
    expect(botao('Cancelar')).toHaveFocus()
    expect(nav.itens.has(CHAVE)).toBe(false)

    await user.click(botao('Cancelar'))
    expect(botao('Voltar para a regra da PUC-PR')).toHaveFocus()

    await user.click(botao('Voltar para a regra da PUC-PR'))
    await user.click(botao('Confirmar'))
    expect(salvos(nav).regraPadrao).toEqual(REGRA_PUCPR)
    expect(secao()).toHaveTextContent('Regra da PUC-PR')
    expect(within(secao()).queryByRole('button', { name: /Voltar para a regra/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Regra padrão de aprovação' })).toHaveFocus()
  })

  it('não deixa mudar a regra quando nada seria salvo', () => {
    montarRegra({ regraPadrao: SEIS, podeSalvar: false })
    expect(botao('Editar regra padrão')).toBeDisabled()
    expect(botao('Editar regra padrão')).toHaveAccessibleDescription(/não está salvando os dados/)
    expect(botao('Voltar para a regra da PUC-PR')).toBeDisabled()
  })

  it('não mexe na regra própria das matérias', async () => {
    const nav = montarRegra({ materias: [{ ...POO, regra: PROPRIA }] })
    await editar()
    await user.click(botao('Salvar'))
    expect(salvos(nav).materias[0].regra).toEqual(PROPRIA)
  })
})
