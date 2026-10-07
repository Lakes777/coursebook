# Nuvem do painel: como funciona

O painel continua funcionando sem conta, só no navegador, como sempre. Quem entra
numa conta passa a ter os dados guardados na nuvem e sincronizados entre aparelhos.

- Formatos e rotas: `src/api/contrato.ts` (o site e a API importam de lá).
- Tabelas: `servidor/esquema.ts`.

## Peças

| Onde | O quê |
| --- | --- |
| `api/*.ts` | Uma função da Vercel por rota, bem fina: monta o contexto de produção e chama `servidor/`. |
| `servidor/` | A API de verdade: rotas como funções `(Request, Contexto) => Promise<Response>`, contas, sessões, banco. Testável sem Vercel. |
| `src/api/contrato.ts` | Rotas, tipos dos pedidos e respostas, códigos de erro, limites, `ClienteNuvem`. |
| `src/nuvem/` | O lado do site: cliente com fetch, sincronização, telas da conta. |
| Neon | Postgres em produção (`DATABASE_URL`). |
| PGlite | Postgres dentro do Node: testes e `npm run dev`. |

O `package.json` não tem `"type": "module"`: a Vercel compila cada arquivo de `api/`
separado, e em ESM os imports sem extensão (o estilo do projeto) quebram em produção.
Em CommonJS eles funcionam (conferido com `vercel build`).

O `tsconfig.json` da raiz só tem `references` para o `tsc -b`, mas também tem
`compilerOptions`: é ele que o `vercel build` usa para compilar `api/`. O `module`
tem que ser `nodenext`: sem `module`, a Vercel desliga o `strict` (e aponta erros de
tipo que não existem); com `esnext`, ela gera ESM, e os imports sem extensão quebram.
Com `nodenext` e sem `"type": "module"`, sai CommonJS, conferido com strict.

## API

### Contexto

As rotas recebem um `Contexto` em vez de ler variáveis de ambiente, para os testes
controlarem tudo:

- `banco`: `consultar(sql, parametros)` que devolve as linhas. Em produção, o driver
  do Neon (`@neondatabase/serverless`, HTTP); nos testes, PGlite. Cada gravação é um
  comando SQL só (atômico), então não precisa de transação interativa.
- `agora()`: a hora atual (os testes fixam).
- `convite`: o `CODIGO_CONVITE`, ou undefined (cadastro fechado).
- `seguro`: se o cookie leva `Secure` (false só em http://localhost).

O esquema é aplicado uma vez por instância, na primeira **consulta** ao banco (não na
primeira chamada: o `/api/eu` sem cookie responde sem tocar no banco), com
`IF NOT EXISTS`, comando a comando (o driver HTTP do Neon roda um por vez).

### Contas e sessões

- **Cadastro**: confere o convite (comparação em tempo constante, com limite de
  chutes: ver o bloqueio abaixo), o e-mail (até 254, só ASCII, tem `@`, sem espaço)
  e a senha (8 a 200 caracteres). Senha com argon2id
  (`@node-rs/argon2`, parâmetros padrão). Id `u_` + 16 bytes aleatórios em hex.
  E-mail repetido (sem diferenciar maiúsculas): 409 `email-em-uso`. Já cria a sessão.
- **Sessão**: token de 32 bytes aleatórios (base64url) no cookie `sessao`
  (HttpOnly, SameSite=Lax, Path=/, Max-Age 30 dias, Secure se `seguro`). O banco
  guarda só o SHA-256 do token. Sessão vencida conta como sem sessão (e é apagada).
- **Entrar**: e-mail ou senha errados dão sempre 401 `credenciais`, com a mesma
  mensagem e mais ou menos o mesmo tempo (e-mail que não existe também roda um
  verify contra um hash falso). Antes de tudo, confere o e-mail como no cadastro e o
  tamanho da senha (400, sem gravar tentativa nem rodar o argon2). Entrar certo
  apaga as tentativas daquele e-mail e a sessão do cookie antigo, se vier uma.
- **Bloqueio** (`tentativas_login`): a tentativa é **reservada antes** de conferir a
  senha: grava a linha, conta as da janela de 15 minutos com id até a sua e, se
  passou de 5, apaga a própria linha (para o bloqueio não se estender sozinho) e
  responde 429 `bloqueado` com `Retry-After` (até a primeira da janela sair). Contar
  primeiro e gravar depois deixava 20 pedidos simultâneos passarem todos. A chave é
  o e-mail em minúsculas; e-mail só ASCII garante que o `toLowerCase` do JS e o
  `lower()` do índice concordam. Os chutes de convite usam a mesma tabela e regra,
  com a chave fixa `convite` (convite certo apaga só a própria reserva). Por isso
  o `CODIGO_CONVITE` deve ser longo e aleatório (ex.: `openssl rand -hex 16`); o
  preço é que chutes de alguém podem travar o cadastro de todos por 15 minutos.
- **Limpeza**: tentativas fora da janela são apagadas a cada reserva; sessões
  vencidas, a cada sessão criada.
- **Sair**: apaga a sessão e manda o cookie vencido.
- **Excluir conta**: pede a senha; errada = 401 `credenciais` (conta como tentativa).
  O `ON DELETE CASCADE` leva sessões e painel junto.

### Dados

- **GET**: `{ dados, revisao }` da conta; sem painel ainda, `{ dados: null, revisao: 0 }`.
- **PUT** `{ dados, revisao }`:
  1. Confere os dados com as mesmas funções do site (`migrar` + `validarDados` de
     `src/logica`): inválido = 400 `dados-invalidos` com a mensagem de lá. Grava a
     versão limpa que a validação devolve.
  2. Grava só se a revisão bater, num comando só:
     `UPDATE paineis SET dados = $1, revisao = revisao + 1 ... WHERE usuario_id = $2 AND revisao = $3 RETURNING revisao`.
     Com `revisao` 0, `INSERT ... ON CONFLICT DO NOTHING RETURNING revisao`.
  3. Nada gravado = 409 `conflito` com os dados e a revisão que estão na nuvem.

### Chaves de acesso e prazos (para o bot)

Um programa da própria pessoa (o bot do Telegram) lê os prazos dos próximos dias
sem guardar a senha: ela cria uma **chave de acesso** na tela Dados e cola no bot.

- **Token**: `cb_` + 32 bytes aleatórios em base64url (46 caracteres no total). O
  banco (`chaves_acesso`) guarda só o SHA-256 dele, numa coluna `UNIQUE`: a busca é
  pelo hash, e quem ler o banco não consegue usar a chave. O token aparece uma vez
  só, na resposta da criação.
- **Rotas da conta** (`/api/chaves`, só com o cookie da sessão e a conferência de
  Origin de sempre):
  - `GET` -> `{ "chaves": [{ "id", "nome", "criadaEm", "usadaEm" }] }` (sem o token),
    da mais antiga para a mais nova.
  - `POST { "nome": "Bot do Telegram" }` -> 201 `{ "chave": {...}, "token": "cb_..." }`.
    Nome de 1 a 40 caracteres (sem espaços nas pontas). No máximo **5 por conta**:
    a sexta dá 409 `limite-chaves`. A conta e o limite vão num `INSERT ... SELECT ... WHERE (SELECT count(*) ...) < 5` só.
  - `DELETE ?id=k_...` -> 204. Chave que não existe ou é de outra conta: 404
    `nao-encontrada` (sem contar qual dos dois).
  - Excluir a conta leva as chaves junto (`ON DELETE CASCADE`).
- **A chave só lê**: a `rota()` de `servidor/http.ts` recusa com 403
  `chave-recusada` qualquer pedido com o cabeçalho `Authorization`, mesmo com o
  cookie junto, em todas as rotas menos a dos prazos (que é a única criada com
  `aceitaChave: true`, e só tem GET). Assim a chave não salva dados, não cria nem
  apaga chaves, não sai nem exclui a conta. E a rota dos prazos não aceita o cookie:
  lá, só a chave vale.

#### GET /api/prazos

```
GET https://coursebookalp.vercel.app/api/prazos?dias=7
Authorization: Bearer cb_...
```

- `dias`: inteiro de 1 a 60; sem ele, 7. Fora disso, 400 `pedido-invalido`.
- **Hoje** é o dia em Brasília (`America/Sao_Paulo`), não o do servidor (a Vercel
  roda em UTC: às 22h daqui, lá já é amanhã).
- Entram os prazos de `hoje` até `hoje + dias` (os dois dias entram), sem os atrasados:
  - os eventos da **Agenda** (prova, trabalho, apresentação) não concluídos;
  - as **avaliações** das matérias que têm data e ainda não têm nota (tipo
    `avaliacao`), menos as que já têm um evento da agenda **não concluído** da mesma
    matéria no mesmo dia: aí o aviso vem pela agenda, para não avisar duas vezes.
- Ordem: data, depois matéria (sem matéria primeiro) e título.
- O painel não guarda a hora das provas. `horaAula` é o início da primeira aula da
  matéria naquele dia da semana (é quando a turma se encontra), ou `null`.
- Conta sem painel na nuvem: `prazos: []`. A rota anota `usada_em` da chave (a tela
  mostra "usada pela última vez em ...").
- O cálculo é `prazos()` de `src/logica/prazos.ts`, que usa a `agenda()` e o `diasAte()`
  do site.

Resposta 200:

```json
{
  "hoje": "2026-10-04",
  "ate": "2026-10-11",
  "dias": 7,
  "prazos": [
    {
      "data": "2026-10-06",
      "diasRestantes": 2,
      "tipo": "prova",
      "tipoNome": "Prova",
      "titulo": "Prova do RA1",
      "materia": "Física",
      "horaAula": "19:00"
    },
    {
      "data": "2026-10-08",
      "diasRestantes": 4,
      "tipo": "avaliacao",
      "tipoNome": "Avaliação",
      "titulo": "Lista 2 (RA1)",
      "materia": "Cálculo",
      "horaAula": null
    }
  ]
}
```

`tipo` é `prova`, `trabalho`, `apresentacao` ou `avaliacao`; `materia` pode ser `null`
(evento da agenda sem matéria).

Erros (sempre `{ "codigo", "erro" }`, com a mensagem em português):

| Status | `codigo` | Quando |
| --- | --- | --- |
| 401 | `chave-invalida` | Sem `Authorization`, fora do formato `Bearer cb_...`, chave inventada ou apagada (com `WWW-Authenticate: Bearer`). Ex.: `{"codigo":"chave-invalida","erro":"Chave de acesso inválida ou apagada."}` |
| 400 | `pedido-invalido` | `dias` fora de 1 a 60. |
| 405 | `metodo` | Qualquer método que não seja GET. |
| 500 | `erro-interno` | Erro do servidor ou do banco. |

### Proteções de todas as rotas

- Método errado: 405 `metodo` (com cabeçalho `Allow`).
- Corpo acima de 2 MB: 413 `muito-grande`.
- POST, PUT e DELETE com corpo exigem `Content-Type: application/json`, e, se o
  navegador mandar `Origin`, ele tem que ser o mesmo host do pedido. Junto com o
  SameSite=Lax, isso impede outro site de usar o cookie (CSRF). O contrato não tem
  códigos próprios para isso: Content-Type errado é **415** e Origin de outro site
  é **403**, os dois com o código `pedido-invalido`. O Origin é conferido em todo
  método que não é GET (inclusive o sair, sem corpo) e vale se bater com o host da
  URL ou com o cabeçalho `Host`; `Origin: null` é recusado.
- Cabeçalho `Authorization` em rota que não é a dos prazos: 403 `chave-recusada`.
- Toda resposta com `Cache-Control: no-store`.
- Erro inesperado: 500 `erro-interno` com mensagem genérica (o detalhe vai só
  para o `console.error`, que aparece nos logs da Vercel). Nunca devolver o hash,
  o token ou o SQL.

## Site

O código fica em `src/nuvem/`: `cliente.ts` (fetch nas rotas), `conta.ts` (a chave no
aparelho), `decidir.ts` (as regras abaixo, em funções puras), `sincronizador.ts` (quem
executa as regras, fora do React), `ProvedorNuvem.tsx` (liga o sincronizador ao painel e
aos eventos do navegador) e as telas (`SecaoNuvem.tsx`, `SituacaoNuvem.tsx`).

### Onde aparece

- Na tela **Dados**, uma seção **Conta e nuvem**, a primeira da página: entrar, criar
  conta (com o campo do convite), sair, excluir conta. Logado, mostra o e-mail e a situação.
- Logado (e com a sessão valendo), logo abaixo, a seção **Chaves de acesso**
  (`SecaoChaves.tsx`): criar com um nome (o token aparece uma vez, com o botão
  copiar e o aviso de que não aparece de novo), a lista com quando cada uma foi
  criada e usada, e apagar em 2 passos.
- No topo, ao lado do título, a situação da sincronização em texto curto (só para
  quem está logado): "Sincronizando..." (conferindo a nuvem), "Sincronizado",
  "Salvando...", "Sem conexão: salvo neste aparelho", "Entre de novo para
  sincronizar", "Conflito: escolha qual versão manter", "Erro ao sincronizar" (erro da
  API, como dados inválidos ou erro interno) e "Sincronização parada" (sem salvar,
  ver abaixo). Os três que pedem ação (entrar de novo, conflito e erro) são links para
  a tela Dados. O leitor de tela só anuncia os que pedem atenção (sem conexão, entrar
  de novo, conflito, erro): "Salvando..." a cada mudança seria barulho.

### O que fica guardado no aparelho

- Os dados continuam no localStorage (`painel-estudos:dados`), como sempre: o
  painel abre na hora e funciona sem internet.
- `painel-estudos:nuvem` guarda `{ email, revisao, pendente, primeiraVez? }`: de quem é
  a conta, a última revisão que este aparelho viu, se há mudança ainda não enviada e,
  logo depois de entrar, `primeiraVez: true` até decidir o que fazer com os dados que
  já estavam no aparelho (assim, recarregar no meio não trata esses dados como se
  tivessem vindo da nuvem). Sem essa chave, ou com uma que não dá para ler, o painel
  está sem conta e nada muda em relação a hoje (nenhuma chamada à API).

### Sincronização

- **Ao abrir** (e ao voltar para a aba, e no evento `online`), com conta:
  - `eu()` deu 401 (ou a sessão é de outro e-mail): a sessão acabou. Continua local,
    avisa "Entre de novo para sincronizar" e mantém o `pendente`.
  - Baixa os dados. Nuvem com a mesma revisão: se `pendente`, envia; senão, em dia.
  - Nuvem com revisão maior: sem `pendente`, troca os dados locais pelos da nuvem
    (ação `sincronizar`, sem desfazer); com `pendente`, é conflito (a não ser que os
    dois sejam iguais, ver abaixo).
  - Os dados da nuvem passam pela mesma conferência do localStorage (`migrar` +
    `validarDados`); os que este site não lê (versão mais nova) viram erro, e nada é trocado.
- **Ao mudar os dados** com conta: marca `pendente` e envia 2 segundos depois da
  última mudança, com a revisão guardada. Deu certo: guarda a revisão nova e tira
  o `pendente` (se os dados mudaram enquanto o envio ia, continua pendente e envia de
  novo). Sem conexão: fica pendente e tenta de novo no próximo `online`, ao voltar
  para a aba ou na próxima mudança. Só conta como mudança o que foi feito nesta aba:
  os dados que vieram da nuvem ou de outra aba não são reenviados por ela (mas o que
  o Desfazer traz de volta é, mesmo que seja o objeto que veio da nuvem).
- **Conflito** (409, ou nuvem mais nova com mudança pendente): se os dados da nuvem
  forem iguais aos locais (`iguais` de `src/logica/iguais.ts`, como duas abas que
  enviaram a mesma mudança), só adota a revisão da nuvem, sem perguntar. Senão, para
  de enviar e pergunta:
  - "Usar a da nuvem": troca os dados locais pelos da nuvem. Dá para desfazer (o
    aviso de desfazer que o painel já tem), e desfazer envia de novo os dados daqui.
  - "Manter a deste aparelho": envia os locais com a revisão da nuvem (sobrescreve).
  Com a pergunta na tela, voltar para a aba não baixa de novo (a pergunta piscaria).
- **Duas abas**: os dados já passam de uma aba para a outra pelo evento `storage`.
  A chave `painel-estudos:nuvem` também, então as duas veem a mesma revisão; se as
  duas enviarem a mesma coisa, a regra do "iguais" resolve sem perguntar. A aba que
  termina um envio não apaga o `pendente` que a outra marcou no meio (relê a chave
  antes de gravar "em dia"). Se esta aba estava sem sessão e a outra entrou de novo,
  esta confere também. A outra aba saiu: esta fica sem conta.
- **Primeira vez que entra** (cadastro ou entrar num aparelho sem a chave da nuvem, ou
  com a chave de outro e-mail):
  - Nuvem vazia: se o aparelho tem dados, envia com revisão 0.
  - Nuvem com dados e aparelho vazio (ou igual): usa os da nuvem.
  - Os dois com dados diferentes: pergunta "Esta conta já tem dados na nuvem." com
    "Usar os da nuvem" e "Substituir pelos deste aparelho".
  - "Aparelho vazio" é sem matérias, sem eventos e com a regra padrão da PUC-PR: uma
    regra padrão editada também é dado da pessoa.
  - Entrar de novo com o mesmo e-mail (a sessão tinha acabado) não é primeira vez:
    continua com a revisão e o `pendente` guardados. Por isso, no "Entre de novo" o
    e-mail fica só para leitura; para usar outra conta, primeiro "Sair".
- **Sair**: apaga a sessão e a chave da nuvem. Se a API não responder (sem conexão),
  a conta continua e aparece o erro: o cookie ainda valeria. Por padrão os dados ficam
  no aparelho; a opção "Sair e apagar os dados deste aparelho" (confirma antes, e avisa
  se há mudança não enviada) serve para computador emprestado: apaga tudo o que começa
  com `painel-estudos:` (dados, cópias e conta) e esvazia a tela, sem desfazer. Logo
  depois o painel grava o painel vazio, só com a regra padrão da PUC-PR.
- **Excluir conta**: pede a senha, apaga na nuvem e a chave da nuvem; os dados do
  aparelho ficam (o aviso diz isso).
- **Sem salvar** (`podeSalvar` false: dados ilegíveis ou outra aba com versão mais
  nova): não envia nada, nem troca os dados pelos da nuvem ("Sincronização parada").
- Os dados de exemplo são dados como outros: com conta, sobem para a nuvem. A tela
  de exemplo continua funcionando sem conta.

## Desenvolvimento

- `npm run dev` serve também a API: um plugin do Vite (só no dev) passa `/api/*`
  para `servidor/`, com PGlite gravado em `.pglite/` (no `.gitignore`) e convite
  `CODIGO_CONVITE` do ambiente ou, sem ele, `convite-local`.
- Testes da API em `tests/servidor/`, com PGlite em memória e ambiente `node`.
- Produção: variáveis `DATABASE_URL` (Neon), `NOME_DO_BANCO` e `CODIGO_CONVITE` na Vercel.
  A `DATABASE_URL` vem da integração Neon, que a atualiza sozinha quando a senha é
  trocada, mas aponta para o banco padrão (`neondb`, do Controle de Gastos);
  `NOME_DO_BANCO=painel_estudos` troca só o nome do banco no fim do endereço.
