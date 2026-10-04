// As tabelas da nuvem no Postgres (Neon em produção, PGlite nos testes e no
// `npm run dev`). Tudo com IF NOT EXISTS: aplicar de novo não muda nada.

export const ESQUEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  -- "u_" + 32 caracteres hexadecimais (16 bytes aleatórios).
  id TEXT PRIMARY KEY,
  -- Como a pessoa digitou (sem espaços nas pontas); a comparação usa lower(email).
  email TEXT NOT NULL,
  -- argon2id, no formato PHC ("$argon2id$v=19$m=...").
  senha_hash TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email ON usuarios (lower(email));

CREATE TABLE IF NOT EXISTS sessoes (
  -- SHA-256 (hex) do token do cookie: quem ler o banco não consegue entrar.
  token_hash TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessoes_usuario ON sessoes (usuario_id);

-- Senhas erradas, para bloquear depois de LIMITES.tentativasLogin na janela.
CREATE TABLE IF NOT EXISTS tentativas_login (
  id BIGSERIAL PRIMARY KEY,
  -- lower(email) do pedido, exista a conta ou não.
  email TEXT NOT NULL,
  em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tentativas_login_email ON tentativas_login (email, em);

-- Os dados do painel de cada conta: o mesmo objeto Dados do localStorage.
CREATE TABLE IF NOT EXISTS paineis (
  usuario_id TEXT PRIMARY KEY REFERENCES usuarios (id) ON DELETE CASCADE,
  dados JSONB NOT NULL,
  -- Aumenta de 1 em 1 a cada gravação; o PUT só grava se o aparelho mandar a atual.
  revisao INTEGER NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chaves de acesso: para programas da própria pessoa (o bot do Telegram) lerem os
-- prazos sem guardar a senha. Como nas sessões, o token fica só com quem criou.
CREATE TABLE IF NOT EXISTS chaves_acesso (
  -- "k_" + 32 caracteres hexadecimais (16 bytes aleatórios).
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  -- SHA-256 (hex) do token "cb_...": a busca é pelo hash, no índice único.
  token_hash TEXT NOT NULL UNIQUE,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Última vez que abriu os prazos; null se nunca.
  usada_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS chaves_acesso_usuario ON chaves_acesso (usuario_id);
`
