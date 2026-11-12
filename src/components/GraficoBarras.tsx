export interface BarraDoGrafico {
  rotulo: string;
  /** null = sem dados: a barra fica vazia (nunca vira resultado negativo, RF-50). */
  valor: number | null;
  /** Texto do valor (em cima da barra e na leitura do VoiceOver). */
  texto: string;
}

interface Props {
  titulo: string;
  barras: BarraDoGrafico[];
  /** Valor que enche a barra por inteiro. */
  maximo: number;
}

const ALTURA = 110;

/** Gráfico de barras simples, desenhado à mão (sem biblioteca). Cor sempre neutra/verde: sem vermelho. */
export function GraficoBarras({ titulo, barras, maximo }: Props) {
  const leitura = `${titulo}: ${barras.map((b) => `${b.rotulo}, ${b.valor === null ? 'sem dados' : b.texto}`).join('; ')}`;
  return (
    <div role="img" aria-label={leitura} className="rounded-[20px] border border-borda bg-cartao px-3 pb-2 pt-3">
      <div aria-hidden="true" className="text-[14px] font-semibold">
        {titulo}
      </div>
      <div aria-hidden="true" className="mt-2 flex items-end gap-1.5">
        {barras.map((b, i) => {
          const pct = b.valor === null || maximo <= 0 ? 0 : Math.min(b.valor / maximo, 1);
          return (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center">
              <span className="mb-1 h-4 text-[12px] font-semibold text-texto2">{b.valor === null ? '—' : b.texto}</span>
              <div className="flex w-full items-end justify-center rounded-t-md bg-trilho" style={{ height: ALTURA }}>
                <div
                  className="w-full rounded-t-md bg-verde-barra"
                  style={{ height: pct === 0 ? 0 : Math.max(pct * ALTURA, 4) }}
                />
              </div>
              <span className="mt-1 h-4 whitespace-nowrap text-[11px] text-texto2">{b.rotulo}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
