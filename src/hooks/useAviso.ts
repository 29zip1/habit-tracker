import { useCallback, useEffect, useRef, useState } from 'react';

export interface Aviso {
  rotulo: string;
  /** Verde quando a ação fez cruzar a meta (RF-15). */
  cruzou: boolean;
  desfazer: () => Promise<void> | void;
}

/** Aviso com "Desfazer" por 6 segundos. Desfaz só a última ação (RF-15). */
export function useAviso() {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const limpar = useCallback(() => {
    window.clearTimeout(timer.current);
    setAviso(null);
  }, []);

  const mostrar = useCallback((novo: Aviso) => {
    window.clearTimeout(timer.current);
    setAviso(novo);
    timer.current = window.setTimeout(() => setAviso(null), 6000);
  }, []);

  const desfazer = useCallback(async () => {
    if (!aviso) return;
    const acao = aviso.desfazer;
    window.clearTimeout(timer.current);
    setAviso(null);
    await acao();
  }, [aviso]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { aviso, mostrar, desfazer, limpar };
}
