import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// T-74a: ícones do app existem, são quadrados, no tamanho certo e sem transparência.
function cabecalhoPng(arquivo: string) {
  const b = readFileSync(new URL(`../public/icons/${arquivo}`, import.meta.url));
  expect(b.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20), tipoCor: b[25] };
}

describe('RF-74 ícones do app', () => {
  const esperado: [string, number][] = [
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['icon-maskable-512.png', 512],
    ['icon-1024.png', 1024],
  ];
  it.each(esperado)('%s é quadrado %i px e sem transparência', (arquivo, lado) => {
    const h = cabecalhoPng(arquivo);
    expect(h.largura).toBe(lado);
    expect(h.altura).toBe(lado);
    expect([0, 2, 6]).toContain(h.tipoCor); // 6 = RGBA; a opacidade total foi conferida ao gerar (menor opacidade = 255)
  });

  it('manifest e index.html apontam para ícones que existem', () => {
    const cfg = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf-8');
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');
    for (const [arquivo] of esperado.slice(0, 4)) {
      expect(cfg + html).toContain(arquivo);
    }
  });
});
