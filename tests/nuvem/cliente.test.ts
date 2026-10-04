import { describe, expect, it, vi } from 'vitest'
import { ROTAS } from '../../src/api/contrato'
import { dadosVazios } from '../../src/logica/armazenamento'
import { criarClienteNuvem } from '../../src/nuvem/cliente'

/** fetch falso que devolve sempre a mesma resposta e guarda os pedidos. */
function servidor(status: number, corpo?: unknown) {
  const buscar = vi.fn(async (_rota: string, _init: RequestInit) =>
    corpo === undefined
      ? new Response(null, { status })
      : new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
  )
  return { buscar, cliente: criarClienteNuvem(buscar) }
}

const erro = (codigo: string, mensagem = 'Mensagem da API.') => ({ codigo, erro: mensagem })

describe('criarClienteNuvem', () => {
  it('entra mandando JSON para a rota, com o cookie do mesmo domínio', async () => {
    const { buscar, cliente } = servidor(200, { email: 'a@b.com' })
    expect(await cliente.entrar({ email: 'a@b.com', senha: '12345678' })).toEqual({
      ok: true,
      valor: { email: 'a@b.com' },
    })
    const [rota, init] = buscar.mock.calls[0]
    expect(rota).toBe(ROTAS.entrar)
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.com', senha: '12345678' })
  })

  it('não manda Content-Type nem corpo quando o pedido não tem corpo', async () => {
    const { buscar, cliente } = servidor(204)
    expect(await cliente.sair()).toEqual({ ok: true, valor: null })
    const [rota, init] = buscar.mock.calls[0]
    expect(rota).toBe(ROTAS.sair)
    expect(init.headers).toBeUndefined()
    expect(init.body).toBeUndefined()
  })

  it('exclui a conta com DELETE e a senha', async () => {
    const { buscar, cliente } = servidor(204)
    expect(await cliente.excluirConta({ senha: 'segredo123' })).toEqual({ ok: true, valor: null })
    expect(buscar.mock.calls[0][0]).toBe(ROTAS.conta)
    expect(buscar.mock.calls[0][1].method).toBe('DELETE')
  })

  it('devolve o erro da API como veio', async () => {
    const { cliente } = servidor(401, erro('credenciais', 'E-mail ou senha errados.'))
    expect(await cliente.entrar({ email: 'a@b.com', senha: 'x' })).toEqual({
      ok: false,
      status: 401,
      erro: { codigo: 'credenciais', erro: 'E-mail ou senha errados.' },
    })
  })

  it('fetch que lança vira "sem conexão"', async () => {
    const cliente = criarClienteNuvem(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await cliente.baixar()).toEqual({
      ok: false,
      status: 0,
      erro: { codigo: 'sem-conexao', erro: 'Sem conexão com a internet.' },
    })
  })

  it('resposta que não é JSON (ex.: página de erro em HTML) vira erro interno', async () => {
    const { cliente } = servidor(502, '<html>Bad gateway</html>')
    const r = await cliente.eu()
    expect(r).toMatchObject({ ok: false, status: 502, erro: { codigo: 'erro-interno' } })
  })

  it('JSON sem o formato esperado também vira erro interno', async () => {
    expect(await servidor(200, { revisao: 'três' }).cliente.salvar({ dados: dadosVazios(), revisao: 0 })).toMatchObject(
      { ok: false, erro: { codigo: 'erro-interno' } },
    )
    const semFormato = await servidor(500, { mensagem: 'x' }).cliente.eu()
    expect(semFormato).toMatchObject({ ok: false, erro: { codigo: 'erro-interno' } })
  })

  it('eu() sem sessão é "ninguém logado", e não um erro', async () => {
    expect(await servidor(401, erro('sem-sessao')).cliente.eu()).toEqual({ ok: true, valor: null })
    expect(await servidor(200, { email: 'a@b.com' }).cliente.eu()).toEqual({ ok: true, valor: { email: 'a@b.com' } })
  })

  it('baixa e confere os dados da nuvem', async () => {
    const dados = dadosVazios()
    const baixado = await servidor(200, { dados, revisao: 4 }).cliente.baixar()
    expect(baixado).toEqual({ ok: true, valor: { dados, revisao: 4 } })
    expect(await servidor(200, { dados: null, revisao: 0 }).cliente.baixar()).toEqual({
      ok: true,
      valor: { dados: null, revisao: 0 },
    })
  })

  it('recusa dados da nuvem que este site não consegue ler (ex.: versão mais nova)', async () => {
    const r = await servidor(200, { dados: { ...dadosVazios(), versao: 99 }, revisao: 2 }).cliente.baixar()
    expect(r).toMatchObject({ ok: false, erro: { codigo: 'dados-invalidos' } })
    if (!r.ok) expect(r.erro.erro).toMatch(/^Não deu para ler os dados da nuvem \(.*versão 99.*\)\.$/)
  })

  it('salva com PUT e devolve a revisão nova', async () => {
    const { buscar, cliente } = servidor(200, { revisao: 3 })
    expect(await cliente.salvar({ dados: dadosVazios(), revisao: 2 })).toEqual({ ok: true, valor: { revisao: 3 } })
    expect(buscar.mock.calls[0][1].method).toBe('PUT')
    expect(JSON.parse(buscar.mock.calls[0][1].body as string).revisao).toBe(2)
  })

  it('no conflito, devolve o que está na nuvem', async () => {
    const dados = dadosVazios()
    const { cliente } = servidor(409, { ...erro('conflito', 'Outro aparelho salvou antes.'), dados, revisao: 7 })
    const r = await cliente.salvar({ dados, revisao: 2 })
    expect(r).toEqual({
      ok: false,
      status: 409,
      erro: { codigo: 'conflito', erro: 'Outro aparelho salvou antes.', dados, revisao: 7 },
    })
  })

  it('conflito com dados ilegíveis não chega como conflito (a sincronização não saberia comparar)', async () => {
    const r = await servidor(409, { ...erro('conflito'), dados: { versao: 99 }, revisao: 7 }).cliente.salvar({
      dados: dadosVazios(),
      revisao: 2,
    })
    expect(r).toMatchObject({ ok: false, erro: { codigo: 'dados-invalidos' } })
  })

  describe('chaves de acesso', () => {
    const chave = { id: 'k_1', nome: 'Bot', criadaEm: '2026-10-04T12:00:00.000Z', usadaEm: null }

    it('lista com GET e confere o formato', async () => {
      const { buscar, cliente } = servidor(200, { chaves: [chave] })
      expect(await cliente.listarChaves()).toEqual({ ok: true, valor: { chaves: [chave] } })
      expect(buscar.mock.calls[0][0]).toBe(ROTAS.chaves)
      expect(buscar.mock.calls[0][1].method).toBe('GET')
      const torta = await servidor(200, { chaves: [{ ...chave, usadaEm: 3 }] }).cliente.listarChaves()
      expect(torta).toMatchObject({ ok: false, erro: { codigo: 'erro-interno' } })
    })

    it('cria com POST e o nome, e devolve o token', async () => {
      const { buscar, cliente } = servidor(201, { chave, token: 'cb_abc' })
      expect(await cliente.criarChave({ nome: 'Bot' })).toEqual({ ok: true, valor: { chave, token: 'cb_abc' } })
      expect(buscar.mock.calls[0][1].method).toBe('POST')
      expect(JSON.parse(buscar.mock.calls[0][1].body as string)).toEqual({ nome: 'Bot' })
      const semToken = await servidor(201, { chave }).cliente.criarChave({ nome: 'Bot' })
      expect(semToken).toMatchObject({ ok: false, erro: { codigo: 'erro-interno' } })
    })

    it('apaga com DELETE e o id no endereço', async () => {
      const { buscar, cliente } = servidor(204)
      expect(await cliente.apagarChave('k_1 2')).toEqual({ ok: true, valor: null })
      expect(buscar.mock.calls[0][0]).toBe('/api/chaves?id=k_1%202')
      expect(buscar.mock.calls[0][1].method).toBe('DELETE')
    })
  })
})
