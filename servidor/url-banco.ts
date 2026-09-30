/**
 * A DATABASE_URL da Vercel é gerenciada pela integração Neon, que a atualiza sozinha
 * quando a senha é trocada, mas aponta para o banco padrão (neondb), que é do Controle
 * de Gastos. Com NOME_DO_BANCO, troca só o nome do banco no fim do endereço e mantém
 * usuário, senha e servidor; sem ele, a URL vale como veio.
 */
export function urlDoBanco(url: string, nomeDoBanco?: string): string {
  const nome = nomeDoBanco?.trim()
  if (!nome) return url
  const endereco = new URL(url)
  endereco.pathname = '/' + encodeURIComponent(nome)
  return endereco.toString()
}
