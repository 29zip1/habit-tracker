// Mesmas regras de data em um fuso COM horário de verão, para provar que a
// virada do dia não depende do fuso nem de mudanças de horário.
// O fuso é definido antes de qualquer data ser criada.
process.env.TZ = 'America/New_York';

import { describe, expect, it } from 'vitest';
import { dataLogica, inicioDaSemana, intervaloDeDatas, somarDias } from '../src/services/datas';

describe('datas com horário de verão (fuso de Nova York)', () => {
  it('o fuso de teste está mesmo ativo (verão = UTC-4, inverno = UTC-5)', () => {
    expect(new Date(2026, 6, 1, 12).getTimezoneOffset()).toBe(240);
    expect(new Date(2026, 0, 1, 12).getTimezoneOffset()).toBe(300);
  });

  it('somar dias atravessa o início do horário de verão (08/03/2026)', () => {
    expect(somarDias('2026-03-07', 1)).toBe('2026-03-08');
    expect(somarDias('2026-03-08', 1)).toBe('2026-03-09');
    expect(intervaloDeDatas('2026-03-07', '2026-03-10')).toEqual([
      '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10',
    ]);
  });

  it('somar dias atravessa o fim do horário de verão (01/11/2026)', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(somarDias('2026-11-01', 1)).toBe('2026-11-02');
    expect(somarDias('2026-11-02', -2)).toBe('2026-10-31');
  });

  it('semana continua com 7 dias distintos na semana da mudança', () => {
    expect(inicioDaSemana('2026-03-08', 0)).toBe('2026-03-08');
    expect(inicioDaSemana('2026-03-09')).toBe('2026-03-09');
  });

  it('dia lógico correto perto da meia-noite', () => {
    expect(dataLogica(new Date(2026, 2, 8, 23, 50))).toBe('2026-03-08');
    expect(dataLogica(new Date(2026, 2, 9, 0, 10))).toBe('2026-03-09');
    expect(dataLogica(new Date(2026, 2, 9, 2, 30), 5)).toBe('2026-03-08');
  });
});
