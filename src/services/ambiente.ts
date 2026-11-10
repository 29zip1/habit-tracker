// Detecta se o app está aberto pelo ícone da Tela de Início (RF-68).
export function estaInstalado(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export interface StatusArmazenamento {
  persistente: boolean | 'indisponivel';
  usadoKB: number | null;
}

// RF-67: pede armazenamento persistente quando o iOS permite.
// Nunca é garantia; o texto da tela deve dizer isso.
export async function lerArmazenamento(): Promise<StatusArmazenamento> {
  let persistente: boolean | 'indisponivel' = 'indisponivel';
  try {
    if (navigator.storage?.persisted) {
      persistente = await navigator.storage.persisted();
      if (!persistente && navigator.storage.persist) {
        persistente = await navigator.storage.persist();
      }
    }
  } catch {
    persistente = 'indisponivel';
  }
  let usadoKB: number | null = null;
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.usage !== undefined) usadoKB = Math.round(est.usage / 1024);
  } catch {
    usadoKB = null;
  }
  return { persistente, usadoKB };
}
