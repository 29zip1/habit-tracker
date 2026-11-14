import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ajustarCor,
  CLAREIA_ESCURO,
  CLARIDADE_MINIMA,
  claridadeMaxima,
  corDeHsl,
  corLegivel,
  GRADE_CORES,
  hexParaRgb,
  hslDaCor,
  normalizarHex,
  rgbParaHex,
} from '../src/services/cores';
import { PALETA_CORES } from '../src/services/habitos';

describe('T-78a · RF-78: grade de cores', () => {
  it('tem 10 matizes × 4 tons, sem repetir, todas legíveis', () => {
    expect(GRADE_CORES).toHaveLength(10);
    for (const coluna of GRADE_CORES) expect(coluna).toHaveLength(4);
    const todas = GRADE_CORES.flat();
    expect(new Set(todas).size).toBe(todas.length);
    for (const c of todas) expect(corLegivel(c), c).toBe(true);
  });
  it('as 8 cores atuais continuam legíveis pelo mesmo critério', () => {
    for (const c of PALETA_CORES) expect(corLegivel(c), c).toBe(true);
  });
  it('o clareamento do modo escuro usado aqui é o mesmo do CSS', () => {
    const css = readFileSync('src/index.css', 'utf8');
    const v = Number(/data-tema='escuro'\][^}]*--clareia-icone:\s*(\d+)%/s.exec(css)?.[1]) / 100;
    expect(v).toBe(CLAREIA_ESCURO);
  });
});

describe('T-78b · RF-78: código hexadecimal', () => {
  it('aceita com ou sem #, minúsculas e maiúsculas', () => {
    expect(normalizarHex('#0b7a43')).toBe('#0B7A43');
    expect(normalizarHex('0B7A43')).toBe('#0B7A43');
    expect(normalizarHex('  #0B7A43 ')).toBe('#0B7A43');
  });
  it('recusa código incompleto, com letras fora de A–F ou vazio', () => {
    for (const ruim of ['#12', '#GGGGGG', '', '#', '12345', '1234567', '#12 456']) {
      expect(normalizarHex(ruim), ruim).toBeNull();
    }
  });
  it('converte cor para números e de volta', () => {
    expect(hexParaRgb('#0B7A43')).toEqual([11, 122, 67]);
    expect(rgbParaHex([11, 122, 67])).toBe('#0B7A43');
  });
});

describe('T-78c · RF-78: ajuste de cor clara demais', () => {
  it('cores vivas e claras ficam mais escuras e legíveis', () => {
    for (const clara of ['#FFFF00', '#FFFFFF', '#00FFFF', '#FFD966', '#F0F0F0']) {
      const r = ajustarCor(clara);
      expect(r.ajustada, clara).toBe(true);
      expect(corLegivel(r.cor), clara).toBe(true);
      expect(hslDaCor(r.cor).l).toBeLessThan(hslDaCor(clara).l);
      expect(hslDaCor(r.cor).h).toBeCloseTo(hslDaCor(clara).h, -1); // o matiz é mantido (menos no branco)
    }
  });
  it('cor que já é boa não muda', () => {
    for (const boa of PALETA_CORES) expect(ajustarCor(boa)).toEqual({ cor: boa, ajustada: false });
  });
  it('código inválido não é ajustado', () => {
    expect(() => ajustarCor('#12')).toThrow();
  });
});

describe('T-78d · RF-78: barras de matiz, intensidade e claridade', () => {
  it('qualquer posição permitida das barras gera uma cor legível', () => {
    for (let h = 0; h < 360; h += 15) {
      for (const s of [20, 45, 68, 100]) {
        const max = claridadeMaxima(h, s);
        expect(max).toBeGreaterThanOrEqual(CLARIDADE_MINIMA);
        for (const l of [CLARIDADE_MINIMA, Math.round((CLARIDADE_MINIMA + max) / 2), max]) {
          expect(corLegivel(corDeHsl({ h, s, l })), `h${h} s${s} l${l}`).toBe(true);
        }
      }
    }
  });
});
