import type { ResumoDia } from '../services/calculos';
import type { DataLocal } from '../types';
import { descricaoEstado, diaSemanaCurto, diaSemanaNome, numeroDoDia } from '../services/textos';

export function Indicador({ r, ehHoje }: { r: ResumoDia; ehHoje: boolean }) {
  // Sempre por FORMA, nunca só por cor (RF-03, RF-24).
  switch (r.estado) {
    case 'completo':
      return <span aria-hidden="true" className="size-3.5 rounded-full bg-verde-barra" />;
    case 'parcial':
      return (
        <span
          aria-hidden="true"
          className="box-border size-3.5 rounded-full border-2 border-verde-texto"
          style={{ background: 'linear-gradient(90deg, var(--color-verde-texto) 50%, transparent 50%)' }}
        />
      );
    case 'folga':
      return (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" className="text-texto2">
          <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M3.5 7h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'descanso':
      return <span aria-hidden="true" className="size-1.5 rounded-full bg-cinza-anel" />;
    case 'futuro':
      return <span aria-hidden="true" className="size-3.5" />;
    default: // sem dados: hoje = anel vazio; outros dias = círculo tracejado
      return ehHoje ? (
        <span aria-hidden="true" className="box-border size-3.5 rounded-full border-2 border-verde-texto" />
      ) : (
        <span aria-hidden="true" className="box-border size-3.5 rounded-full border-2 border-dashed border-cinza-anel" />
      );
  }
}

interface Props {
  dias: ResumoDia[];
  hoje: DataLocal;
  selecionada: DataLocal;
  aoSelecionar: (data: DataLocal) => void;
}

/** RF-03: os 6 dias anteriores + hoje. */
export function FaixaDias({ dias, hoje, selecionada, aoSelecionar }: Props) {
  return (
    <div className="mx-3 mt-3 flex justify-between" role="group" aria-label="Últimos 7 dias">
      {dias.map((r) => {
        const ehHoje = r.data === hoje;
        const ativa = r.data === selecionada;
        const rotuloDia = ehHoje ? 'Hoje' : diaSemanaCurto(r.data);
        const aria = `${ehHoje ? 'Hoje, ' : ''}${diaSemanaNome(r.data).toLowerCase()} ${numeroDoDia(r.data)}: ${descricaoEstado(r.estado)}`;
        return (
          <button
            key={r.data}
            type="button"
            aria-label={aria}
            aria-pressed={ativa}
            onClick={() => aoSelecionar(r.data)}
            className={`flex h-16 w-12 flex-col items-center justify-center gap-1 p-0 ${
              ativa ? 'rounded-2xl border-[1.5px] border-verde-texto bg-cartao text-verde-texto' : 'border-0 bg-transparent text-texto2'
            }`}
          >
            <span className={`text-[12px] ${ativa || ehHoje ? 'font-semibold' : ''}`}>{rotuloDia}</span>
            <span className={`text-[15px] text-texto ${ativa ? 'font-bold' : 'font-semibold'}`}>{numeroDoDia(r.data)}</span>
            <Indicador r={r} ehHoje={ehHoje} />
          </button>
        );
      })}
    </div>
  );
}
