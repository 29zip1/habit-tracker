import { useEffect } from 'react';
import { operacoes } from '../database/operacoes';
import { COR_BARRA_STATUS, resolverTema, type TemaEscolhido } from '../services/tema';
import { CONFIG_PADRAO } from '../types';
import { useLive } from './useLive';

function aplicar(escolhido: TemaEscolhido) {
  const escuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const tema = resolverTema(escolhido, escuro);
  document.documentElement.dataset.tema = tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA_STATUS[tema]);
  try {
    // Guardado também aqui para o próximo início já abrir com o tema certo, sem piscar.
    localStorage.setItem('tema', escolhido);
  } catch {
    /* sem armazenamento local: o tema continua funcionando, só pode piscar ao abrir */
  }
}

/** Aplica o tema escolhido e acompanha o modo do iPhone quando está em "Sistema". */
export function useTema() {
  const config = useLive(() => operacoes.lerConfig(), [], CONFIG_PADRAO);
  useEffect(() => {
    aplicar(config.tema);
    const midia = window.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = () => aplicar(config.tema);
    midia.addEventListener('change', aoMudar);
    return () => midia.removeEventListener('change', aoMudar);
  }, [config.tema]);
}
