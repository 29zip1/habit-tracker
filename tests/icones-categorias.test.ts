import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GRUPOS_ICONES, ICONES_HABITO } from '../src/components/icones';
import { CATEGORIAS_PRONTAS, listarCategorias, PALETA_CORES } from '../src/services/habitos';

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function luz([r, g, b]: number[]) {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contraste = (a: number[], b: number[]) => {
  const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** Cor sobre o fundo do bloco do ícone: 20% da cor misturada ao cartão (como na tela Hoje). */
const bloco = (cor: string, cartao: string) => rgb(cor).map((v, i) => Math.round(v * 0.2 + rgb(cartao)[i] * 0.8));

describe('T-30k · ícones (RF-30e)', () => {
  const nomes = GRUPOS_ICONES.flatMap((g) => Object.keys(g.icones));

  it('cada nome aparece uma vez só e todos têm o desenho', () => {
    expect(new Set(nomes).size).toBe(nomes.length);
    for (const g of GRUPOS_ICONES) for (const ic of Object.values(g.icones)) expect(ic).toBeTruthy();
  });

  it('os 20 ícones antigos continuam com os mesmos nomes', () => {
    const antigos = ['book-open', 'book', 'dumbbell', 'heart-pulse', 'languages', 'droplet', 'utensils', 'brain', 'footprints', 'moon', 'sun', 'coffee', 'pencil', 'music', 'bike', 'apple', 'leaf', 'star', 'target', 'check'];
    for (const n of antigos) expect(ICONES_HABITO[n], n).toBeTruthy();
  });

  it('tem bem mais ícones e o de videogame', () => {
    expect(nomes.length).toBeGreaterThanOrEqual(80);
    expect(ICONES_HABITO.gamepad).toBeTruthy();
    expect(GRUPOS_ICONES.map((g) => g.nome)).toContain('Jogos e lazer');
  });
});

describe('T-30h · categorias (RF-30d)', () => {
  it('as prontas vêm primeiro, com Geral', () => {
    expect(listarCategorias([]).slice(0, CATEGORIAS_PRONTAS.length)).toEqual(CATEGORIAS_PRONTAS);
    expect(CATEGORIAS_PRONTAS).toContain('Geral');
  });

  it('as já usadas entram sem repetir (ignora maiúsculas e espaços)', () => {
    const l = listarCategorias(['saúde', ' Leitura ', 'leitura', 'GERAL', 'Pets']);
    expect(l.filter((c) => c.toLowerCase() === 'saúde')).toHaveLength(1);
    expect(l.filter((c) => c.toLowerCase() === 'leitura')).toHaveLength(1);
    expect(l).toContain('Pets');
    expect(l.filter((c) => c.toLowerCase() === 'geral')).toHaveLength(1);
  });

  it('a categoria atual aparece mesmo sendo nova; vazia e longa são tratadas', () => {
    expect(listarCategorias([], 'Culinária')).toContain('Culinária');
    expect(listarCategorias(['', '   '])).toHaveLength(CATEGORIAS_PRONTAS.length);
    expect(listarCategorias(['x'.repeat(50)]).some((c) => c.length > 30)).toBe(false);
  });
});

const css = readFileSync('src/index.css', 'utf8');

describe('T-COR4 · cores da paleta (RF-30f)', () => {
  it('desenho branco sobre a cor cheia: contraste de pelo menos 3:1', () => {
    for (const c of PALETA_CORES) expect(contraste(rgb(c), [255, 255, 255]), c).toBeGreaterThanOrEqual(3);
  });

  it('desenho na cor sobre o bloco suave, nos temas claro e escuro: pelo menos 3:1', () => {
    for (const c of PALETA_CORES) {
      expect(contraste(rgb(c), bloco(c, '#ffffff')), `${c} claro`).toBeGreaterThanOrEqual(3);
      const clareia = Number(/data-tema='escuro'\][^}]*--clareia-icone:\s*(\d+)%/s.exec(css)?.[1]) / 100;
      const desenho = rgb(c).map((v) => Math.round(v * (1 - clareia) + 255 * clareia));
      expect(contraste(desenho, bloco(c, '#1a201c')), `${c} escuro`).toBeGreaterThanOrEqual(3);
    }
  });
});
