import type { ResumoDia } from '../services/calculos';
import { dataCabecalho, diaSemanaLongo, etiquetaStatus, textoConcluidas } from '../services/textos';

/** RF-01: dia da semana, data, percentual, etiqueta, barra e texto de apoio. */
export function Cabecalho({ resumo, nomesAParte }: { resumo: ResumoDia; nomesAParte: string[] }) {
  const completo = resumo.estado === 'completo';
  const pct = resumo.percentual;
  return (
    <header className="px-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] font-semibold tracking-[0.06em] text-texto2">{diaSemanaLongo(resumo.data)}</div>
          <div className="text-[30px] font-bold leading-[1.15]">{dataCabecalho(resumo.data)}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-[30px] font-bold leading-[1.15]" aria-label={pct === null ? 'sem percentual' : `${pct} por cento`}>
            {pct === null ? '—' : `${pct}%`}
          </div>
          <div
            className={`rounded-[10px] px-2.5 py-0.5 text-[12px] ${
              completo ? 'bg-verde font-bold text-white' : 'bg-chip font-semibold text-chip-texto'
            }`}
          >
            {etiquetaStatus(resumo)}
          </div>
        </div>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded bg-trilho"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? 0}
        aria-label="Progresso do dia"
      >
        <div className="barra h-2 rounded bg-verde" style={{ width: `${pct ?? 0}%` }} />
      </div>
      <div className="mt-2 text-[13px] text-texto2">{textoConcluidas(resumo, nomesAParte)}</div>
    </header>
  );
}
