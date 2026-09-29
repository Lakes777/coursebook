import { emProducao } from '../servidor/producao'
import { entrar } from '../servidor/rotas/entrar'

// Função da Vercel para /api/entrar. Todos os métodos vão para a mesma rota, que responde
// 405 aos que não aceita (assim a resposta é a nossa, em JSON, e não a da Vercel).
const tratar = emProducao(entrar)
export const GET = tratar
export const POST = tratar
export const PUT = tratar
export const DELETE = tratar
