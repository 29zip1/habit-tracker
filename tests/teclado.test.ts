import { describe, expect, it } from 'vitest';
import { tecladoEstaAberto } from '../src/hooks/useAreaVisivel';

describe('detecção do teclado do iPhone', () => {
  it('teclado fechado: área visível quase igual à janela', () => {
    expect(tecladoEstaAberto(932, 932)).toBe(false);
    expect(tecladoEstaAberto(932, 900)).toBe(false); // barras do Safari, não é teclado
  });

  it('teclado aberto: área visível bem menor', () => {
    expect(tecladoEstaAberto(932, 620)).toBe(true);
    expect(tecladoEstaAberto(932, 560)).toBe(true);
  });
});
