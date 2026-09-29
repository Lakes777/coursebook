import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ClienteNuvem, RespostaConta, Resposta } from '../api/contrato'
import { usePainel } from '../estado/contexto'
import { CHAVE, dadosVazios, releer } from '../logica/armazenamento'
import type { Dados } from '../logica/tipos'
import { criarClienteNuvem } from './cliente'
import { apagarDoAparelho, CHAVE_NUVEM, type ArmazenamentoNuvem } from './conta'
import { ContextoNuvem, type Nuvem } from './contexto'
import { criarSincronizador, estadoInicial, type Sincronizador } from './sincronizador'

interface Props {
  /** A API; os testes passam uma falsa. Sem ele, a de verdade (fetch). */
  cliente?: ClienteNuvem
  /** O mesmo armazenamento do ProvedorPainel; os testes passam um falso. Sem ele, o localStorage. */
  armazenamento?: ArmazenamentoNuvem
  children: ReactNode
}

/** Com o localStorage bloqueado (o acesso lança), a conta vale só enquanto a aba estiver aberta. */
function armazenamentoPadrao(): ArmazenamentoNuvem {
  try {
    return localStorage
  } catch {
    const itens = new Map<string, string>()
    return {
      getItem: (chave) => itens.get(chave) ?? null,
      setItem: (chave, valor) => void itens.set(chave, valor),
      removeItem: (chave) => void itens.delete(chave),
      key: (i) => [...itens.keys()][i] ?? null,
      get length() {
        return itens.size
      },
    }
  }
}

/**
 * Liga o sincronizador (sincronizador.ts) ao painel: conta a ele quando os dados
 * mudam por uma ação desta aba, e chama a conferência ao abrir, ao voltar para a
 * aba e ao voltar a internet. Fica dentro do <ProvedorPainel>, que continua sendo
 * o dono dos dados e do localStorage. Sem conta guardada, não chama a API.
 */
export function ProvedorNuvem({ cliente: clienteProp, armazenamento: armazenamentoProp, children }: Props) {
  const painel = usePainel()
  const { dados, podeSalvar } = painel
  // Criados uma vez: trocar de cliente no meio não faz sentido, e o sincronizador depende deles.
  const [cliente] = useState(() => clienteProp ?? criarClienteNuvem())
  const [armazenamento] = useState(() => armazenamentoProp ?? armazenamentoPadrao())
  const [estado, setEstado] = useState(() => estadoInicial(armazenamento))

  // O painel de agora: o sincronizador decide depois de esperar a API, com os dados mais novos.
  const atual = useRef(painel)
  // Os dados que vieram da nuvem: quando chegam no painel, não são "mudança desta aba" para enviar.
  const adotados = useRef<Dados | null>(null)
  // Outra aba salvou (evento storage): a próxima troca dos dados é dela, e é ela quem envia.
  const deOutraAba = useRef(false)
  const anteriores = useRef(dados)
  // Criado no efeito (e não no desenho) para o StrictMode, que monta duas vezes, desligar o primeiro.
  const sinc = useRef<Sincronizador | null>(null)

  // Primeiro de todos os efeitos, para os de baixo já verem o painel novo.
  useEffect(() => {
    atual.current = painel
  }, [painel])

  useEffect(() => {
    // O StrictMode roda o efeito duas vezes: só conta a troca uma vez.
    if (dados === anteriores.current) return
    anteriores.current = dados
    if (deOutraAba.current) {
      deOutraAba.current = false
      return
    }
    if (dados === adotados.current) {
      // Consome a marca: o Desfazer pode trazer de volta este mesmo objeto mais tarde, e
      // aí ele é uma mudança desta aba (senão a nuvem ficaria sem o que o desfazer restaurou).
      adotados.current = null
      return
    }
    if (!podeSalvar) return
    sinc.current?.mudou()
  }, [dados, podeSalvar])

  useEffect(() => {
    const s = criarSincronizador({
      cliente,
      armazenamento,
      dados: () => atual.current.dados,
      podeSalvar: () => atual.current.podeSalvar,
      trocarDados(novos, desfazivel) {
        adotados.current = novos
        if (desfazivel) atual.current.despachar({ tipo: 'dados/substituir', dados: novos })
        else atual.current.sincronizar(novos)
      },
      aoMudar: setEstado,
    })
    sinc.current = s
    const aoGuardar = (e: StorageEvent) => {
      // Mesma condição do ProvedorPainel para trocar os dados (ele ignora o que não consegue ler).
      if ((e.key === CHAVE || e.key === null) && releer(armazenamento) !== null) deOutraAba.current = true
      if (e.key === CHAVE_NUVEM || e.key === null) s.releuConta()
    }
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void s.conferir()
    }
    const aoConectar = () => void s.conferir()
    window.addEventListener('storage', aoGuardar)
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('online', aoConectar)
    // Ao abrir. Sem conta, conferir() não faz nada.
    void s.conferir()
    return () => {
      window.removeEventListener('storage', aoGuardar)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('online', aoConectar)
      s.parar()
      sinc.current = null
    }
  }, [cliente, armazenamento])

  const { conta, situacao } = estado
  const nuvem = useMemo<Nuvem>(() => {
    /** Entrar e cadastrar terminam do mesmo jeito: a sincronização começa em segundo plano. */
    const aoEntrar = (r: Resposta<RespostaConta>) => {
      if (!r.ok) return r.erro
      void sinc.current?.entrou(r.valor.email)
      return null
    }
    return {
      conta,
      situacao,
      entrar: async (pedido) => aoEntrar(await cliente.entrar(pedido)),
      cadastrar: async (pedido) => aoEntrar(await cliente.cadastrar(pedido)),
      async sair(apagarDados) {
        const r = await cliente.sair()
        // Sem conseguir apagar a sessão no servidor, a conta continua: o cookie ainda valeria.
        if (!r.ok) return r.erro
        sinc.current?.esquecer()
        if (apagarDados) {
          apagarDoAparelho(armazenamento)
          // Sem desfazer (sincronizar), senão o "Desfazer" traria tudo de volta. O ProvedorPainel
          // grava o painel vazio em seguida: fica só a regra padrão da PUC-PR, nada da pessoa.
          const vazios = dadosVazios()
          adotados.current = vazios
          atual.current.sincronizar(vazios)
        }
        return null
      },
      async excluirConta(pedido) {
        const r = await cliente.excluirConta(pedido)
        if (!r.ok) return r.erro
        sinc.current?.esquecer()
        return null
      },
      resolver: (escolha) => void sinc.current?.resolver(escolha),
    }
  }, [conta, situacao, cliente, armazenamento])

  return <ContextoNuvem.Provider value={nuvem}>{children}</ContextoNuvem.Provider>
}
