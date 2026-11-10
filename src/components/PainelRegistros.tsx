import { Trash2 } from 'lucide-react';
import type { Registro } from '../types';
import { formatarNumero } from '../services/textos';

interface Props {
  titulo: string;
  /** "Total: 30 min · meta 30" ou "Total: 620 kcal · limite 1.500" */
  totalTexto: string;
  unidade: string;
  registros: Registro[];
  aoCorrigir: (registro: Registro) => void;
  aoExcluir: (registro: Registro) => void;
  aoRegistroManual: () => void;
  aoFechar: () => void;
}

/** RF-16: registros do dia de um hábito, com corrigir, excluir e registro manual. */
export function PainelRegistros({
  titulo,
  totalTexto,
  unidade,
  registros,
  aoCorrigir,
  aoExcluir,
  aoRegistroManual,
  aoFechar,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-end bg-[rgba(27,31,29,0.45)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="mx-auto flex max-h-[70dvh] w-full max-w-[480px] flex-col gap-3 rounded-t-3xl bg-cartao px-5 pt-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
      >
        <div className="flex flex-col gap-1">
          <div className="text-[18px] font-bold">{titulo}</div>
          <div className="text-[14px] text-texto2">{totalTexto}</div>
        </div>

        {registros.length === 0 && <div className="py-3 text-[14px] text-texto2">Nenhum registro neste dia.</div>}

        <ul className="m-0 flex list-none flex-col overflow-y-auto p-0">
          {registros.map((r) => (
            <li key={r.id} className="flex min-h-14 items-center gap-2 border-t border-linha">
              <div className="w-12 shrink-0 text-[13px] text-texto2">{r.horario}</div>
              <div className="flex-1 text-[16px] font-semibold">
                +{formatarNumero(r.valor)} {unidade}
              </div>
              <button
                type="button"
                aria-label={`Corrigir registro das ${r.horario}`}
                onClick={() => aoCorrigir(r)}
                className="h-11 rounded-full border-[1.5px] border-borda-bloco bg-cartao px-3.5 text-[14px] font-semibold text-verde"
              >
                Corrigir
              </button>
              <button
                type="button"
                aria-label={`Excluir registro das ${r.horario}`}
                onClick={() => aoExcluir(r)}
                className="flex size-11 items-center justify-center rounded-full border-0 bg-transparent p-0"
              >
                <Trash2 size={20} strokeWidth={2} color="var(--color-vermelho)" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={aoRegistroManual}
            className="h-12 flex-1 rounded-full border-[1.5px] border-verde bg-cartao text-[15px] font-semibold text-verde"
          >
            + Registro manual
          </button>
          <button
            type="button"
            onClick={aoFechar}
            className="h-12 flex-1 rounded-full border-0 bg-verde text-[15px] font-bold text-white"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
