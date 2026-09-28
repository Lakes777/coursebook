import { useId, useState, type ReactNode } from 'react'
import { formatarNota } from '../../logica/numeros'
import { lerNotaDigitada, notaNoCampo } from '../materiaUtil'

interface Props {
  rotulo: ReactNode
  valor: number | null
  /** Quanto a avaliação vale (3,0 numa prova de 3 pontos). */
  maximo: number
  /** Frase embaixo do campo ("Precisa de 2,0 de 3,0"). */
  dica?: string
  aoSalvar: (nota: number | null) => void
}

/**
 * Campo de nota que salva sozinho ao sair dele ou apertar Enter (Esc desfaz o que
 * foi digitado). Sem botão "Salvar" em cada linha: numa matéria com 8 avaliações,
 * seriam 8 botões iguais. Vazio quer dizer que a nota ainda não saiu.
 */
export function CampoNota({ rotulo, valor, maximo, dica, aoSalvar }: Props) {
  // Id gerado, e não o da avaliação: ids de um JSON importado podem ter espaços ou se
  // repetir em RAs diferentes, e aí o rótulo e o erro ficariam ligados ao campo errado.
  const id = useId()
  const [texto, setTexto] = useState(() => notaNoCampo(valor))
  const [erro, setErro] = useState<string | null>(null)
  // Se a nota mudar por fora (outro campo, importar dados), o campo mostra a nova.
  const [anterior, setAnterior] = useState(valor)
  if (valor !== anterior) {
    setAnterior(valor)
    setTexto(notaNoCampo(valor))
    setErro(null)
  }

  function salvar() {
    const lida = lerNotaDigitada(texto, maximo)
    if (!lida.ok) {
      setErro(lida.erro)
      return
    }
    setErro(null)
    setTexto(notaNoCampo(lida.nota))
    if (lida.nota !== valor) aoSalvar(lida.nota)
  }

  const idDica = `${id}-dica`
  const idErro = `${id}-erro`
  const descricao = [dica && idDica, erro && idErro].filter(Boolean).join(' ')

  return (
    <div className="campo-nota">
      <label htmlFor={id} className="campo-nota__rotulo">
        {rotulo}
      </label>
      <div className="campo-nota__linha">
        <input
          id={id}
          className="campo campo-nota__entrada"
          inputMode="decimal"
          autoComplete="off"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') salvar()
            if (e.key === 'Escape') {
              setTexto(notaNoCampo(valor))
              setErro(null)
            }
          }}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricao || undefined}
        />
        <span className="muted campo-nota__maximo">de {formatarNota(maximo)}</span>
      </div>
      {dica && (
        <p id={idDica} className="campo-nota__dica">
          {dica}
        </p>
      )}
      {erro && (
        // alert: ao sair com Tab, o foco já está no próximo campo, e sem isto o erro passaria calado.
        <p id={idErro} role="alert" className="erro-campo">
          {erro}
        </p>
      )}
    </div>
  )
}
