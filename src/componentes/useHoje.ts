import { useEffect, useState } from 'react'
import { paraDataISO } from '../logica/datas'

/**
 * "Hoje", lido ao abrir a tela, de novo quando a aba volta a ficar visível e quando
 * o dia vira com ela aberta (conferido a cada minuto). Ler a hora a cada desenho
 * faria a tela mudar sozinha; só ao abrir deixaria a aba esquecida de um dia para o
 * outro mostrando "Amanhã" para a prova de hoje.
 */
export function useHoje(): Date {
  const [hoje, setHoje] = useState(() => new Date())
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') setHoje(new Date())
    }
    // Só troca quando o dia muda: trocar a cada minuto redesenharia a tela à toa.
    const conferirDia = () => {
      const agora = new Date()
      setHoje((antes) => (paraDataISO(antes) === paraDataISO(agora) ? antes : agora))
    }
    document.addEventListener('visibilitychange', aoVoltar)
    const intervalo = setInterval(conferirDia, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      clearInterval(intervalo)
    }
  }, [])
  return hoje
}
