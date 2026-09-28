import { useEffect, useState } from 'react'

/**
 * "Hoje", lido ao abrir a tela e de novo quando a aba volta a ficar visível. Ler a
 * hora a cada desenho faria a tela mudar sozinha; só ao abrir deixaria a aba esquecida
 * de um dia para o outro mostrando "Amanhã" para a prova de hoje.
 */
export function useHoje(): Date {
  const [hoje, setHoje] = useState(() => new Date())
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') setHoje(new Date())
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [])
  return hoje
}
