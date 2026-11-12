import { useEffect, useRef } from 'react';
import type { ResumoDia } from '../services/calculos';
import { colunaDaData, mesQueComecaNaColuna } from '../services/evolucao';
import { NOMES_MESES, rotulosDaSemana } from '../services/historico';
import type { DataLocal } from '../types';
import { Indicador } from './FaixaDias';

interface Props {
  grelha: (DataLocal | null)[][];
  resumos: Map<DataLocal, ResumoDia>;
  hoje: DataLocal;
  /** Primeiro dia com registro: antes dele a célula fica vazia (não vira "sem dados"). */
  primeiraData?: DataLocal;
  inicioSemana: number;
  /** Texto para o VoiceOver. */
  leitura: string;
}

const LARGURA_COLUNA = 22;

/** RF-52: um quadrado por dia do ano, com as mesmas formas do RF-03 (nunca só cor). */
export function MapaCalor({ grelha, resumos, hoje, primeiraData, inicioSemana, leitura }: Props) {
  const rolagem = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const coluna = colunaDaData(grelha, hoje);
    if (coluna >= 0) el.scrollLeft = Math.max(0, coluna * LARGURA_COLUNA - el.clientWidth / 2);
  }, [grelha, hoje]);

  const dias = rotulosDaSemana(inicioSemana);
  return (
    <div role="img" aria-label={leitura} className="flex rounded-[20px] border border-borda bg-cartao py-3 pl-3">
      <div aria-hidden="true" className="mr-1 flex shrink-0 flex-col pt-5 text-[10px] text-texto2">
        {dias.map((d, i) => (
          <span key={i} className="flex items-center" style={{ height: LARGURA_COLUNA }}>
            {i % 2 === 0 ? d : ''}
          </span>
        ))}
      </div>
      <div ref={rolagem} className="min-w-0 flex-1 overflow-x-auto pr-3" aria-hidden="true">
        <div className="flex" style={{ width: grelha.length * LARGURA_COLUNA }}>
          {grelha.map((coluna, i) => {
            const mes = mesQueComecaNaColuna(coluna);
            return (
              <div key={i} className="flex shrink-0 flex-col" style={{ width: LARGURA_COLUNA }}>
                <span className="h-5 whitespace-nowrap text-[10px] text-texto2">{mes ? NOMES_MESES[mes - 1].slice(0, 3) : ''}</span>
                {coluna.map((data, j) => {
                  const r = data ? resumos.get(data) : undefined;
                  const mostrar = data && r && data <= hoje && (primeiraData === undefined || data >= primeiraData);
                  return (
                    <div
                      key={j}
                      className={`flex items-center justify-center ${data === hoje ? 'rounded-md border-[1.5px] border-verde-texto' : ''}`}
                      style={{ height: LARGURA_COLUNA, width: LARGURA_COLUNA }}
                    >
                      {mostrar ? <Indicador r={r} ehHoje={data === hoje} /> : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
