import { useEffect, useState } from 'react'
import { paraDataISO } from '../logica/datas'

/** "2026-09-29 19:05": muda uma vez por minuto. */
const minutoISO = (d: Date) =>
  `${paraDataISO(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/**
 * A data e hora de agora, trocada só quando `chave` muda (o dia, o minuto): lida ao
 * abrir a tela, de novo quando a aba volta a ficar visível e conferida a cada 15 s.
 * Trocar a cada conferência redesenharia a tela à toa.
 */
function useRelogio(chave: (d: Date) => string): Date {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') setAgora(new Date())
    }
    const conferir = () => {
      const novo = new Date()
      setAgora((antes) => (chave(antes) === chave(novo) ? antes : novo))
    }
    document.addEventListener('visibilitychange', aoVoltar)
    const intervalo = setInterval(conferir, 15_000)
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      clearInterval(intervalo)
    }
  }, [chave])
  return agora
}

/**
 * "Hoje", trocado quando o dia vira com a tela aberta. Ler a hora a cada desenho
 * faria a tela mudar sozinha; só ao abrir deixaria a aba esquecida de um dia para o
 * outro mostrando "Amanhã" para a prova de hoje.
 */
export function useHoje(): Date {
  return useRelogio(paraDataISO)
}

/** Agora, trocado a cada minuto: para a grade da semana marcar a aula em andamento. */
export function useAgora(): Date {
  return useRelogio(minutoISO)
}
