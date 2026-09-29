import type { ErroCampo, IdsRegra, RegraForm } from './novaMateriaUtil'
import './novaMateria.css'
import { Rotulado } from './Rotulado'

interface Props {
  legenda: string
  regra: RegraForm
  /** Ids dos campos: o erro aponta para eles, e dois formulários não podem repetir. */
  ids: IdsRegra
  /** Erro da conferência (erroRegra); só aparece se for de um destes campos. */
  erro: ErroCampo | null
  /** `campo` é o id do campo que mudou, para quem chama tirar o erro dele. */
  mudar: (campos: Partial<RegraForm>, campo?: string) => void
}

/**
 * Os campos de uma regra de aprovação: média, frequência, recuperação e arredondamento.
 * Usado na regra própria de uma matéria e na regra padrão do painel (tela Dados).
 */
export function CamposRegra({ legenda, regra: r, ids, erro, mudar }: Props) {
  return (
    <fieldset className="nm-grupo">
      <legend>{legenda}</legend>
      <div className="nm-item__campos">
        <Rotulado id={ids.media} rotulo="Média mínima" dica="De 0 a 10." erro={erro}>
          {(p) => (
            <input
              {...p}
              className="campo"
              inputMode="decimal"
              autoComplete="off"
              value={r.mediaMinima}
              onChange={(e) => mudar({ mediaMinima: e.target.value }, ids.media)}
            />
          )}
        </Rotulado>
        <Rotulado id={ids.frequencia} rotulo="Frequência mínima (%)" dica="Ex.: 75." erro={erro}>
          {(p) => (
            <input
              {...p}
              className="campo"
              inputMode="decimal"
              autoComplete="off"
              value={r.frequenciaMinima}
              onChange={(e) => mudar({ frequenciaMinima: e.target.value }, ids.frequencia)}
            />
          )}
        </Rotulado>
      </div>
      <label className="nm-caixa">
        <input
          type="checkbox"
          checked={r.temRecuperacao}
          onChange={(e) => mudar({ temRecuperacao: e.target.checked })}
        />
        Tem recuperação no fim do semestre
      </label>
      {r.temRecuperacao && (
        <div className="nm-item__campos">
          <Rotulado
            id={ids.notaMinima}
            rotulo="Nota final mínima para a recuperação"
            dica="Abaixo dela, reprova direto."
            erro={erro}
          >
            {(p) => (
              <input
                {...p}
                className="campo"
                inputMode="decimal"
                autoComplete="off"
                value={r.notaMinima}
                onChange={(e) => mudar({ notaMinima: e.target.value }, ids.notaMinima)}
              />
            )}
          </Rotulado>
          <Rotulado
            id={ids.teto}
            rotulo="Nota máxima da recuperação"
            dica="A recuperação não dá mais que isso a um RA."
            erro={erro}
          >
            {(p) => (
              <input
                {...p}
                className="campo"
                inputMode="decimal"
                autoComplete="off"
                value={r.teto}
                onChange={(e) => mudar({ teto: e.target.value }, ids.teto)}
              />
            )}
          </Rotulado>
        </div>
      )}
      <label className="nm-caixa">
        <input
          type="checkbox"
          checked={r.arredondarUmaCasa}
          onChange={(e) => mudar({ arredondarUmaCasa: e.target.checked })}
        />
        Arredondar a nota final para 1 casa (6,95 vira 7,0)
      </label>
    </fieldset>
  )
}
