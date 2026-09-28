import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProvedorPainel } from '../../src/estado/ProvedorPainel'
import { CHAVE, dadosVazios } from '../../src/logica/armazenamento'
import { EXEMPLO_IA, INSTRUCOES_IA } from '../../src/logica/instrucoesIA'
import type { Dados, Materia } from '../../src/logica/tipos'
import { TAMANHO_MAXIMO_IMPORTACAO, textoExportacao } from '../../src/logica/transferencia'
import { TelaDados } from '../../src/telas/TelaDados'

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
  const user = userEvent.setup()
  const campo = screen.getByLabelText('Ou cole o JSON aqui')
  await user.click(campo)
  await user.paste(texto)
  await user.click(screen.getByRole('button', { name: 'Conferir' }))
  return user
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TelaDados', () => {
  it('baixa o backup com tudo o que está no painel', async () => {
    const criar = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:teste')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    montar()
    expect(screen.getByText(/Hoje o painel tem 1 matéria e 0 eventos na agenda/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Baixar backup (JSON)' }))

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
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar ao painel' }))

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
    const user = await colar(textoExportacao(backup))

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
    const user = await colar(textoExportacao({ ...dadosVazios(), materias: [POO] }))
    await user.click(screen.getByRole('button', { name: 'Substituir tudo' }))
    expect(salvos(nav).materias).toHaveLength(1)
  })

  it('lê o arquivo escolhido', async () => {
    montar()
    const backup = textoExportacao({ ...dadosVazios(), materias: [POO, { ...POO, id: 'b', nome: 'B' }] })
    const arquivo = new File([backup], 'backup.json', { type: 'application/json' })
    await userEvent.upload(screen.getByLabelText('Escolher arquivo'), arquivo)
    await waitFor(() => expect(anuncioImportar()).toHaveTextContent('Encontrado: 2 matérias e 0 eventos'))
  })

  it('recusa arquivo grande demais sem tentar ler', async () => {
    montar()
    const grande = new File(['x'], 'video.mp4')
    Object.defineProperty(grande, 'size', { value: TAMANHO_MAXIMO_IMPORTACAO + 1 })
    const ler = vi.spyOn(grande, 'text')
    await userEvent.upload(screen.getByLabelText('Escolher arquivo'), grande, { applyAccept: false })
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
    const user = await colar(textoExportacao({ ...dadosVazios(), regraPadrao: outra, materias: [POO] }))
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
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar dados de exemplo' }))
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
    const user = userEvent.setup()
    const nav = montar()
    const secao = screen.getByRole('region', { name: 'Exemplo e recomeço' })
    await user.click(within(secao).getByRole('button', { name: 'Apagar tudo' }))
    await user.click(within(secao).getByRole('button', { name: 'Cancelar' }))
    expect(within(secao).getByRole('button', { name: 'Apagar tudo' })).toHaveFocus()
    expect(within(secao).queryByText(/Isto apaga/)).not.toBeInTheDocument()
    expect(nav.itens.has(CHAVE)).toBe(false)
  })

  it('apaga tudo depois de confirmar, mantendo a regra padrão', async () => {
    const user = userEvent.setup()
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
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'Copiar instruções para uma IA' }))
    expect(await navigator.clipboard.readText()).toBe(INSTRUCOES_IA)
    expect(screen.getByText(/Instruções copiadas/)).toBeInTheDocument()
  })

  it('sem acesso à área de transferência, abre o texto para copiar à mão', async () => {
    const user = userEvent.setup()
    montar()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('bloqueado'))
    await user.click(screen.getByRole('button', { name: 'Copiar instruções para uma IA' }))
    expect(screen.getByText(/Não deu para copiar sozinho/)).toBeInTheDocument()
    expect(screen.getByText('Ver as instruções').closest('details')).toHaveAttribute('open')
  })
})
