import { describe, expect, it } from 'vitest';
import { lerNumero } from '../src/components/JanelaValor';

describe('leitura do valor digitado (T-10d, T-10f)', () => {
  it('aceita inteiros, vírgula e ponto decimal', () => {
    expect(lerNumero('5')).toBe(5);
    expect(lerNumero('2,5')).toBe(2.5);
    expect(lerNumero('2.5')).toBe(2.5);
    expect(lerNumero(' 30 ')).toBe(30);
  });

  it('vazio e texto inválido viram NaN (botão Registrar fica desabilitado)', () => {
    expect(Number.isNaN(lerNumero(''))).toBe(true);
    expect(Number.isNaN(lerNumero('abc'))).toBe(true);
    expect(Number.isNaN(lerNumero('1,2,3'))).toBe(true);
    expect(Number.isNaN(lerNumero('-5'))).toBe(true);
  });

  it('zero é número, mas o app só aceita maior que zero', () => {
    expect(lerNumero('0')).toBe(0);
    expect(lerNumero('0') > 0).toBe(false);
  });
});
