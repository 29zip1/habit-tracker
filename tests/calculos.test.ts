import { describe, expect, it } from 'vitest';
import {
  calcularDia,
  estaProgramado,
  limiteAtingido,
  metaBatida,
  metaSuperada,
  percentualDasFracoes,
  resumoDoPeriodo,
  statusDoLimite,
  versaoVigente,
  type DiaComEstado,
  type EntradaDia,
} from '../src/services/calculos';
import { dia, habito, marca, reg } from './ajudas';

const HOJE = '2026-11-10'; // terça-feira
const ONTEM = '2026-11-09';

function entrada(parcial: Partial<EntradaDia> & Pick<EntradaDia, 'habitos'>): EntradaDia {
  return { data: HOJE, hoje: HOJE, registros: [], marcacoes: [], ...parcial };
}

describe('RF-C1 · fração de um hábito', () => {
  it('T-C1: cardio 15 de 30 = 50%', () => {
    const cardio = habito({ tipo: 'quantidade', meta: 30, blocos: [10] });
    const r = calcularDia(entrada({ habitos: [cardio], registros: [reg(cardio, 15, HOJE)] }));
    expect(r.habitos[0].fracao).toBe(0.5);
    expect(r.percentual).toBe(50);
  });

  it('conclusão vale 0 ou 1', () => {
    const med = habito({ tipo: 'conclusao' });
    expect(calcularDia(entrada({ habitos: [med] })).habitos[0].fracao).toBe(0);
    expect(calcularDia(entrada({ habitos: [med], marcacoes: [marca(med, HOJE)] })).habitos[0].fracao).toBe(1);
  });

  it('quantidade nunca passa de 1 (teto)', () => {
    const cardio = habito({ tipo: 'quantidade', meta: 30 });
    const r = calcularDia(entrada({ habitos: [cardio], registros: [reg(cardio, 90, HOJE)] }));
    expect(r.habitos[0].fracao).toBe(1);
  });

  it('soma vários registros do dia e ignora registros de outros dias', () => {
    const agua = habito({ tipo: 'quantidade', meta: 2000, blocos: [250, 500] });
    const r = calcularDia(
      entrada({
        habitos: [agua],
        registros: [reg(agua, 250, HOJE), reg(agua, 500, HOJE), reg(agua, 1500, ONTEM)],
      }),
    );
    expect(r.habitos[0].total).toBe(750);
  });

  it('aceita decimais sem erro de ponto flutuante (0,1 + 0,2 = 0,3)', () => {
    const km = habito({ tipo: 'quantidade', meta: 0.3, unidade: 'km' });
    const r = calcularDia(entrada({ habitos: [km], registros: [reg(km, 0.1, HOJE), reg(km, 0.2, HOJE)] }));
    expect(r.habitos[0].total).toBe(0.3);
    expect(r.habitos[0].metaBatida).toBe(true);
    expect(r.habitos[0].metaSuperada).toBe(false);
  });
});

describe('RF-C2 · percentual do dia', () => {
  it('T-C2: 5 hábitos, 1 completo, 1 com 50%, 3 zerados = 30%', () => {
    const a = habito({ tipo: 'conclusao' });
    const b = habito({ tipo: 'quantidade', meta: 20 });
    const c = habito({ tipo: 'quantidade', meta: 20 });
    const d = habito({ tipo: 'quantidade', meta: 20 });
    const e = habito({ tipo: 'quantidade', meta: 20 });
    const r = calcularDia(
      entrada({
        habitos: [a, b, c, d, e],
        marcacoes: [marca(a, HOJE)],
        registros: [reg(b, 10, HOJE)],
      }),
    );
    expect(r.percentual).toBe(30);
    expect(r.totalNoPercentual).toBe(5);
    expect(r.concluidas).toBe(1);
    expect(r.estado).toBe('parcial');
  });

  it('T-C2b: tudo completo e ainda extras = 100% (nunca passa)', () => {
    const med = habito({ tipo: 'conclusao' });
    const cardio = habito({ tipo: 'quantidade', meta: 30 });
    const r = calcularDia(
      entrada({ habitos: [med, cardio], marcacoes: [marca(med, HOJE)], registros: [reg(cardio, 75, HOJE)] }),
    );
    expect(r.percentual).toBe(100);
    expect(r.estado).toBe('completo');
  });

  it('arredonda para inteiro sem erro (28,5% não vira 28 por ponto flutuante)', () => {
    expect(percentualDasFracoes([0.285])).toBe(29); // 28,5 arredonda para 29
    expect(percentualDasFracoes([1 / 3])).toBe(33);
    expect(percentualDasFracoes([2 / 3])).toBe(67);
    expect(percentualDasFracoes([])).toBeNull();
  });

  it('limite e semanal ficam fora do percentual por padrão', () => {
    const med = habito({ tipo: 'conclusao' });
    const treino = habito({ tipo: 'semanal', meta: 5 });
    const kcal = habito({ tipo: 'limite', meta: 1500, blocos: [300] });
    const r = calcularDia(entrada({ habitos: [med, treino, kcal], marcacoes: [marca(med, HOJE)] }));
    expect(r.totalNoPercentual).toBe(1);
    expect(r.percentual).toBe(100);
    expect(r.foraDoPercentual).toEqual([treino.habito.id, kcal.habito.id]);
  });
});

describe('RF-C3 · meta batida e superada', () => {
  it('T-C3: cardio 45 de 30 = meta superada, +15 além da meta', () => {
    const cardio = habito({ tipo: 'quantidade', meta: 30 });
    const r = calcularDia(entrada({ habitos: [cardio], registros: [reg(cardio, 45, HOJE)] }));
    expect(r.habitos[0].metaBatida).toBe(true);
    expect(r.habitos[0].metaSuperada).toBe(true);
    expect(r.habitos[0].alemDaMeta).toBe(15);
    expect(r.metasSuperadas).toBe(1);
    expect(r.percentual).toBe(100);
  });

  it('exatamente na meta: batida, mas não superada', () => {
    expect(metaBatida(30, 30)).toBe(true);
    expect(metaSuperada(30, 30)).toBe(false);
    expect(metaBatida(29.9, 30)).toBe(false);
  });
});

describe('RF-C4 e RF-C9 · limite', () => {
  const kcal = () => habito({ tipo: 'limite', meta: 1500, blocos: [300] });

  it('T-C4: calorias 0 kcal no início do dia não contam no percentual', () => {
    const k = kcal();
    const med = habito({ tipo: 'conclusao' });
    const r = calcularDia(entrada({ habitos: [med, k] }));
    expect(r.totalNoPercentual).toBe(1);
    expect(r.percentual).toBe(0);
  });

  it('dentro ou acima do limite (igual ao limite ainda é dentro)', () => {
    expect(statusDoLimite(1500, 1500)).toBe('dentro');
    expect(statusDoLimite(1501, 1500)).toBe('acima');
  });

  it('T-C9a: limite ligado no percentual, dia aberto: fica fora da conta', () => {
    const k = habito({ tipo: 'limite', meta: 1500, blocos: [300], entra: true });
    const med = habito({ tipo: 'conclusao' });
    const r = calcularDia(
      entrada({ habitos: [med, k], marcacoes: [marca(med, HOJE)], registros: [reg(k, 1200, HOJE)] }),
    );
    expect(r.habitos[1].fracao).toBeNull();
    expect(r.totalNoPercentual).toBe(1);
    expect(r.percentual).toBe(100);
  });

  it('T-C9b: mesmo caso, dia fechado e 1.200 de 1.500: vale 1', () => {
    const k = habito({ tipo: 'limite', meta: 1500, blocos: [300], entra: true });
    const r = calcularDia(
      entrada({ habitos: [k], registros: [reg(k, 1200, HOJE)], dia: dia(HOJE, { fechado: true }) }),
    );
    expect(r.fechado).toBe(true);
    expect(r.habitos[0].fracao).toBe(1);
    expect(r.estado).toBe('completo');
  });

  it('T-C9c: dia fechado e 1.800 de 1.500: vale 0', () => {
    const k = habito({ tipo: 'limite', meta: 1500, blocos: [300], entra: true });
    const r = calcularDia(
      entrada({ habitos: [k], registros: [reg(k, 1800, HOJE)], dia: dia(HOJE, { fechado: true }) }),
    );
    expect(r.habitos[0].fracao).toBe(0);
    expect(r.habitos[0].statusLimite).toBe('acima');
    expect(r.percentual).toBe(0);
  });

  it('T-20b: dia anterior é tratado como fechado sem ter sido finalizado', () => {
    const k = habito({ tipo: 'limite', meta: 1500, blocos: [300], entra: true });
    const r = calcularDia(entrada({ data: ONTEM, habitos: [k], registros: [reg(k, 1800, ONTEM)] }));
    expect(r.fechado).toBe(true);
    expect(r.habitos[0].fracao).toBe(0);
  });
});

describe('RF-14b · check do hábito de limite', () => {
  const kcal = () => habito({ tipo: 'limite', meta: 1500, blocos: [300] });
  const com = (total: number) => {
    const k = kcal();
    return calcularDia(entrada({ habitos: [k], registros: [reg(k, total, HOJE)] })).habitos[0];
  };

  it('T-14c: exatamente 1.500 = check (limite atingido), ainda "dentro do limite"', () => {
    const r = com(1500);
    expect(r.limiteAtingido).toBe(true);
    expect(r.statusLimite).toBe('dentro');
  });

  it('T-14d: abaixo do valor não tem check', () => {
    expect(com(1200).limiteAtingido).toBe(false);
    expect(com(0).limiteAtingido).toBe(false);
  });

  it('T-14e: passou de 1.500 o check some e fica "acima do limite"', () => {
    const r = com(1800);
    expect(r.limiteAtingido).toBe(false);
    expect(r.statusLimite).toBe('acima');
  });

  it('T-14g: comparação sem erro de ponto flutuante', () => {
    expect(limiteAtingido(1500, 1500)).toBe(true);
    expect(limiteAtingido(1499.9, 1500)).toBe(false);
    expect(limiteAtingido(1500.1, 1500)).toBe(false);
    expect(limiteAtingido(0.1 + 0.2, 0.3)).toBe(true);
  });

  it('T-14h: o check não muda o percentual do dia', () => {
    const k = kcal();
    const med = habito({ tipo: 'conclusao' });
    const base = entrada({ habitos: [med, k], marcacoes: [marca(med, HOJE)] });
    const sem = calcularDia(base);
    const com1500 = calcularDia({ ...base, registros: [reg(k, 1500, HOJE)] });
    expect(com1500.percentual).toBe(sem.percentual);
  });
});

describe('RF-C5 e RF-C9 · semanal', () => {
  it('T-C5: treino 5 de 5 na semana = meta da semana batida', () => {
    const treino = habito({ tipo: 'semanal', meta: 5 });
    const marcas = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map((d) => marca(treino, d));
    const r = calcularDia(entrada({ data: '2026-11-13', hoje: '2026-11-13', habitos: [treino], marcacoes: marcas }));
    expect(r.habitos[0].contagemSemana).toBe(5);
    expect(r.habitos[0].metaSemanaBatida).toBe(true);
  });

  it('4 de 5 ainda não bate; a semana começa na segunda (domingo anterior não conta)', () => {
    const treino = habito({ tipo: 'semanal', meta: 5 });
    const marcas = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'].map((d) => marca(treino, d));
    const r = calcularDia(entrada({ habitos: [treino], marcacoes: marcas }));
    expect(r.habitos[0].contagemSemana).toBe(4); // 08/11 é domingo da semana anterior
    expect(r.habitos[0].metaSemanaBatida).toBe(false);
  });

  it('semana configurada para começar no domingo', () => {
    const treino = habito({ tipo: 'semanal', meta: 5 });
    const r = calcularDia(
      entrada({ habitos: [treino], marcacoes: [marca(treino, '2026-11-08')], inicioSemana: 0 }),
    );
    expect(r.habitos[0].contagemSemana).toBe(1);
  });

  it('T-C9d: semanal ligado no percentual vale 1 se marcado hoje e 0 se não', () => {
    const treino = habito({ tipo: 'semanal', meta: 5, entra: true });
    expect(calcularDia(entrada({ habitos: [treino], marcacoes: [marca(treino, HOJE)] })).percentual).toBe(100);
    expect(calcularDia(entrada({ habitos: [treino], marcacoes: [marca(treino, ONTEM)] })).percentual).toBe(0);
  });
});

describe('RF-C6 · estado do dia', () => {
  it('T-C6: dia sem nenhum registro = sem dados (não é falha)', () => {
    const cardio = habito({ tipo: 'quantidade', meta: 30 });
    const r = calcularDia(entrada({ data: ONTEM, habitos: [cardio] }));
    expect(r.estado).toBe('semdados');
    expect(r.percentual).toBe(0);
  });

  it('dia futuro não conta em nada', () => {
    const cardio = habito({ tipo: 'quantidade', meta: 30 });
    const r = calcularDia(entrada({ data: '2026-11-11', habitos: [cardio] }));
    expect(r.estado).toBe('futuro');
    expect(r.percentual).toBeNull();
  });

  it('parcial: há registro mas não está completo', () => {
    const cardio = habito({ tipo: 'quantidade', meta: 30 });
    const r = calcularDia(entrada({ habitos: [cardio], registros: [reg(cardio, 5, HOJE)] }));
    expect(r.estado).toBe('parcial');
  });

  it('hábito não programado no dia (descanso) é ignorado nos cálculos', () => {
    // terça = 2; hábito só às segundas, quartas e sextas
    const musculacao = habito({ tipo: 'conclusao', frequencia: { tipo: 'dias', dias: [1, 3, 5] } });
    const cardio = habito({ tipo: 'quantidade', meta: 30 });
    const r = calcularDia(entrada({ habitos: [musculacao, cardio], registros: [reg(cardio, 30, HOJE)] }));
    expect(r.habitos[0].programado).toBe(false);
    expect(r.totalNoPercentual).toBe(1);
    expect(r.percentual).toBe(100);
    expect(r.estado).toBe('completo');
  });

  it('T-C9e: dia sem nenhum hábito no percentual = descanso, percentual nulo', () => {
    const musculacao = habito({ tipo: 'conclusao', frequencia: { tipo: 'dias', dias: [1, 3, 5] } });
    const r = calcularDia(entrada({ habitos: [musculacao] }));
    expect(r.estado).toBe('descanso');
    expect(r.percentual).toBeNull();
  });

  it('sem nenhum hábito cadastrado também é descanso (não divide por zero)', () => {
    const r = calcularDia(entrada({ habitos: [] }));
    expect(r.estado).toBe('descanso');
    expect(r.percentual).toBeNull();
  });

  it('dia de folga: ignorado no percentual, mas os registros continuam lá', () => {
    const cardio = habito({ tipo: 'quantidade', meta: 30 });
    const r = calcularDia(
      entrada({ habitos: [cardio], registros: [reg(cardio, 10, HOJE)], dia: dia(HOJE, { folga: true }) }),
    );
    expect(r.estado).toBe('folga');
    expect(r.percentual).toBeNull();
    expect(r.habitos[0].total).toBe(10);
  });
});

describe('RF-C7 · sem efeito retroativo (versões do hábito)', () => {
  it('T-C7: meta do cardio 30 -> 40 "a partir de hoje"; dias anteriores mantêm 30', () => {
    const cardio = habito({ tipo: 'quantidade', meta: 30, desde: '2026-01-01' });
    cardio.versoes.push({ ...cardio.versoes[0], id: 'v-nova', vigenteDesde: HOJE, meta: 40 });

    expect(versaoVigente(cardio.versoes, ONTEM)?.meta).toBe(30);
    expect(versaoVigente(cardio.versoes, HOJE)?.meta).toBe(40);

    const ontem = calcularDia(entrada({ data: ONTEM, habitos: [cardio], registros: [reg(cardio, 30, ONTEM)] }));
    const hoje = calcularDia(entrada({ habitos: [cardio], registros: [reg(cardio, 30, HOJE)] }));
    expect(ontem.habitos[0].fracao).toBe(1);
    expect(ontem.percentual).toBe(100);
    expect(hoje.habitos[0].fracao).toBe(0.75);
    expect(hoje.percentual).toBe(75);
  });

  it('antes da primeira versão o hábito não existe', () => {
    const h = habito({ tipo: 'conclusao', desde: '2026-11-05' });
    expect(estaProgramado(h, '2026-11-04')).toBe(false);
    expect(estaProgramado(h, '2026-11-05')).toBe(true);
  });

  it('meta semanal alterada no meio da semana: cada dia usa a meta da sua época', () => {
    const treino = habito({ tipo: 'semanal', meta: 5, desde: '2026-01-01' });
    treino.versoes.push({ ...treino.versoes[0], id: 'v2', vigenteDesde: '2026-11-11', meta: 3 });
    const marcas = [marca(treino, '2026-11-09'), marca(treino, '2026-11-10'), marca(treino, '2026-11-11')];
    const seg = calcularDia(entrada({ data: '2026-11-10', hoje: '2026-11-12', habitos: [treino], marcacoes: marcas }));
    const qua = calcularDia(entrada({ data: '2026-11-11', hoje: '2026-11-12', habitos: [treino], marcacoes: marcas }));
    expect(seg.habitos[0].metaSemanaBatida).toBe(false); // meta 5, 3 feitos
    expect(qua.habitos[0].metaSemanaBatida).toBe(true); // meta 3, 3 feitos
  });
});

describe('arquivar e período do hábito', () => {
  it('arquivado: o passado continua contando, a partir da data some', () => {
    const h = habito({ tipo: 'conclusao', arquivadoEm: '2026-11-10' });
    expect(estaProgramado(h, '2026-11-09')).toBe(true);
    expect(estaProgramado(h, '2026-11-10')).toBe(false);
  });

  it('data inicial e final opcionais', () => {
    const h = habito({ tipo: 'conclusao', dataInicial: '2026-11-05', dataFinal: '2026-11-15' });
    expect(estaProgramado(h, '2026-11-04')).toBe(false);
    expect(estaProgramado(h, '2026-11-10')).toBe(true);
    expect(estaProgramado(h, '2026-11-16')).toBe(false);
  });
});

describe('RF-C10 · período, consistência e sequências', () => {
  const dias = (...estados: DiaComEstado['estado'][]): DiaComEstado[] =>
    estados.map((estado, i) => ({ data: `2026-11-${String(i + 1).padStart(2, '0')}`, estado }));

  it('T-C10a: seis completos, uma folga, mais um completo = sequência 7', () => {
    const lista = dias('completo', 'completo', 'completo', 'completo', 'completo', 'completo', 'folga', 'completo');
    const r = resumoDoPeriodo(lista, '2026-11-01', '2026-11-08');
    expect(r.sequenciaAtual).toBe(7);
    expect(r.melhorSequencia).toBe(7);
  });

  it('descanso também é pulado na sequência', () => {
    const lista = dias('completo', 'descanso', 'completo');
    expect(resumoDoPeriodo(lista, '2026-11-01', '2026-11-03').sequenciaAtual).toBe(2);
  });

  it('T-C10b: completo, parcial, completo = atual 1 e melhor 1', () => {
    const lista = dias('completo', 'parcial', 'completo');
    const r = resumoDoPeriodo(lista, '2026-11-01', '2026-11-03');
    expect(r.sequenciaAtual).toBe(1);
    expect(r.melhorSequencia).toBe(1);
  });

  it('sem dados encerra a sequência', () => {
    const lista = dias('completo', 'completo', 'semdados', 'completo');
    const r = resumoDoPeriodo(lista, '2026-11-01', '2026-11-04');
    expect(r.melhorSequencia).toBe(2);
    expect(r.sequenciaAtual).toBe(1);
  });

  it('T-C10c: 10 dias com 6 completos, 2 de folga e 2 sem dados = "6 em 8"', () => {
    const lista = dias('completo', 'completo', 'folga', 'completo', 'completo', 'semdados', 'completo', 'folga', 'completo', 'semdados');
    const r = resumoDoPeriodo(lista, '2026-11-01', '2026-11-11');
    expect(r.diasCompletos).toBe(6);
    expect(r.diasDoPeriodo).toBe(8);
    expect(r.consistenciaPct).toBe(75);
    expect(r.diasFolga).toBe(2);
    expect(r.diasSemDados).toBe(2);
  });

  it('hoje em andamento não quebra a sequência nem conta contra a consistência', () => {
    const lista: DiaComEstado[] = [
      { data: '2026-11-08', estado: 'completo' },
      { data: '2026-11-09', estado: 'completo' },
      { data: HOJE, estado: 'parcial' },
    ];
    const r = resumoDoPeriodo(lista, '2026-11-08', HOJE);
    expect(r.sequenciaAtual).toBe(2);
    expect(r.diasDoPeriodo).toBe(2);
    expect(r.consistenciaPct).toBe(100);
  });

  it('hoje completo entra na sequência', () => {
    const lista: DiaComEstado[] = [
      { data: ONTEM, estado: 'completo' },
      { data: HOJE, estado: 'completo' },
    ];
    expect(resumoDoPeriodo(lista, ONTEM, HOJE).sequenciaAtual).toBe(2);
  });

  it('dias anteriores ao primeiro registro e dias futuros não entram', () => {
    const lista: DiaComEstado[] = [
      { data: '2026-11-01', estado: 'semdados' },
      { data: '2026-11-05', estado: 'completo' },
      { data: '2026-11-11', estado: 'futuro' },
    ];
    const r = resumoDoPeriodo(lista, '2026-11-05', HOJE);
    expect(r.diasDoPeriodo).toBe(1);
    expect(r.diasCompletos).toBe(1);
  });

  it('sem primeiro registro: período vazio, consistência nula (não é 0%)', () => {
    const r = resumoDoPeriodo(dias('semdados', 'semdados'), undefined, '2026-11-02');
    expect(r.diasDoPeriodo).toBe(0);
    expect(r.consistenciaPct).toBeNull();
  });
});
