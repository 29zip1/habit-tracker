import type { ResumoDia } from '../services/calculos';
import { descricaoEstado, diaSemanaNome, numeroDoDia } from '../services/textos';
import { gradeDoMes, rotulosDaSemana, type MesRef } from '../services/historico';
import type { DataLocal } from '../types';
import { Indicador } from './FaixaDias';

interface Props {
  mes: MesRef;
  hoje: DataLocal;
  inicioSemana: number;
  /** Estado de cada dia do mês (já com o filtro de hábito aplicado). */
  resumos: Map<DataLocal, ResumoDia>;
  /** Dias com nota. */
  comNota: Set<DataLocal>;
  aoEscolher: (data: DataLocal) => void;
}

/** RF-40: calendário mensal com as mesmas formas da faixa dos 7 dias (RF-03). */
export function CalendarioMes({ mes, hoje, inicioSemana, resumos, comNota, aoEscolher }: Props) {
  const semanas = gradeDoMes(mes, inicioSemana);
  return (
    <div role="grid" aria-label="Calendário do mês" className="rounded-[20px] border border-borda bg-cartao p-2">
      <div role="row" className="grid grid-cols-7 pb-1">
        {rotulosDaSemana(inicioSemana).map((r, i) => (
          <div key={i} role="columnheader" className="text-center text-[12px] font-semibold text-texto2">
            {r}
          </div>
        ))}
      </div>
      {semanas.map((semana, i) => (
        <div key={i} role="row" className="grid grid-cols-7">
          {semana.map((data, j) => {
            if (data === null) return <div key={j} role="gridcell" aria-hidden="true" className="h-14" />;
            const r = resumos.get(data);
            const futuro = data > hoje;
            const ehHoje = data === hoje;
            const nota = comNota.has(data);
            return (
              <div key={j} role="gridcell" className="flex justify-center">
                <button
                  type="button"
                  disabled={futuro}
                  aria-label={`${diaSemanaNome(data).toLowerCase()} ${numeroDoDia(data)}${ehHoje ? ', hoje' : ''}: ${
                    r ? descricaoEstado(r.estado) : 'sem informação'
                  }${nota ? ', com nota' : ''}`}
                  onClick={() => aoEscolher(data)}
                  className={`relative flex h-14 w-full max-w-[46px] flex-col items-center justify-center gap-1 rounded-xl p-0 ${
                    ehHoje ? 'border-[1.5px] border-verde-texto bg-verde-claro' : 'border-0 bg-transparent'
                  } ${futuro ? 'opacity-40' : ''}`}
                >
                  <span className={`text-[15px] text-texto ${ehHoje ? 'font-bold' : 'font-semibold'}`}>{numeroDoDia(data)}</span>
                  {r && !futuro ? <Indicador r={r} ehHoje={ehHoje} /> : <span aria-hidden="true" className="size-3.5" />}
                  {nota && <span aria-hidden="true" className="absolute right-1 top-1 size-1.5 rounded-full bg-texto2" />}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
