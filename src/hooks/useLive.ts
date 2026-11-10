import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import type { DataLocal } from '../types';
import { dataLogica } from '../services/datas';

/**
 * Mantém um valor sempre igual ao banco: qualquer gravação refaz a consulta
 * (é isso que atualiza totais, barras e percentual na hora, RF-17).
 */
export function useLive<T>(consulta: () => Promise<T>, deps: unknown[], inicial: T): T {
  const [valor, setValor] = useState<T>(inicial);
  useEffect(() => {
    const sub = liveQuery(consulta).subscribe({
      next: setValor,
      error: (e) => console.error('Erro ao ler o banco', e),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return valor;
}

/** Data lógica de hoje; vira sozinha na virada do dia (RF-21). */
export function useDataHoje(inicioDoDiaHora: number): DataLocal {
  const [hoje, setHoje] = useState(() => dataLogica(new Date(), inicioDoDiaHora));
  useEffect(() => {
    const atualizar = () => setHoje(dataLogica(new Date(), inicioDoDiaHora));
    atualizar();
    const timer = window.setInterval(atualizar, 15_000);
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') atualizar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', atualizar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', atualizar);
    };
  }, [inicioDoDiaHora]);
  return hoje;
}
