import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  FileText,
  FolderKanban,
  Info,
  Presentation,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import type { TipoEvento } from '../logica/tipos'
import type { Tom } from './tons'

// Ícones do Lucide (licença ISC), de uma cor só: pegam a cor do texto em volta.
// Ficam num lugar só para a tela inteira usar o mesmo ícone para a mesma coisa.

export const ICONE_TIPO_EVENTO: Record<TipoEvento, LucideIcon> = {
  prova: FileText,
  trabalho: FolderKanban,
  apresentacao: Presentation,
}

/** Ícone de cada tom nos selos: o "certo" só aparece no que está resolvido (ok). */
export const ICONE_TOM: Record<Tom, LucideIcon> = {
  ok: CircleCheck,
  destaque: Clock,
  atencao: TriangleAlert,
  perigo: CircleX,
  neutro: CircleDashed,
}

/** Ícones dos avisos da tela (erro não é "reprovado", então não usa o X). */
export const ICONE_AVISO = {
  info: Info,
  atencao: TriangleAlert,
  erro: CircleAlert,
} satisfies Record<string, LucideIcon>
