import { VERSAO_ATUAL } from './tipos'

// Texto para colar num chat de IA (ChatGPT, Claude, Gemini...) junto com o PDF do
// plano de ensino. A IA devolve o JSON, que a pessoa importa com "Adicionar ao painel".

/**
 * Exemplo do formato, inventado. Fica como objeto (e não texto) para o teste conferir
 * que o painel aceita exatamente o que as instruções mostram.
 */
export const EXEMPLO_IA = {
  versao: VERSAO_ATUAL,
  materias: [
    {
      id: 'estruturas',
      nome: 'Estruturas de Dados',
      professor: 'Nome do professor',
      cargaHoraria: 80,
      horarios: [
        { dia: 2, inicio: '19:00' },
        { dia: 4, inicio: '19:00' },
      ],
      ras: [
        {
          nome: 'RA1',
          peso: 40,
          recuperacaoNoSemestre: true,
          avaliacoes: [{ nome: 'Prova 1', valorMaximo: 10, peso: 1, data: '2026-09-22' }],
        },
        {
          nome: 'RA2',
          peso: 60,
          recuperacaoNoSemestre: false,
          avaliacoes: [
            // Pontos que se somam (3,0 + 7,0): o peso de cada uma é o próprio valor.
            { nome: 'Prova 2', valorMaximo: 3, peso: 3, data: '2026-11-10' },
            { nome: 'Projeto', valorMaximo: 7, peso: 7 },
          ],
        },
      ],
    },
  ],
  eventos: [
    { materiaId: 'estruturas', titulo: 'Prova 1 (RA1)', tipo: 'prova', data: '2026-09-22' },
    { materiaId: 'estruturas', titulo: 'Prova 2 (RA2)', tipo: 'prova', data: '2026-11-10' },
  ],
}

export const INSTRUCOES_IA = `Leia o plano de ensino em anexo e monte um JSON para o meu painel de estudos. Responda com o JSON e nada antes dele (depois dele, só a linha de "Atenção:" descrita no fim, se precisar).

Formato (este é um exemplo inventado; use os dados do plano):

${JSON.stringify(EXEMPLO_IA, null, 2)}

Regras:
- Uma entrada em "materias" para cada plano de ensino anexado. Dê a cada matéria um "id" curto (ex.: "poo") e use o mesmo id em "materiaId" nos eventos dela.
- "cargaHoraria": a carga horária total em horas-aula (HA), um número inteiro. Se o plano não disser, use 0.
- "horarios": "dia" vai de 0 (domingo) a 6 (sábado); "inicio" no formato HH:MM. Se o plano não disser, use [].
- "ras": um item para cada Resultado de Aprendizagem (RA). "peso" é quanto o RA vale na nota final (ex.: 40 para 40%).
- "recuperacaoNoSemestre": true só para os RAs que o plano diz que têm recuperação durante o semestre.
- "avaliacoes": as avaliações de cada RA. "valorMaximo" é quanto ela vale (10, ou 3 numa prova que vale 3,0 pontos). "peso" é o peso dentro do RA; se o plano não disser, use 1 em todas.
- Se as avaliações de um RA são pontos que se somam (ex.: prova de 3,0 + projeto de 7,0), cada uma tem "valorMaximo" e "peso" iguais aos pontos dela (3 e 3; 7 e 7), como no RA2 do exemplo.
- Se a nota final for uma soma de pontos entre RAs (ex.: RA1 até 3,0 + RA2 até 3,0 + RA3 até 4,0), o "peso" de cada RA são os pontos dele (3, 3 e 4), e as avaliações seguem a regra acima com os pontos de cada uma.
- Nomes e títulos curtos, com até 100 caracteres: "RA1", e não a descrição inteira do RA.
- Números com ponto e sem aspas (7.5, e não "7,5").
- Datas no formato AAAA-MM-DD. Sem data certa no plano, deixe o campo "data" de fora.
- "eventos": provas, entregas de trabalho e apresentações com data. "tipo" é "prova", "trabalho" ou "apresentacao".
- Não coloque notas: eu lanço depois.
- Só inclua "regra" em uma matéria se o plano tiver regra de aprovação diferente de: média 7,0, frequência 75% e recuperação para nota final de 4,0 a 6,9 com a nota do RA valendo até 7,0. Formato: "regra": { "mediaMinima": 7, "frequenciaMinima": 0.75, "recuperacao": { "notaMinima": 4, "teto": 7 }, "arredondarUmaCasa": false }.
- Não invente nada: o que o plano não diz fica de fora ou com o valor indicado acima.
- Se o plano tiver algo confuso ou contraditório (ex.: a fórmula cita um RA que não existe), siga o mais provável e me avise depois do JSON, numa linha começando com "Atenção:".`
