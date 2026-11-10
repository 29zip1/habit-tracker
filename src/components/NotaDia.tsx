import { useState } from 'react';

export const LIMITE_NOTA = 280;

/** RF-37: nota curta do dia (até 280 caracteres). */
export function NotaDia({
  titulo,
  inicial,
  aoSalvar,
  aoCancelar,
}: {
  titulo: string;
  inicial: string;
  aoSalvar: (texto: string) => void;
  aoCancelar: () => void;
}) {
  const [texto, setTexto] = useState(inicial);
  const restantes = LIMITE_NOTA - texto.length;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end bg-[rgba(27,31,29,0.45)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoCancelar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="mx-auto flex w-full max-w-[480px] flex-col gap-3 rounded-t-3xl bg-cartao px-5 pt-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
      >
        <div className="text-[18px] font-bold">{titulo}</div>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, LIMITE_NOTA))}
          rows={4}
          aria-label="Nota do dia"
          placeholder="Escreva uma observação sobre o dia"
          className="box-border w-full resize-none rounded-[14px] border-[1.5px] border-cinza-anel bg-cartao p-3 text-[16px] text-texto"
        />
        <div className={`text-right text-[12px] ${restantes < 20 ? 'text-laranja' : 'text-texto2'}`}>
          {texto.length} / {LIMITE_NOTA}
        </div>
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
            onClick={() => aoSalvar(texto.trim())}
            className="h-12 flex-1 rounded-full border-0 bg-verde text-[15px] font-bold text-white"
          >
            Salvar nota
          </button>
        </div>
      </div>
    </div>
  );
}
