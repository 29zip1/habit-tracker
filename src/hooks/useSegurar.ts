import { useRef, type MouseEvent, type PointerEvent } from 'react';

const TEMPO_SEGURAR_MS = 500; // RF-10: cerca de 0,5 s
const TOLERANCIA_MOVIMENTO_PX = 10; // se o dedo andou mais que isso, é rolagem

/**
 * Botão com dois gestos (RF-10):
 * - toque simples: `aoToque`
 * - segurar ~0,5 s: `aoSegurar` (e o toque simples NÃO dispara junto).
 * Se o dedo se mover (rolagem), cancela. O menu do iPhone é bloqueado.
 */
export function useSegurar(aoToque: () => void, aoSegurar: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const segurou = useRef(false);
  const inicio = useRef<{ x: number; y: number } | null>(null);

  const cancelar = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  };

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      segurou.current = false; // cada toque novo zera o estado anterior
      inicio.current = { x: e.clientX, y: e.clientY };
      cancelar();
      timer.current = window.setTimeout(() => {
        segurou.current = true;
        timer.current = undefined;
        aoSegurar();
      }, TEMPO_SEGURAR_MS);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (!inicio.current || timer.current === undefined) return;
      const dx = e.clientX - inicio.current.x;
      const dy = e.clientY - inicio.current.y;
      if (Math.hypot(dx, dy) > TOLERANCIA_MOVIMENTO_PX) cancelar();
    },
    onPointerUp: cancelar,
    onPointerLeave: cancelar,
    onPointerCancel: cancelar,
    onContextMenu: (e: MouseEvent<HTMLElement>) => e.preventDefault(),
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (segurou.current) {
        segurou.current = false;
        e.preventDefault();
        return;
      }
      aoToque();
    },
  };
}
