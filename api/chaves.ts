import { emProducao } from '../servidor/producao'
import { chaves } from '../servidor/rotas/chaves'

// Função da Vercel para /api/chaves. Todos os métodos vão para a mesma rota, que responde
// 405 aos que não aceita (assim a resposta é a nossa, em JSON, e não a da Vercel).
const tratar = emProducao(chaves)
export const GET = tratar
export const POST = tratar
export const PUT = tratar
export const DELETE = tratar
