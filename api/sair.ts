import { emProducao } from '../servidor/producao'
import { sair } from '../servidor/rotas/sair'

// Função da Vercel para /api/sair. Todos os métodos vão para a mesma rota, que responde
// 405 aos que não aceita (assim a resposta é a nossa, em JSON, e não a da Vercel).
const tratar = emProducao(sair)
export const GET = tratar
export const POST = tratar
export const PUT = tratar
export const DELETE = tratar
