// RF-78: cores do hábito (hexadecimal, grade pronta, ajuste de legibilidade). Sem bibliotecas.
//
// Toda cor do hábito precisa manter o desenho legível (RF-30f), nos mesmos testes que a paleta já usa:
//  1. desenho BRANCO sobre a cor cheia (hábito feito): contraste mínimo 3:1;
//  2. desenho na cor sobre o bloco suave, no tema claro: 3:1;
//  3. desenho clareado (55%, como no modo escuro) sobre o bloco suave escuro: 3:1.

export type RGB = [number, number, number];
export interface HSL {
  h: number; // 0 a 360
  s: number; // 0 a 100
  l: number; // 0 a 100
}

/** Mesmo valor de --clareia-icone no tema escuro (src/index.css). */
export const CLAREIA_ESCURO = 0.55;
const CARTAO_CLARO: RGB = [255, 255, 255];
const CARTAO_ESCURO: RGB = [0x1a, 0x20, 0x1c];
const CONTRASTE_MINIMO = 3;

/** Aceita "#0b7a43", "0B7A43" etc. Devolve "#0B7A43" ou null se não for um código de 6 dígitos. */
export function normalizarHex(texto: string): string | null {
  const t = texto.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(t) ? `#${t.toUpperCase()}` : null;
}

export function hexParaRgb(hex: string): RGB {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
}

export function rgbParaHex([r, g, b]: RGB): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function hslParaRgb({ h, s, l }: HSL): RGB {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255].map(Math.round) as RGB;
}

export function rgbParaHsl([r, g, b]: RGB): HSL {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (d !== 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const hslParaHex = (c: HSL) => rgbParaHex(hslParaRgb(c));

function luz([r, g, b]: RGB): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contraste(a: RGB, b: RGB): number {
  const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const bloco = (cor: RGB, cartao: RGB): RGB => cor.map((v, i) => Math.round(v * 0.2 + cartao[i] * 0.8)) as RGB;

/** A cor mantém o desenho legível nos três casos acima? */
export function corLegivel(hex: string): boolean {
  const cor = hexParaRgb(hex);
  const desenhoEscuro = cor.map((v) => Math.round(v * (1 - CLAREIA_ESCURO) + 255 * CLAREIA_ESCURO)) as RGB;
  return (
    contraste(cor, [255, 255, 255]) >= CONTRASTE_MINIMO &&
    contraste(cor, bloco(cor, CARTAO_CLARO)) >= CONTRASTE_MINIMO &&
    contraste(desenhoEscuro, bloco(cor, CARTAO_ESCURO)) >= CONTRASTE_MINIMO
  );
}

/** Claridade mínima das barras (abaixo disso tudo vira quase preto). */
export const CLARIDADE_MINIMA = 12;

/**
 * Maior claridade (0 a 100) em que a cor, com este matiz e esta intensidade, ainda é legível.
 * Procura de baixo para cima e para no primeiro erro, então tudo abaixo do resultado é legível.
 */
export function claridadeMaxima(h: number, s: number): number {
  let ultima = CLARIDADE_MINIMA;
  for (let l = CLARIDADE_MINIMA; l <= 90; l++) {
    if (!corLegivel(hslParaHex({ h, s, l }))) break;
    ultima = l;
  }
  return ultima;
}

/** Se a cor for clara demais, escurece até ficar legível. `ajustada` diz se foi preciso mudar. */
export function ajustarCor(hex: string): { cor: string; ajustada: boolean } {
  const normal = normalizarHex(hex);
  if (!normal) throw new Error('Código de cor inválido');
  if (corLegivel(normal)) return { cor: normal, ajustada: false };
  const { h, s, l } = rgbParaHsl(hexParaRgb(normal));
  for (let novo = l - 1; novo >= 0; novo--) {
    const cor = hslParaHex({ h, s, l: novo });
    if (corLegivel(cor)) return { cor, ajustada: true };
  }
  return { cor: '#000000', ajustada: true };
}

/** Matiz, claridade e intensidade a partir de uma cor (para posicionar as barras). */
export const hslDaCor = (hex: string): HSL => rgbParaHsl(hexParaRgb(hex));
export const corDeHsl = hslParaHex;

const MATIZES = [0, 22, 45, 95, 145, 175, 205, 230, 270, 320];
const PROPORCOES = [1, 0.84, 0.68, 0.52];

/** Grade pronta: 10 matizes × 4 tons (do mais vivo ao mais escuro). Todas legíveis. */
export const GRADE_CORES: string[][] = MATIZES.map((h) => {
  const s = 68;
  const max = claridadeMaxima(h, s);
  return PROPORCOES.map((p) => corDeHsl({ h, s, l: Math.max(CLARIDADE_MINIMA, Math.round(max * p)) }));
});
