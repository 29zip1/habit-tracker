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
    // Há um campo de digitar com o cursor? Então o teclado está na tela, mesmo que
    // o iPhone não tenha mudado o tamanho que informa (era o que deixava um
    // vazio entre os botões e o teclado).
    const digitando = () => {
      const el = document.activeElement;
      if (el instanceof HTMLTextAreaElement) return true;
      if (!(el instanceof HTMLInputElement)) return false;
      return !['checkbox', 'radio', 'button', 'submit', 'date', 'time', 'range', 'color'].includes(el.type);
    };
    const atualizar = () =>
      setArea({
        top: vv.offsetTop,
        height: vv.height,
        tecladoAberto: tecladoEstaAberto(window.innerHeight, vv.height) || digitando(),
      });
    atualizar();
    // No iPhone o teclado abre com animação e o aviso de resize pode chegar cedo
    // demais: remede um pouco depois de tocar ou sair de um campo.
    let timers: number[] = [];
    const remedir = () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers = [100, 300, 600].map((ms) => window.setTimeout(atualizar, ms));
    };
    vv.addEventListener('resize', atualizar);
    vv.addEventListener('scroll', atualizar);
    window.addEventListener('focusin', remedir);
    window.addEventListener('focusout', remedir);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      vv.removeEventListener('resize', atualizar);
      vv.removeEventListener('scroll', atualizar);
      window.removeEventListener('focusin', remedir);
      window.removeEventListener('focusout', remedir);
    };
  }, []);

  return area;
}
