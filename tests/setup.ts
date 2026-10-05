import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Desmonta o que cada teste desenhou, para um teste não enxergar a tela do outro.
afterEach(() => {
  cleanup()
})

// Nos testes, o argon2id roda com parâmetros leves (1 MiB e 1 passada, em vez dos
// 19 MiB e 2 passadas do padrão): é o mesmo algoritmo e formato PHC, mas cada hash
// leva milissegundos, e os testes de entrar/cadastrar não estouram o tempo com a
// máquina ocupada. O verify lê os parâmetros do próprio hash, então fica leve junto.
vi.mock('@node-rs/argon2', async (original) => {
  const argon2 = await original<typeof import('@node-rs/argon2')>()
  return {
    ...argon2,
    hash: (senha: string | Uint8Array, opcoes?: import('@node-rs/argon2').Options) =>
      argon2.hash(senha, { memoryCost: 1024, timeCost: 1, ...opcoes }),
  }
})
