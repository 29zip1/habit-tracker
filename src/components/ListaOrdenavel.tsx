import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { deslocamentoDaLinha, moverItem, posicaoDeDestino } from '../services/ordenar';

const TEMPO_SEGURAR_MS = 400;
const TOLERANCIA_PX = 10;
const ZONA_DE_BORDA_PX = 70;

interface Arrasto {
  id: string;
  de: number;
  para: number;
  dy: number;
  altura: number;
}

interface Props {
  /** Ids na ordem em que as linhas (children) aparecem. */
  ids: string[];
  aoReordenar: (novosIds: string[]) => void;
  /** Uma linha por id, na mesma ordem. */
  children: ReactNode;
}

/** Quem rola a página em volta da lista (a tela inteira de Hábitos). */
function acharRolavel(el: HTMLElement): HTMLElement {
  let p = el.parentElement;
  while (p) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') return p;
    p = p.parentElement;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

/**
 * RF-33b: reordenar segurando e arrastando. Segurar ~0,4 s levanta a linha; arrastar
 * abre espaço; soltar grava. Um arrasto rápido, sem segurar, só rola a página.
 * Usa eventos de toque "não passivos" para poder impedir a rolagem depois de levantar.
 */
export function ListaOrdenavel({ ids, aoReordenar, children }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const avisar = useRef(aoReordenar);
  avisar.current = aoReordenar;

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;

    let pendente: { id: string; x: number; y: number; timer: number } | null = null;
    let ativo: {
      de: number;
      para: number;
      meios: number[];
      inicioY: number;
      ultimoY: number;
      rolavel: HTMLElement;
      quadro: number;
    } | null = null;

    const parar = () => {
      if (ativo) window.cancelAnimationFrame(ativo.quadro);
      ativo = null;
      setArrasto(null);
    };

    const atualizar = (clientY: number) => {
      if (!ativo) return;
      ativo.ultimoY = clientY;
      const dy = clientY + ativo.rolavel.scrollTop - ativo.inicioY;
      const centro = ativo.meios[ativo.de] + dy;
      ativo.para = posicaoDeDestino(ativo.meios, ativo.de, centro);
      const linha = el.querySelectorAll<HTMLElement>('[data-ordem-id]')[ativo.de];
      setArrasto({
        id: idsRef.current[ativo.de],
        de: ativo.de,
        para: ativo.para,
        dy,
        altura: linha?.getBoundingClientRect().height ?? 64,
      });
    };

    // A lista rola sozinha quando o dedo chega perto da borda de cima ou de baixo.
    const rolarSozinho = () => {
      if (!ativo) return;
      const r = ativo.rolavel.getBoundingClientRect();
      const topo = Math.max(r.top, 0);
      const base = Math.min(r.bottom, window.innerHeight);
      let passo = 0;
      if (ativo.ultimoY < topo + ZONA_DE_BORDA_PX) passo = -10;
      else if (ativo.ultimoY > base - ZONA_DE_BORDA_PX) passo = 10;
      if (passo !== 0) {
        ativo.rolavel.scrollTop += passo;
        atualizar(ativo.ultimoY);
      }
      ativo.quadro = window.requestAnimationFrame(rolarSozinho);
    };

    const levantar = (id: string, y: number) => {
      const de = idsRef.current.indexOf(id);
      if (de < 0) return;
      const rolavel = acharRolavel(el);
      const linhas = [...el.querySelectorAll<HTMLElement>('[data-ordem-id]')];
      const meios = linhas.map((l) => {
        const r = l.getBoundingClientRect();
        return r.top + rolavel.scrollTop + r.height / 2;
      });
      ativo = {
        de,
        para: de,
        meios,
        inicioY: y + rolavel.scrollTop,
        ultimoY: y,
        rolavel,
        quadro: window.requestAnimationFrame(rolarSozinho),
      };
      setArrasto({ id, de, para: de, dy: 0, altura: linhas[de].getBoundingClientRect().height });
    };

    const aoTocar = (e: TouchEvent) => {
      if (ativo || e.touches.length !== 1) return;
      const linha = (e.target as Element).closest<HTMLElement>('[data-ordem-id]');
      if (!linha) return;
      const t = e.touches[0];
      const id = linha.dataset.ordemId as string;
      if (pendente) window.clearTimeout(pendente.timer);
      pendente = {
        id,
        x: t.clientX,
        y: t.clientY,
        timer: window.setTimeout(() => {
          if (pendente) levantar(pendente.id, pendente.y);
          pendente = null;
        }, TEMPO_SEGURAR_MS),
      };
    };

    const aoMover = (e: TouchEvent) => {
      const t = e.touches[0];
      if (pendente) {
        // Mexeu antes de 0,4 s: é rolagem, não arrasto.
        if (Math.hypot(t.clientX - pendente.x, t.clientY - pendente.y) > TOLERANCIA_PX) {
          window.clearTimeout(pendente.timer);
          pendente = null;
        } else {
          pendente.y = t.clientY;
        }
        return;
      }
      if (ativo) {
        if (e.cancelable) e.preventDefault(); // depois de levantar, a página não rola
        atualizar(t.clientY);
      }
    };

    const aoSoltar = (e: TouchEvent) => {
      if (pendente) {
        window.clearTimeout(pendente.timer);
        pendente = null;
      }
      if (!ativo) return;
      if (e.cancelable) e.preventDefault(); // não abre a edição do hábito sem querer
      const { de, para } = ativo;
      const cancelado = e.type === 'touchcancel';
      const lista = idsRef.current;
      parar();
      if (!cancelado && para !== de) avisar.current(moverItem(lista, de, para));
    };

    el.addEventListener('touchstart', aoTocar, { passive: true });
    el.addEventListener('touchmove', aoMover, { passive: false });
    el.addEventListener('touchend', aoSoltar, { passive: false });
    el.addEventListener('touchcancel', aoSoltar, { passive: false });
    return () => {
      if (pendente) window.clearTimeout(pendente.timer);
      if (ativo) window.cancelAnimationFrame(ativo.quadro);
      el.removeEventListener('touchstart', aoTocar);
      el.removeEventListener('touchmove', aoMover);
      el.removeEventListener('touchend', aoSoltar);
      el.removeEventListener('touchcancel', aoSoltar);
    };
  }, []);

  return (
    <div ref={raiz} className="sem-selecao" onContextMenu={(e) => e.preventDefault()}>
      {Children.toArray(children).map((filho, i) => {
        const id = ids[i];
        const levantada = arrasto?.id === id;
        let estilo: React.CSSProperties = {};
        if (arrasto) {
          estilo = levantada
            ? {
                transform: `translateY(${arrasto.dy}px) scale(1.02)`,
                zIndex: 20,
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                background: 'var(--color-cartao)',
                borderRadius: 16,
                position: 'relative',
              }
            : {
                transform: `translateY(${deslocamentoDaLinha(i, arrasto.de, arrasto.para, arrasto.altura)}px)`,
                transition: 'transform 150ms ease',
              };
        }
        return (
          <div
            key={id}
            data-ordem-id={id}
            style={estilo}
            className={i > 0 ? 'border-t border-linha' : ''}
          >
            {filho}
          </div>
        );
      })}
    </div>
  );
}
