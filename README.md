# Painel de estudos

[![Testes](https://github.com/Lakes777/painel-estudos/actions/workflows/testes.yml/badge.svg)](https://github.com/Lakes777/painel-estudos/actions/workflows/testes.yml)

Painel para acompanhar o semestre da faculdade: notas por RA, faltas, pontos extras e a agenda
de provas e trabalhos, num lugar só. Ele calcula quanto falta para passar em cada matéria,
seguindo a regra de aprovação da PUC-PR (configurável por matéria).

Funciona sem conta, com os dados só no navegador (localStorage). Quem cria uma conta passa a ter
os dados guardados também na nuvem (Postgres) e sincronizados entre aparelhos, como o PC e o celular.

**No ar:** https://painel-estudos-cyan.vercel.app (o painel abre vazio; "Ver com dados de exemplo"
mostra como ele fica em uso).

## Demonstração

![Lista de matérias com o resumo do semestre, a situação de cada uma e os próximos prazos](docs/materias.png)

![Tela de uma matéria: notas por RA, faltas, pontos extras e regra](docs/materia.png)

![Grade da semana com os horários de todas as matérias e o dia de hoje marcado](docs/semana.png)

<p>
  <img src="docs/agenda.png" alt="Agenda com provas atrasadas, de hoje e chegando" width="64%">
  <img src="docs/celular.png" alt="Tela de uma matéria em recuperação, no celular" width="32%">
</p>

Os prints usam os dados de exemplo (matérias e professores inventados), que qualquer um pode
carregar no painel vazio com "Ver com dados de exemplo".

## Funcionalidades

- **Matérias do jeito do plano de ensino:** cada matéria tem RAs (Resultados de Aprendizagem)
  com peso na nota final, e cada RA tem as avaliações dele, com valor (10, ou 3,0 numa prova
  "que vale 3 pontos") e peso.
- **Quanto falta para passar:** mostra a situação da matéria (aprovado, precisa de nota,
  recuperação, reprovado) e, em cada avaliação pendente, a nota necessária na escala dela
  ("Precisa de 2,1 de 3,0").
- **Recuperação:** vale a maior nota entre o RA e a recuperação, com teto de 7,0, como na
  resolução da PUC-PR.
- **Pontos extras:** vão para um RA (na escala dele: +0,3 num RA que vale 3,0) ou para a nota
  final, sempre com o comentário de onde vieram.
- **Faltas:** o limite sai da carga horária (25% das aulas). O botão "Faltei hoje" lança de uma
  vez as aulas daquele dia, pelos horários da matéria.
- **Semana:** a grade como a do portal da PUC-PR, com uma linha por aula (1ª a 20ª) e uma
  coluna por dia, o nome da matéria em cada aula que ela ocupa e o dia de hoje marcado. Aulas
  vazias seguidas (entre a manhã e a noite) viram uma linha só; no celular, um dia embaixo do outro.
  A aula que está acontecendo agora aparece marcada com "Agora" e muda sozinha com a tela aberta.
- **Visão do semestre:** a lista de matérias mostra um resumo (aprovadas, em andamento, pedem
  atenção) e o cartão "Próximos prazos", com os 3 itens da agenda que vêm primeiro.
- **Agenda:** provas, trabalhos e apresentações, com o que está atrasado, é hoje ou está chegando.
- **Desfazer:** depois de remover algo ou apagar uma nota, um aviso no pé da página oferece
  "Desfazer" (ou Ctrl+Z). Vale para a última ação.
- **Regra padrão editável:** a da PUC-PR vem pronta, mas dá para trocar na tela Dados; cada
  matéria ainda pode ter a sua.
- **Várias abas:** o que muda numa aba aparece nas outras sem recarregar. Sair do formulário
  de matéria pelas abas ou pelo voltar do navegador pergunta antes de apagar o que foi preenchido.
- **Cadastro passo a passo:** formulário em 5 passos (matéria, RAs, avaliações, regra, revisar),
  que também serve para editar uma matéria sem perder as notas lançadas. O horário é escolhido
  pelas aulas da tabela da PUC-PR ("da 2ª até a 5ª aula"); para outro horário, dá para digitar as horas.
  Duas matérias (ou dois horários da mesma) não ocupam o mesmo horário: as aulas já ocupadas
  aparecem desativadas, com o nome da matéria. Um choque que já estava salvo (aula quinzenal,
  dependência em outra turma) não impede de editar o resto da matéria.
- **Cadastro com IA:** o botão "Copiar instruções para uma IA" copia um texto pronto. Colado
  num chat (ChatGPT, Claude...) junto com o PDF do plano de ensino, ele faz a IA devolver o JSON
  da matéria para importar.
- **Backup:** exportar e importar tudo em JSON. A importação aceita a resposta da IA do jeito
  que ela costuma vir (com o bloco de código e frases em volta).
- **Conta e nuvem (opcional):** na tela Dados, entrar ou criar conta (e-mail, senha e o código
  de convite). Com conta, cada mudança é enviada sozinha e aparece nos outros aparelhos; sem
  internet, fica guardada e vai quando a conexão voltar. Se o mesmo painel mudou em dois lugares,
  o site pergunta qual versão manter em vez de apagar uma delas.
- **Acessível:** funciona só com o teclado e com leitor de tela (foco levado para o lugar certo,
  erros ligados aos campos, avisos anunciados). Situações têm sempre texto, não só cor.

## Como usar

1. Abra o painel e cadastre uma matéria em "Nova matéria", com o plano de ensino do lado. Ou
   use "Cadastrar com uma IA" na tela Dados.
2. Lance as notas na tela da matéria: cada campo salva ao sair dele ou apertar Enter (Esc desfaz).
3. Lance as faltas com "Faltei hoje" e as provas na Agenda.
4. Para usar em mais de um aparelho, crie uma conta em Dados. Sem conta, baixe um backup de vez
   em quando: os dados ficam só neste navegador.

## Instalação

Precisa do [Node.js](https://nodejs.org/) 22.12 ou mais novo (testado no 22 e no 24).

```bash
git clone https://github.com/Lakes777/painel-estudos.git
cd painel-estudos
npm install
npm run dev
```

Depois, abra `http://localhost:5173` no navegador. O `npm run dev` também serve a API da conta,
com um Postgres dentro do próprio Node ([PGlite](https://pglite.dev/)) gravado na pasta `.pglite/`,
e o código de convite `convite-local` (ou o da variável `CODIGO_CONVITE`).

Para gerar a versão de produção: `npm run build` (o site sai na pasta `dist/`; a API são as
funções da pasta `api/`, que a Vercel publica junto). Na Vercel, a API precisa das variáveis
`DATABASE_URL` (Neon), `NOME_DO_BANCO` e `CODIGO_CONVITE` (ver [docs/nuvem.md](docs/nuvem.md)).

## Testes

```bash
npx vitest run   # 722 testes (lógica, telas e API)
npx oxlint       # lint
npx tsc -b       # tipos
```

O GitHub Actions roda tudo isso a cada push, no Node 22 e 24. Os testes rodam sempre no fuso
de Brasília (definido no `vite.config.mts`), para "hoje" e "amanhã" darem o mesmo resultado no
meu PC e no Actions.

## Estrutura

```
src/
  logica/        Regras sem React (testadas sozinhas)
    notas.ts       Nota do RA, situação, nota necessária, pontos extras
    faltas.ts      Limite e situação das faltas
    horarios.ts    Horários, aulas do dia
    eventos.ts     Agenda (atrasado, hoje, próximo...)
    validacao.ts   Confere os dados salvos e os importados
    armazenamento.ts  localStorage, versão e migração
    transferencia.ts  Exportar, importar e juntar dados
    instrucoesIA.ts   Texto e exemplo para a IA
    exemplo.ts     Dados de exemplo (datas relativas a hoje)
  estado/        useReducer + Context (ações, reducer, desfazer, provedor que salva e sincroniza abas)
  navegacao/     Rotas no # do endereço
  telas/         Uma tela por arquivo (Materias, Materia, Formulario, Semana, Agenda, Dados)
  componentes/   Peças reaproveitadas (selo, avisos, cabeçalho, remover em 2 passos, "hoje")
  tema/          Cores das situações, ícones e textos
  api/           Contrato da API (rotas, tipos, erros), usado pelo site e pelo servidor
  nuvem/         Cliente da API, sincronização e a seção "Conta e nuvem"
api/             Uma função da Vercel por rota (cadastro, entrar, sair, eu, conta, dados)
servidor/        A API de verdade: rotas, contas, sessões, esquema do banco (Neon ou PGlite)
tests/           Espelha o src/ (logica, estado, telas, navegacao, tema, nuvem) e o servidor/
```

## Decisões técnicas

- **Lógica separada do React:** as contas de notas e faltas ficam em `src/logica`, sem React,
  e têm testes próprios, inclusive com casos de ponto flutuante (em JavaScript,
  `(0.1 + 5.8) / 2` dá `2.9499999999999997`).
- **Nota necessária arredondada para cima:** mostrar 6,0 para quem precisa de 6,01 faria a
  pessoa tirar 6,0 e não passar. A média, por padrão, é mostrada cortada (6,99, nunca "7,00"
  para quem não chegou em 7). Arredondar a nota final para 1 casa é opção por matéria.
- **Extras em RA com busca:** com pontos extras num RA, o RA pode bater no teto de 10 e perder
  o que passa dele, e a conta direta erra. Nesse caso, a nota necessária é achada testando de
  0,1 em 0,1 (no máximo 101 contas).
- **Dados que nunca somem:** o que não dá para ler do localStorage é copiado para outra chave
  antes de o painel começar vazio. Os dados têm versão e migração. Quando outra aba salva, esta
  relê os dados sem regravá-los (senão as abas ficariam se respondendo sem parar); se não
  conseguir ler (ex.: versão mais nova do site na outra aba), para de salvar em vez de gravar por cima.
- **Desfazer sem cópia:** o reducer nunca altera o objeto que recebe, então guardar a
  referência dos dados de antes basta. Qualquer ação nova esquece o desfazer, porque voltar
  àqueles dados apagaria a ação nova junto.
- **Sair do formulário sem perder nada:** os cliques nas abas são segurados antes de virarem
  histórico, e o voltar do navegador é revertido com `history.go(1)` (reescrever a entrada com
  `replaceState` estragaria o histórico). Conferido no Chromium com o Playwright.
- **Tabela de aulas da PUC-PR:** as 20 aulas do portal ficam em `src/logica/aulasPUC.ts`. Uma
  matéria ocupa as aulas que começam dentro do horário dela (07:50 às 11:10 = 2ª a 5ª, pulando o
  intervalo); horário que não bate com a tabela aparece numa lista à parte, para não sumir.
- **Rotas no `#`:** `#/materia/<id>`, `#/agenda`... Assim o botão voltar funciona e o site
  estático não precisa de configuração de rotas no servidor.
- **Importação tolerante, validação rígida:** o JSON importado pode vir sem ids, sem versão ou
  com texto em volta; mas qualquer valor errado recusa tudo, com o caminho do erro
  ("Matéria 1 (POO) > RA 2 > Avaliação 1: ...").
- **API testável sem a Vercel:** cada rota é uma função `(pedido, contexto) => resposta`, e o
  contexto traz o banco, o relógio e o convite. Nos testes, o banco é o PGlite em memória (Postgres
  de verdade, sem instalar nada); em produção, o Neon. As funções da pasta `api/` só ligam os dois.
- **Sem perder mudanças entre aparelhos:** cada painel na nuvem tem um número de revisão, e o
  envio só grava se a revisão bater (num `UPDATE ... WHERE revisao = $3` só). Se outro aparelho
  gravou antes, a API responde 409 com a versão da nuvem, e o site pergunta qual manter.
- **Segurança da conta:** senha com argon2id; sessão num cookie HttpOnly e SameSite, com o banco
  guardando só o SHA-256 do token; limite de tentativas de login e de código de convite, reservadas
  antes de conferir (contar primeiro deixava 20 pedidos simultâneos passarem); e os mesmos
  conferidores do localStorage validam o que chega na API. Detalhes em [docs/nuvem.md](docs/nuvem.md).
- **Visual:** tema escuro grafite com o bordô da PUC-PR (Pantone 201) só atrás de texto branco;
  em texto, um tom claro dele, para ter contraste.
- **Feito com o Claude Code:** o formulário de nova matéria, a agenda, a grade da semana e a
  edição da regra padrão foram feitos por subagentes em `git worktree` separados, ao mesmo tempo que outras telas, e um agente revisor
  confere cada mudança antes do commit.

## Próximos passos

- [x] Publicar o site na Vercel
- [x] Grade da semana com os horários de todas as matérias
- [x] Desfazer a última ação (remover uma nota ou falta sem querer)
- [x] Avisar ao sair do formulário de matéria pelas abas ou pelo voltar do navegador
- [x] Sincronizar entre abas sem precisar recarregar
- [x] Editar a regra padrão do painel (hoje é a da PUC-PR, e cada matéria pode ter a sua)
- [x] Não deixar duas matérias ocuparem o mesmo horário
- [x] Marcar na grade da semana a aula que está acontecendo agora
- [x] Guardar os dados na nuvem, para usar em mais de um aparelho
