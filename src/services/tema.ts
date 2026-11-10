// Tema claro/escuro (RF-24 vale nos dois). A escolha fica em Configurações.
import type { ConfigApp } from '../types';

export type TemaEscolhido = ConfigApp['tema'];
export type TemaAplicado = 'claro' | 'escuro';

/** "sistema" segue o iPhone; "claro" e "escuro" são fixos. */
export function resolverTema(escolhido: TemaEscolhido, sistemaEscuro: boolean): TemaAplicado {
  if (escolhido === 'escuro') return 'escuro';
  if (escolhido === 'claro') return 'claro';
  return sistemaEscuro ? 'escuro' : 'claro';
}

export const COR_BARRA_STATUS: Record<TemaAplicado, string> = {
  claro: '#f7f8f6',
  escuro: '#101412',
};
