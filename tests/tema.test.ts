import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolverTema } from '../src/services/tema';

describe('escolha do tema', () => {
  it('Sistema segue o iPhone; Claro e Escuro são fixos', () => {
    expect(resolverTema('sistema', true)).toBe('escuro');
    expect(resolverTema('sistema', false)).toBe('claro');
    expect(resolverTema('claro', true)).toBe('claro');
    expect(resolverTema('escuro', false)).toBe('escuro');
  });
});

// RF-24: contraste mínimo de 4,5:1 para texto (3:1 para elementos de interface),
// conferido direto nas cores definidas no CSS, nos dois temas.
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf-8');

function lerBloco(inicio: string): Record<string, string> {
  const i = css.indexOf(inicio);
  const fim = css.indexOf('}', i);
  const cores: Record<string, string> = {};
  for (const m of css.slice(i, fim).matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    cores[m[1]] = m[2].toLowerCase();
  }
  return cores;
}

const claro = lerBloco('@theme');
const escuro = { ...claro, ...lerBloco(":root[data-tema='escuro']") };

const luz = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a: string, b: string) => {
  const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const TEXTO: [string, string][] = [
  ['texto', 'fundo'],
  ['texto', 'cartao'],
  ['texto2', 'fundo'],
  ['texto2', 'cartao'],
  ['texto2', 'verde-linha'],
  ['verde-texto', 'cartao'],
  ['verde-texto', 'fundo'],
  ['verde-escuro', 'verde-linha'],
  ['laranja', 'cartao'],
  ['laranja-texto', 'laranja-claro'],
  ['chip-texto', 'chip'],
  ['aviso-texto', 'aviso'],
  ['vermelho', 'cartao'],
  ['aviso-texto', 'vermelho'],
];

describe.each([
  ['claro', claro],
  ['escuro', escuro],
] as const)('contraste no tema %s', (_nome, cores) => {
  it.each(TEXTO)('%s sobre %s ≥ 4,5:1', (frente, fundo) => {
    expect(contraste(cores[frente], cores[fundo])).toBeGreaterThanOrEqual(4.5);
  });

  it('branco sobre o verde de preenchimento ≥ 4,5:1', () => {
    expect(contraste('#ffffff', cores['verde'])).toBeGreaterThanOrEqual(4.5);
  });

  it('anel cinza sobre o cartão ≥ 3:1 (elemento de interface)', () => {
    expect(contraste(cores['cinza-anel'], cores['cartao'])).toBeGreaterThanOrEqual(3);
  });
});
