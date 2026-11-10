import { useEffect, useRef, useState } from 'react';
import { useAreaVisivel } from '../hooks/useAreaVisivel';
import { arredondar } from '../services/calculos';
import { formatarNumero } from '../services/textos';

export interface ConfigJanela {
  modo: 'adicionar' | 'corrigir' | 'manual';
  titulo: string;
  subtitulo: string;
  unidade: string;
  valorInicial: number | null;
  passo: number;
  rodape: string;
  /** Só no registro manual (RF-16): horário editável "HH:MM". */
  horarioInicial?: string;
}

interface Props {
  config: ConfigJanela;
  aoConfirmar: (valor: number, horario?: string) => void;
  aoCancelar: () => void;
}

/** Converte "2,5" ou "2.5" em número. Vazio ou inválido = NaN. */
export function lerNumero(texto: string): number {
  const limpo = texto.trim().replace(',', '.');
  if (limpo === '' || !/^\d*\.?\d*$/.test(limpo)) return NaN;
  return Number(limpo);
}

/**
 * Janela de valor (RF-10 e RF-16): registrar um valor digitado, corrigir um
 * registro ou fazer um registro manual. Fechar tocando fora só vale depois de
 * 0,4 s, para não fechar sem querer ao soltar o dedo do toque longo.
 */
export function JanelaValor({ config, aoConfirmar, aoCancelar }: Props) {
  const [texto, setTexto] = useState(config.valorInicial === null ? '' : String(config.valorInicial).replace('.', ','));
  const [horario, setHorario] = useState(config.horarioInicial ?? '');
  const abertaEm = useRef(Date.now());
  const area = useAreaVisivel();

  useEffect(() => {
    abertaEm.current = Date.now();
  }, []);

  const valor = lerNumero(texto);
  const valido = Number.isFinite(valor) && valor > 0;
  const corrigindo = config.modo === 'corrigir';

  function ajustar(delta: number) {
    const atual = Number.isFinite(valor) ? valor : 0;
    const novo = Math.max(0, arredondar(atual + delta));
    setTexto(String(novo).replace('.', ','));
  }

  function fora() {
    if (Date.now() - abertaEm.current < 400) return;
    aoCancelar();
  }

  const rotuloConfirmar = valido
    ? `${corrigindo ? 'Salvar ' : 'Registrar +'}${formatarNumero(valor)} ${config.unidade}`.trim()
    : corrigindo
      ? 'Salvar'
      : 'Registrar';

  return (
    <div
      className={`fixed left-0 right-0 z-40 flex flex-col justify-end bg-[rgba(27,31,29,0.45)] ${area ? '' : 'inset-0'}`}
      style={area ? { top: area.top, height: area.height } : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) fora();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={config.titulo}
        className="mx-auto flex max-h-full w-full max-w-[480px] flex-col gap-4 overflow-y-auto rounded-t-3xl bg-cartao px-5 pt-5"
        style={{ paddingBottom: area?.tecladoAberto ? '12px' : 'max(env(safe-area-inset-bottom), 24px)' }}
      >
        <div className="flex flex-col gap-1">
          <div className="text-[18px] font-bold">{config.titulo}</div>
          <div className="text-[14px] text-texto2">{config.subtitulo}</div>
        </div>

        <div className="flex items-center justify-center gap-2.5">
          <button
            type="button"
            aria-label="Diminuir"
            onClick={() => ajustar(-config.passo)}
            className="size-12 rounded-full border-[1.5px] border-borda-bloco bg-cartao p-0 text-[24px] font-semibold text-verde"
          >
            −
          </button>
          <input
            type="text"
            inputMode="decimal"
            aria-label={`Quantidade em ${config.unidade}`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onFocus={(e) => e.target.select()}
            className="box-border h-14 w-[110px] rounded-[14px] border-[1.5px] border-cinza-anel bg-cartao text-center text-[28px] font-bold text-texto"
          />
          <div className="min-w-11 text-[16px] font-semibold text-texto2">{config.unidade}</div>
          <button
            type="button"
            aria-label="Aumentar"
            onClick={() => ajustar(config.passo)}
            className="size-12 rounded-full border-[1.5px] border-borda-bloco bg-cartao p-0 text-[24px] font-semibold text-verde"
          >
            +
          </button>
        </div>

        {config.modo === 'manual' && (
          <label className="flex items-center justify-center gap-3 text-[15px]">
            <span className="text-texto2">Horário</span>
            <input
              type="time"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              className="box-border h-11 rounded-xl border-[1.5px] border-cinza-anel bg-cartao px-3 text-[16px] text-texto"
            />
          </label>
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
            disabled={!valido}
            onClick={() => valido && aoConfirmar(valor, config.modo === 'manual' ? horario || undefined : undefined)}
            className={`h-12 flex-[1.4] rounded-full border-0 text-[15px] font-bold text-white ${
              valido ? 'bg-verde' : 'bg-cinza-anel'
            }`}
          >
            {rotuloConfirmar}
          </button>
        </div>
        <div className="text-center text-[12px] text-texto2">{config.rodape}</div>
      </div>
    </div>
  );
}
