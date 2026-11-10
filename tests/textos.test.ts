import { describe, expect, it } from 'vitest';
import type { ResumoDia } from '../src/services/calculos';
import {
  dataCabecalho,
  dataCurta,
  diaSemanaCurto,
  diaSemanaLongo,
  etiquetaStatus,
  formatarNumero,
  listaComE,
  rotuloBloco,
  textoConcluidas,
  textoConclusao,
  textoLimite,
  textoQuantidade,
  textoRegistros,
  textoSemanal,
} from '../src/services/textos';

const resumo = (p: Partial<ResumoDia>): ResumoDia => ({
  data: '2026-11-10', estado: 'parcial', percentual: 30, fechado: false, habitos: [],
  concluidas: 1, totalNoPercentual: 5, metasSuperadas: 0, foraDoPercentual: [], ...p,
});

describe('textos da tela Hoje', () => {
  it('cabeçalho: dia da semana e data (T-01)', () => {
    expect(diaSemanaLongo('2026-11-10')).toBe('TERÇA-FEIRA');
    expect(diaSemanaLongo('2026-11-08')).toBe('DOMINGO');
    expect(diaSemanaCurto('2026-11-07')).toBe('Sáb');
    expect(dataCabecalho('2026-11-10')).toBe('10 NOV');
    expect(dataCabecalho('2026-01-05')).toBe('5 JAN');
    expect(dataCurta('2026-11-09')).toBe('09/11');
  });

  it('números em pt-BR', () => {
    expect(formatarNumero(2000)).toBe('2.000');
    expect(formatarNumero(2.5)).toBe('2,5');
    expect(formatarNumero(0.30000000000000004)).toBe('0,3');
    expect(formatarNumero(10)).toBe('10');
  });

  it('rótulo do bloco: com unidade se há um bloco, sem se há vários (T-09)', () => {
    expect(rotuloBloco(10, 'min', 1)).toBe('+10 min');
    expect(rotuloBloco(10, 'páginas', 1)).toBe('+10 pág');
    expect(rotuloBloco(250, 'ml', 2)).toBe('+250');
    expect(rotuloBloco(500, 'ml', 2)).toBe('+500');
    expect(rotuloBloco(300, 'kcal', 1)).toBe('+300 kcal');
    expect(rotuloBloco(7, '', 1)).toBe('+7');
  });

  it('quantidade: abaixo, na meta e acima (T-08, T-11, T-12)', () => {
    expect(textoQuantidade(10, 30, 'min')).toBe('10 / 30 min');
    expect(textoQuantidade(30, 30, 'min')).toBe('Meta batida · 30 min');
    expect(textoQuantidade(40, 30, 'min')).toBe('40 min · +10 além da meta');
    expect(textoQuantidade(750, 2000, 'ml')).toBe('750 / 2.000 ml');
    expect(textoQuantidade(2250, 2000, 'ml')).toBe('2.250 ml · +250 além da meta');
  });

  it('limite: dentro e acima (T-14)', () => {
    expect(textoLimite(620, 1500, 'kcal')).toBe('620 de 1.500 kcal · dentro do limite');
    expect(textoLimite(1500, 1500, 'kcal')).toBe('1.500 de 1.500 kcal · dentro do limite');
    expect(textoLimite(1800, 1500, 'kcal')).toBe('1.800 de 1.500 kcal · acima do limite');
  });

  it('semanal (T-07)', () => {
    expect(textoSemanal(4, 5, false, true)).toBe('4 de 5 na semana');
    expect(textoSemanal(4, 5, true, true)).toBe('4 de 5 na semana · hoje feito');
    expect(textoSemanal(4, 5, true, false)).toBe('4 de 5 na semana · feito neste dia');
    expect(textoSemanal(5, 5, true, true)).toBe('Meta da semana batida · 5 de 5');
    expect(textoSemanal(6, 5, true, true)).toBe('Meta da semana batida · 5 de 5');
  });

  it('conclusão (T-06b)', () => {
    expect(textoConclusao(true, true)).toBe('Concluído hoje');
    expect(textoConclusao(true, false)).toBe('Concluído neste dia');
    expect(textoConclusao(false, true)).toBe('Ainda não registrado');
  });

  it('etiqueta de status (T-01, T-02, T-01b)', () => {
    expect(etiquetaStatus({ estado: 'semdados', percentual: 0 })).toBe('Não iniciado');
    expect(etiquetaStatus({ estado: 'parcial', percentual: 30 })).toBe('Em andamento');
    expect(etiquetaStatus({ estado: 'completo', percentual: 100 })).toBe('Dia completo');
    expect(etiquetaStatus({ estado: 'folga', percentual: null })).toBe('Dia de folga');
    expect(etiquetaStatus({ estado: 'descanso', percentual: null })).toBe('Descanso');
  });

  it('lista com "e"', () => {
    expect(listaComE([])).toBe('');
    expect(listaComE(['treino'])).toBe('treino');
    expect(listaComE(['treino', 'calorias'])).toBe('treino e calorias');
    expect(listaComE(['a', 'b', 'c'])).toBe('a, b e c');
  });

  it('texto abaixo da barra (RF-01)', () => {
    expect(textoConcluidas(resumo({}), ['Treino', 'Calorias'])).toBe('1 de 5 concluídas · treino e calorias à parte');
    expect(textoConcluidas(resumo({ concluidas: 0 }), [])).toBe('0 de 5 concluídas');
    expect(textoConcluidas(resumo({ estado: 'completo', percentual: 100 }), [])).toBe('Dia completo');
    expect(textoConcluidas(resumo({ estado: 'completo', metasSuperadas: 1 }), [])).toBe('Dia completo · 1 meta superada');
    expect(textoConcluidas(resumo({ estado: 'completo', metasSuperadas: 2 }), [])).toBe('Dia completo · 2 metas superadas');
    expect(textoConcluidas(resumo({ estado: 'folga' }), [])).toContain('folga');
  });

  it('plural de registros (T-13)', () => {
    expect(textoRegistros(1)).toBe('1 registro');
    expect(textoRegistros(3)).toBe('3 registros');
  });
});
