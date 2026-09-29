import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dadosVazios } from '../../src/logica/armazenamento'
import type { Dados } from '../../src/logica/tipos'
import { CHAVE_NUVEM, lerConta, type ContaGuardada } from '../../src/nuvem/conta'
import { criarSincronizador, ESPERA_ENVIO_MS, type EstadoNuvem } from '../../src/nuvem/sincronizador'
import { comMaterias, navegador, NuvemFalsa } from './apoio'

interface Montagem {
  local?: Dados
  conta?: ContaGuardada
  nuvem?: NuvemFalsa
  podeSalvar?: boolean
  nav?: ReturnType<typeof navegador>
}

/** Um sincronizador com um "painel" de mentira: só a variável dos dados e a lista de trocas. */
function montar({ local = dadosVazios(), conta, nuvem = new NuvemFalsa(), podeSalvar = true, nav }: Montagem = {}) {
  nav ??= navegador(conta ? { [CHAVE_NUVEM]: JSON.stringify(conta) } : {})
  const painel = { dados: local, podeSalvar, trocas: [] as { dados: Dados; desfazivel: boolean }[] }
  const estados: EstadoNuvem[] = []
  const s = criarSincronizador({
    cliente: nuvem,
    armazenamento: nav,
    dados: () => painel.dados,
    podeSalvar: () => painel.podeSalvar,
    trocarDados(dados, desfazivel) {
      painel.dados = dados
      painel.trocas.push({ dados, desfazivel })
    },
    aoMudar: (e) => estados.push(e),
  })
  /** Uma ação feita no painel desta aba. */
  const mudar = (dados: Dados) => {
    painel.dados = dados
    s.mudou()
  }
  return { s, nav, nuvem, painel, mudar, conta: () => lerConta(nav), situacao: () => s.estado().situacao.tipo }
}

const conta = (campos: Partial<ContaGuardada> = {}): ContaGuardada => ({
  email: 'andre@exemplo.com',
  revisao: 0,
  pendente: false,
  ...campos,
})

/** Nuvem que já tem estes dados, salvos `revisao` vezes. */
function nuvemCom(dados: Dados | null, revisao: number) {
  const nuvem = new NuvemFalsa()
  nuvem.dados = dados
  nuvem.revisao = revisao
  return nuvem
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('sincronizador', () => {
  it('sem conta, não chama a API para nada', async () => {
    const { s, nuvem, mudar } = montar()
    await s.conferir()
    mudar(comMaterias('POO'))
    await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS * 2)
    expect(nuvem.chamadas).toEqual([])
    expect(s.estado().conta).toBeNull()
  })

  it('ao abrir, com a mesma revisão e nada pendente, fica em dia', async () => {
    const dados = comMaterias('POO')
    const { s, nuvem, painel, situacao } = montar({
      local: dados,
      conta: conta({ revisao: 3 }),
      nuvem: nuvemCom(dados, 3),
    })
    expect(situacao()).toBe('conferindo')
    await s.conferir()
    expect(nuvem.chamadas).toEqual(['eu', 'baixar'])
    expect(situacao()).toBe('sincronizado')
    expect(painel.trocas).toEqual([])
  })

  it('ao abrir, com a nuvem mais nova e nada pendente, troca pelos da nuvem (sem desfazer)', async () => {
    const nova = comMaterias('POO', 'Cálculo')
    const { s, painel, conta: guardada } = montar({
      local: comMaterias('POO'),
      conta: conta({ revisao: 3 }),
      nuvem: nuvemCom(nova, 5),
    })
    await s.conferir()
    expect(painel.trocas).toEqual([{ dados: nova, desfazivel: false }])
    expect(guardada()).toEqual(conta({ revisao: 5 }))
  })

  it('envia 2 s depois da última mudança, com a revisão guardada', async () => {
    const { s, nuvem, mudar, conta: guardada, situacao } = montar({
      conta: conta({ revisao: 3 }),
      nuvem: nuvemCom(dadosVazios(), 3),
    })
    await s.conferir()
    nuvem.chamadas = []

    mudar(comMaterias('POO'))
    // Pendente já na hora: fechar a aba agora não perde a mudança.
    expect(guardada()?.pendente).toBe(true)
    expect(situacao()).toBe('salvando')
    await vi.advanceTimersByTimeAsync(1500)
    mudar(comMaterias('POO', 'BD'))
    await vi.advanceTimersByTimeAsync(1500)
    expect(nuvem.chamadas).toEqual([]) // a segunda mudança recomeçou a espera

    await vi.advanceTimersByTimeAsync(500)
    expect(nuvem.salvos).toEqual([{ dados: comMaterias('POO', 'BD'), revisao: 3 }])
    expect(guardada()).toEqual(conta({ revisao: 4 }))
    expect(situacao()).toBe('sincronizado')
  })

  it('mudança feita enquanto o envio ia continua pendente e vai no próximo', async () => {
    const { s, nuvem, mudar, conta: guardada } = montar({
      conta: conta({ revisao: 1 }),
      nuvem: nuvemCom(dadosVazios(), 1),
    })
    await s.conferir()
    nuvem.segurar()
    mudar(comMaterias('POO'))
    await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS)
    mudar(comMaterias('POO', 'BD'))
    nuvem.soltar()
    await vi.advanceTimersByTimeAsync(0)
    expect(guardada()).toEqual(conta({ revisao: 2, pendente: true }))

    await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS)
    expect(nuvem.salvos.map((p) => p.revisao)).toEqual([1, 2])
    expect(nuvem.dados).toEqual(comMaterias('POO', 'BD'))
    expect(guardada()).toEqual(conta({ revisao: 3 }))
  })

  it('sem conexão, fica pendente e envia quando conferir de novo (online ou volta para a aba)', async () => {
    const { s, nuvem, mudar, conta: guardada, situacao } = montar({ conta: conta(), nuvem: nuvemCom(null, 0) })
    await s.conferir()
    nuvem.online = false
    mudar(comMaterias('POO'))
    await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS)
    expect(situacao()).toBe('sem-conexao')
    expect(guardada()?.pendente).toBe(true)

    nuvem.online = true
    await s.conferir()
    expect(nuvem.dados).toEqual(comMaterias('POO'))
    expect(guardada()).toEqual(conta({ revisao: 1 }))
    expect(situacao()).toBe('sincronizado')
  })

  it('a mudança pendente sobrevive a recarregar a página', async () => {
    const nav = navegador({ [CHAVE_NUVEM]: JSON.stringify(conta({ revisao: 2, pendente: true })) })
    const nuvem = nuvemCom(dadosVazios(), 2)
    const { s } = montar({ nav, nuvem, local: comMaterias('POO') })
    await s.conferir()
    expect(nuvem.salvos).toEqual([{ dados: comMaterias('POO'), revisao: 2 }])
    expect(lerConta(nav)).toEqual(conta({ revisao: 3 }))
  })

  it('sessão acabada: avisa, mantém o pendente e não tenta enviar; entrar de novo envia', async () => {
    const nuvem = nuvemCom(dadosVazios(), 2)
    nuvem.logado = false
    const { s, mudar, conta: guardada, situacao } = montar({ conta: conta({ revisao: 2, pendente: true }), nuvem })
    await s.conferir()
    expect(situacao()).toBe('sem-sessao')
    expect(nuvem.chamadas).toEqual(['eu'])

    mudar(comMaterias('POO'))
    await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS)
    expect(nuvem.salvos).toEqual([])
    expect(guardada()?.pendente).toBe(true)

    nuvem.logado = true
    await s.entrou('Andre@Exemplo.com')
    // A mesma conta: não é "primeira vez", o pendente vai com a revisão que já tinha.
    expect(nuvem.salvos).toEqual([{ dados: comMaterias('POO'), revisao: 2 }])
    expect(situacao()).toBe('sincronizado')
  })

  it('401 no envio também vira "entre de novo"', async () => {
    const nuvem = nuvemCom(dadosVazios(), 0)
    const { s, mudar, situacao } = montar({ conta: conta(), nuvem })
    await s.conferir()
    nuvem.logado = false
    mudar(comMaterias('POO'))
    await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS)
    expect(situacao()).toBe('sem-sessao')
  })

  it('sessão de outra conta neste navegador conta como sem sessão', async () => {
    const nuvem = nuvemCom(null, 0)
    nuvem.email = 'outra@exemplo.com'
    const { s, situacao } = montar({ conta: conta(), nuvem })
    await s.conferir()
    expect(situacao()).toBe('sem-sessao')
  })

  it('erro da API fica na situação e tenta de novo na próxima mudança', async () => {
    const nuvem = nuvemCom(null, 0)
    const { s, mudar } = montar({ conta: conta(), nuvem })
    await s.conferir()
    nuvem.proximoErro = { status: 500, erro: { codigo: 'erro-interno', erro: 'Erro no servidor.' } }
    mudar(comMaterias('POO'))
    await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS)
    expect(s.estado().situacao).toEqual({ tipo: 'erro', mensagem: 'Erro no servidor.' })
    mudar(comMaterias('POO', 'BD'))
    await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS)
    expect(nuvem.dados).toEqual(comMaterias('POO', 'BD'))
  })

  describe('conflito', () => {
    /** Este aparelho mudou (pendente) e outro aparelho salvou na nuvem no meio. */
    async function emConflito() {
      const nuvem = nuvemCom(comMaterias('POO'), 1)
      const m = montar({ local: comMaterias('POO'), conta: conta({ revisao: 1 }), nuvem })
      await m.s.conferir()
      nuvem.outroAparelhoSalvou(comMaterias('POO', 'Cálculo'))
      m.mudar(comMaterias('POO', 'BD'))
      await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS)
      return m
    }

    it('409 com outros dados: para de enviar e pergunta', async () => {
      const { s, nuvem, mudar, conta: guardada } = await emConflito()
      expect(s.estado().situacao).toEqual({
        tipo: 'conflito',
        dados: comMaterias('POO', 'Cálculo'),
        revisao: 2,
        primeiraVez: false,
      })
      mudar(comMaterias('POO', 'BD', 'IA'))
      await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS * 2)
      expect(nuvem.salvos).toHaveLength(1)
      expect(guardada()?.pendente).toBe(true)
      // Voltar para a aba não baixa de novo (a pergunta piscaria).
      await s.conferir()
      expect(nuvem.chamadas.filter((c) => c === 'baixar')).toHaveLength(1)
    })

    it('"Usar a da nuvem" troca os dados com desfazer', async () => {
      const { s, painel, conta: guardada, situacao } = await emConflito()
      await s.resolver('nuvem')
      expect(painel.trocas).toEqual([{ dados: comMaterias('POO', 'Cálculo'), desfazivel: true }])
      expect(guardada()).toEqual(conta({ revisao: 2 }))
      expect(situacao()).toBe('sincronizado')
    })

    it('"Manter a deste aparelho" envia com a revisão da nuvem', async () => {
      const { s, nuvem, conta: guardada, situacao } = await emConflito()
      await s.resolver('aparelho')
      expect(nuvem.salvos.at(-1)).toEqual({ dados: comMaterias('POO', 'BD'), revisao: 2 })
      expect(nuvem.dados).toEqual(comMaterias('POO', 'BD'))
      expect(guardada()).toEqual(conta({ revisao: 3 }))
      expect(situacao()).toBe('sincronizado')
    })

    it('409 com os mesmos dados (duas abas enviaram igual): só adota a revisão, sem perguntar', async () => {
      const nuvem = nuvemCom(dadosVazios(), 1)
      const { s, mudar, conta: guardada, situacao } = montar({ conta: conta({ revisao: 1 }), nuvem })
      await s.conferir()
      nuvem.outroAparelhoSalvou(comMaterias('POO'))
      mudar(comMaterias('POO'))
      await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS)
      expect(situacao()).toBe('sincronizado')
      expect(guardada()).toEqual(conta({ revisao: 2 }))
    })

    it('ao abrir com pendente e a nuvem mais nova, pergunta', async () => {
      const nuvem = nuvemCom(comMaterias('Cálculo'), 4)
      const { s, situacao, painel } = montar({
        local: comMaterias('POO'),
        conta: conta({ revisao: 2, pendente: true }),
        nuvem,
      })
      await s.conferir()
      expect(situacao()).toBe('conflito')
      expect(painel.trocas).toEqual([])
      expect(nuvem.salvos).toEqual([])
    })
  })

  describe('primeira vez que entra', () => {
    it('nuvem vazia e aparelho com matérias: envia com revisão 0', async () => {
      const nuvem = nuvemCom(null, 0)
      const { s, conta: guardada } = montar({ local: comMaterias('POO'), nuvem })
      await s.entrou('andre@exemplo.com')
      expect(nuvem.salvos).toEqual([{ dados: comMaterias('POO'), revisao: 0 }])
      expect(guardada()).toEqual(conta({ revisao: 1 }))
    })

    it('aparelho vazio: usa os da nuvem', async () => {
      const { s, painel, conta: guardada } = montar({ nuvem: nuvemCom(comMaterias('POO'), 3) })
      await s.entrou('andre@exemplo.com')
      expect(painel.trocas).toEqual([{ dados: comMaterias('POO'), desfazivel: false }])
      expect(guardada()).toEqual(conta({ revisao: 3 }))
    })

    it('os dois com dados diferentes: pergunta, e a pergunta volta depois de recarregar', async () => {
      const nuvem = nuvemCom(comMaterias('Cálculo'), 3)
      const { s, nav, conta: guardada } = montar({ local: comMaterias('POO'), nuvem })
      await s.entrou('andre@exemplo.com')
      expect(s.estado().situacao).toMatchObject({ tipo: 'conflito', primeiraVez: true })
      expect(guardada()).toEqual(conta({ primeiraVez: true }))

      const depois = montar({ nav, local: comMaterias('POO'), nuvem })
      await depois.s.conferir()
      expect(depois.s.estado().situacao).toMatchObject({ tipo: 'conflito', primeiraVez: true })
    })

    it('"Substituir pelos deste aparelho" envia e passa da primeira vez', async () => {
      const nuvem = nuvemCom(comMaterias('Cálculo'), 3)
      const { s, conta: guardada } = montar({ local: comMaterias('POO'), nuvem })
      await s.entrou('andre@exemplo.com')
      await s.resolver('aparelho')
      expect(nuvem.dados).toEqual(comMaterias('POO'))
      expect(guardada()).toEqual(conta({ revisao: 4 }))
    })

    it('mudança antes de decidir a primeira vez confere de novo em vez de enviar direto', async () => {
      const nuvem = nuvemCom(comMaterias('Cálculo'), 3)
      nuvem.online = false
      const { s, mudar, situacao } = montar({ nuvem })
      await s.entrou('andre@exemplo.com')
      expect(situacao()).toBe('sem-conexao')
      nuvem.online = true
      mudar(comMaterias('POO'))
      await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS)
      expect(nuvem.salvos).toEqual([])
      expect(situacao()).toBe('conflito')
    })

    it('entrar com outra conta começa do zero (primeira vez da conta nova)', async () => {
      const nuvem = nuvemCom(null, 0)
      const { s, conta: guardada } = montar({
        conta: conta({ revisao: 7, pendente: true }),
        nuvem,
        local: dadosVazios(),
      })
      nuvem.email = 'outra@exemplo.com'
      await s.entrou('outra@exemplo.com')
      expect(guardada()).toEqual({ email: 'outra@exemplo.com', revisao: 0, pendente: false })
    })
  })

  it('sem poder salvar neste navegador, não envia nem troca os dados', async () => {
    const nuvem = nuvemCom(comMaterias('Cálculo'), 5)
    const { s, painel, mudar, situacao } = montar({ conta: conta({ revisao: 1 }), nuvem, podeSalvar: false })
    await s.conferir()
    mudar(comMaterias('POO'))
    await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS)
    expect(painel.trocas).toEqual([])
    expect(nuvem.chamadas).toEqual([])
    expect(situacao()).toBe('parado')
  })

  it('esquecer apaga a conta e ignora a resposta que ainda estava vindo', async () => {
    const nuvem = nuvemCom(comMaterias('Cálculo'), 5)
    nuvem.segurar()
    const { s, painel, nav } = montar({ conta: conta({ revisao: 1 }), nuvem })
    const conferindo = s.conferir()
    s.esquecer()
    nuvem.soltar()
    await conferindo
    expect(nav.itens.has(CHAVE_NUVEM)).toBe(false)
    expect(painel.trocas).toEqual([])
  })

  describe('duas abas', () => {
    it('a outra aba resolveu o mesmo conflito: a pergunta some aqui', async () => {
      const nuvem = nuvemCom(comMaterias('Cálculo'), 4)
      const { s, nav, situacao } = montar({
        local: comMaterias('POO'),
        conta: conta({ revisao: 2, pendente: true }),
        nuvem,
      })
      await s.conferir()
      expect(situacao()).toBe('conflito')
      nav.setItem(CHAVE_NUVEM, JSON.stringify(conta({ revisao: 5 })))
      s.releuConta()
      expect(situacao()).toBe('sincronizado')
      expect(s.estado().conta).toEqual(conta({ revisao: 5 }))
    })

    it('a próxima mudança daqui usa a revisão que a outra aba salvou', async () => {
      const nuvem = nuvemCom(dadosVazios(), 1)
      const { s, nav, mudar } = montar({ conta: conta({ revisao: 1 }), nuvem })
      await s.conferir()
      nuvem.outroAparelhoSalvou(comMaterias('POO'))
      nav.setItem(CHAVE_NUVEM, JSON.stringify(conta({ revisao: 2 })))
      s.releuConta()
      mudar(comMaterias('POO', 'BD'))
      await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS)
      expect(nuvem.salvos).toEqual([{ dados: comMaterias('POO', 'BD'), revisao: 2 }])
    })

    it('não apaga o pendente que outra aba marcou enquanto o envio daqui ia', async () => {
      const nuvem = nuvemCom(null, 0)
      nuvem.segurar()
      const { s, nav, conta: guardada, situacao } = montar({ local: comMaterias('POO'), nuvem })
      const entrando = s.entrou('andre@exemplo.com')
      await vi.advanceTimersByTimeAsync(0)
      // A outra aba mudou algo e marcou pendente; o evento storage ainda não chegou aqui.
      nav.setItem(CHAVE_NUVEM, JSON.stringify(conta({ pendente: true, primeiraVez: true })))
      nuvem.soltar()
      await entrando
      expect(nuvem.dados).toEqual(comMaterias('POO'))
      expect(guardada()).toEqual(conta({ revisao: 1, pendente: true }))
      expect(situacao()).toBe('salvando')
    })

    it('esta aba sem sessão: quando a outra entra de novo, confere daqui também', async () => {
      const nuvem = nuvemCom(dadosVazios(), 1)
      nuvem.logado = false
      const { s, nav, situacao } = montar({
        conta: conta({ revisao: 1, pendente: true }),
        nuvem,
        local: comMaterias('POO'),
      })
      await s.conferir()
      expect(situacao()).toBe('sem-sessao')
      nuvem.logado = true
      nav.setItem(CHAVE_NUVEM, JSON.stringify(conta({ revisao: 1, pendente: true })))
      s.releuConta()
      await vi.advanceTimersByTimeAsync(0)
      expect(nuvem.dados).toEqual(comMaterias('POO'))
      expect(situacao()).toBe('sincronizado')
    })

    it('"Manter a deste aparelho" é descartado se a conta mudou antes da vez dele', async () => {
      const nuvem = nuvemCom(comMaterias('Cálculo'), 4)
      const { s, nav, situacao } = montar({
        local: comMaterias('POO'),
        conta: conta({ revisao: 2, pendente: true }),
        nuvem,
      })
      await s.conferir()
      expect(situacao()).toBe('conflito')
      const escolha = s.resolver('aparelho')
      // Antes da tarefa rodar (ela espera a fila), outra aba entra com outra conta.
      nav.setItem(CHAVE_NUVEM, JSON.stringify(conta({ email: 'outra@exemplo.com' })))
      s.releuConta()
      await escolha
      expect(nuvem.salvos).toEqual([])
    })

    it('a outra aba saiu da conta: esta também fica sem conta', async () => {
      const { s, nav, nuvem, mudar } = montar({ conta: conta(), nuvem: nuvemCom(null, 0) })
      await s.conferir()
      nav.removeItem(CHAVE_NUVEM)
      s.releuConta()
      expect(s.estado().conta).toBeNull()
      nuvem.chamadas = []
      mudar(comMaterias('POO'))
      await vi.advanceTimersByTimeAsync(ESPERA_ENVIO_MS)
      expect(nuvem.chamadas).toEqual([])
    })
  })
})
