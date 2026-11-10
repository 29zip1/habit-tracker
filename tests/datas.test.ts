import { describe, expect, it } from 'vitest';
import {
  dataLogica,
  diaDaSemana,
  diasDaSemana,
  ehDataValida,
  formatarData,
  formatarHorario,
  inicioDaSemana,
  intervaloDeDatas,
  somarDias,
} from '../src/services/datas';

describe('datas locais', () => {
  it('valida datas AAAA-MM-DD', () => {
    expect(ehDataValida('2026-11-10')).toBe(true);
    expect(ehDataValida('2026-02-29')).toBe(false); // 2026 não é bissexto
    expect(ehDataValida('2028-02-29')).toBe(true);
    expect(ehDataValida('2026-13-01')).toBe(false);
    expect(ehDataValida('10/11/2026')).toBe(false);
    expect(ehDataValida('2026-1-1')).toBe(false);
  });

  it('formata data e horário com zeros à esquerda', () => {
    expect(formatarData(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05');
    expect(formatarHorario(new Date(2026, 0, 5, 9, 7))).toBe('09:07');
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('descobre o dia da semana (10/11/2026 é terça)', () => {
    expect(diaDaSemana('2026-11-10')).toBe(2);
    expect(diaDaSemana('2026-11-08')).toBe(0);
  });

  it('semana começa na segunda por padrão e é configurável', () => {
    expect(inicioDaSemana('2026-11-10')).toBe('2026-11-09'); // terça -> segunda
    expect(inicioDaSemana('2026-11-09')).toBe('2026-11-09');
    expect(inicioDaSemana('2026-11-08')).toBe('2026-11-02'); // domingo pertence à semana anterior
    expect(inicioDaSemana('2026-11-10', 0)).toBe('2026-11-08'); // semana começando no domingo
    expect(diasDaSemana('2026-11-10')).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
    ]);
  });

  it('gera intervalo de datas inclusive', () => {
    expect(intervaloDeDatas('2026-11-08', '2026-11-10')).toEqual(['2026-11-08', '2026-11-09', '2026-11-10']);
    expect(intervaloDeDatas('2026-11-10', '2026-11-10')).toEqual(['2026-11-10']);
    expect(intervaloDeDatas('2026-11-11', '2026-11-10')).toEqual([]);
  });

  // T-C8
  it('T-C8: 23:50 e 00:10 caem cada um no dia certo (virada à meia-noite)', () => {
    expect(dataLogica(new Date(2026, 10, 10, 23, 50))).toBe('2026-11-10');
    expect(dataLogica(new Date(2026, 10, 11, 0, 10))).toBe('2026-11-11');
  });

  // T-C8b
  it('T-C8b: com início do dia às 05:00, 02:00 ainda é o dia anterior', () => {
    expect(dataLogica(new Date(2026, 10, 11, 2, 0), 5)).toBe('2026-11-10');
    expect(dataLogica(new Date(2026, 10, 11, 4, 59), 5)).toBe('2026-11-10');
    expect(dataLogica(new Date(2026, 10, 11, 5, 0), 5)).toBe('2026-11-11');
    expect(dataLogica(new Date(2026, 10, 1, 1, 0), 5)).toBe('2026-10-31'); // atravessa o mês
  });
});
