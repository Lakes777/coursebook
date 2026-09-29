import { emProducao } from '../servidor/producao'
import { cadastro } from '../servidor/rotas/cadastro'

// Função da Vercel para /api/cadastro. Todos os métodos vão para a mesma rota, que responde
// 405 aos que não aceita (assim a resposta é a nossa, em JSON, e não a da Vercel).
const tratar = emProducao(cadastro)
export const GET = tratar
export const POST = tratar
export const PUT = tratar
export const DELETE = tratar
