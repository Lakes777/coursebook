import { emProducao } from '../servidor/producao'
import { eu } from '../servidor/rotas/eu'

// Função da Vercel para /api/eu. Todos os métodos vão para a mesma rota, que responde
// 405 aos que não aceita (assim a resposta é a nossa, em JSON, e não a da Vercel).
const tratar = emProducao(eu)
export const GET = tratar
export const POST = tratar
export const PUT = tratar
export const DELETE = tratar
