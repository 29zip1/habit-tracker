import { useEffect } from 'react';
import { criarCopiaDiariaSegura } from '../database/copias';
import { db } from '../database/db';
import { operacoes } from '../database/operacoes';
import { CONFIG_PADRAO } from '../types';
import { useDataHoje, useLive } from './useLive';

/** RF-69: na primeira abertura de cada dia, guarda a cópia automática (se algo mudou). */
export function useCopiaDiaria() {
  const config = useLive(() => operacoes.lerConfig(), [], CONFIG_PADRAO);
  const hoje = useDataHoje(config.inicioDoDiaHora);
  useEffect(() => {
    void criarCopiaDiariaSegura(db, __APP_VERSION__, hoje);
  }, [hoje]);
}
