import { useEffect, useState } from 'react';

export interface AreaVisivel {
  top: number;
  height: number;
  tecladoAberto: boolean;
}

/** Teclado aberto = a área visível ficou bem menor que a janela. */
export function tecladoEstaAberto(alturaJanela: number, alturaVisivel: number): boolean {
  return alturaJanela - alturaVisivel > 120;
}

/**
 * No iPhone o teclado NÃO encolhe a página: ele cobre a parte de baixo.
 * Janelas ancoradas embaixo (valor, nota) ficavam atrás do teclado.
 * A "área visível" (visualViewport) muda quando o teclado abre; as janelas
 * usam esse tamanho para ficar logo acima do teclado.
 * Retorna null onde o navegador não oferece isso.
 */
export function useAreaVisivel(): AreaVisivel | null {
  const [area, setArea] = useState<AreaVisivel | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const atualizar = () =>
      setArea({
        top: vv.offsetTop,
        height: vv.height,
        tecladoAberto: tecladoEstaAberto(window.innerHeight, vv.height),
      });
    atualizar();
    vv.addEventListener('resize', atualizar);
    vv.addEventListener('scroll', atualizar);
    return () => {
      vv.removeEventListener('resize', atualizar);
      vv.removeEventListener('scroll', atualizar);
    };
  }, []);

  return area;
}
