import { useEffect, useRef, useState } from 'react';
import { useAreaVisivel } from '../hooks/useAreaVisivel';
import { numeroDoTexto } from '../services/habitos';
import { LIMITE_OBSERVACAO } from '../types';

export interface ResultadoComplemento {
  /** null = sem medida (campo vazio remove a medida do dia). */
  medida: number | null;
  observacao: string;
}

interface Props {
  titulo: string;
  /** Mostra o campo da medida (só quando o hábito tem a medida ligada). */
  mostrarMedida: boolean;
  unidade: string;
  medidaInicial: string;
  mostrarObservacao: boolean;
  observacaoInicial: string;
  aoSalvar: (r: ResultadoComplemento) => void;
  aoCancelar: () => void;
}

const campo = 'box-border h-12 w-full rounded-[14px] border-[1.5px] border-cinza-anel bg-cartao px-3 text-[16px] text-texto';

/**
 * RF-85: ao entrar num campo, o cursor vai para o FIM do texto. O iPhone sobrescreve o
 * cursor enquanto o teclado abre e a janelinha se acomoda, então repete depois de
 * um instante (o que também faz o iPhone redesenhar o cursor dentro da caixa).
 */
const ATRASOS_CURSOR_MS = [0, 120, 350, 650];

/** RF-83 e RF-84: janelinha do lápis, só com os campos que o hábito tem ligados. Tudo opcional. */
export function JanelaComplemento({
  titulo,
  mostrarMedida,
  unidade,
  medidaInicial,
  mostrarObservacao,
  observacaoInicial,
  aoSalvar,
  aoCancelar,
}: Props) {
  const [medida, setMedida] = useState(medidaInicial);
  const [observacao, setObservacao] = useState(observacaoInicial);
  const [erro, setErro] = useState('');
  const area = useAreaVisivel();
  const timersCursor = useRef<number[]>([]);

  function limparCursor() {
    timersCursor.current.forEach((t) => window.clearTimeout(t));
    timersCursor.current = [];
  }

  useEffect(() => limparCursor, []);

  function cursorNoFim(campoEl: HTMLInputElement) {
    limparCursor();
    timersCursor.current = ATRASOS_CURSOR_MS.map((ms) =>
      window.setTimeout(() => {
        if (document.activeElement !== campoEl) return;
        const fim = campoEl.value.length;
        try {
          campoEl.setSelectionRange(fim, fim);
        } catch {
          /* campo sem seleção: ignora */
        }
      }, ms),
    );
  }

  function salvar() {
    let valor: number | null = null;
    if (mostrarMedida && medida.trim() !== '') {
      valor = numeroDoTexto(medida);
      if (!(valor > 0)) {
        setErro('A medida precisa ser um número maior que zero. Deixe vazio para não anotar.');
        return;
      }
    }
    aoSalvar({ medida: mostrarMedida ? valor : null, observacao: mostrarObservacao ? observacao.trim() : '' });
  }

  return (
    <div
      className={`fixed left-0 right-0 z-40 flex flex-col justify-end bg-[rgba(27,31,29,0.45)] ${area ? '' : 'inset-0'}`}
      style={area ? { top: area.top, height: area.height } : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) aoCancelar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="mx-auto flex max-h-full w-full max-w-[480px] flex-col gap-3 overflow-y-auto rounded-t-3xl bg-cartao px-5 pt-5"
        style={{ paddingBottom: area?.tecladoAberto ? '12px' : 'max(env(safe-area-inset-bottom), 24px)' }}
      >
        <div className="text-[18px] font-bold">{titulo}</div>

        {mostrarMedida && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold">Medida (opcional)</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                aria-label={`Medida em ${unidade}`}
                value={medida}
                placeholder="Ex.: 40"
                onFocus={(e) => cursorNoFim(e.currentTarget)}
                onPointerDown={limparCursor}
                onChange={(e) => {
                  setMedida(e.target.value);
                  setErro('');
                }}
                className={campo}
              />
              <span className="shrink-0 text-[15px] text-texto2">{unidade}</span>
            </div>
          </label>
        )}

        {mostrarObservacao && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold">Observação (opcional)</span>
            <input
              type="text"
              aria-label="Observação do hábito"
              value={observacao}
              maxLength={LIMITE_OBSERVACAO}
              placeholder="Ex.: esteira, treino forte"
              onFocus={(e) => cursorNoFim(e.currentTarget)}
              onPointerDown={limparCursor}
              onChange={(e) => setObservacao(e.target.value.slice(0, LIMITE_OBSERVACAO))}
              className={campo}
            />
            <span className="text-right text-[12px] text-texto2">
              {observacao.length} / {LIMITE_OBSERVACAO}
            </span>
          </label>
        )}

        {erro && (
          <p role="alert" className="rounded-xl border border-laranja bg-laranja-claro p-2.5 text-[14px] text-laranja-texto">
            {erro}
          </p>
        )}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={aoCancelar}
            className="h-12 flex-1 rounded-full border-[1.5px] border-cinza-anel bg-cartao text-[15px] font-semibold text-texto"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            className="h-12 flex-1 rounded-full border-0 bg-verde text-[15px] font-bold text-white"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
