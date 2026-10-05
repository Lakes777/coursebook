import userEvent, { PointerEventsCheckLevel, type Options, type UserEvent } from '@testing-library/user-event'

/**
 * O userEvent dos testes de tela, mais leve que o padrão:
 * - delay: null tira a pausa (um setTimeout) entre cada tecla e clique;
 * - sem conferir pointer-events: a conferência chama getComputedStyle em todos os
 *   ancestrais a cada ação, e nos testes o CSS do painel nem é carregado, então ela
 *   nunca acharia nada.
 * Com o padrão, os testes que preenchem formulários grandes levavam segundos e,
 * com a máquina ocupada, estouravam o limite de tempo do vitest.
 */
export function criarUsuario(opcoes: Options = {}): UserEvent {
  return userEvent.setup({ delay: null, pointerEventsCheck: PointerEventsCheckLevel.Never, ...opcoes })
}
