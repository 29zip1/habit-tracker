import { describe, expect, it } from 'vitest';
import type { EntradaDia } from '../src/services/calculos';
import { intervaloDeDatas } from '../src/services/datas';
import { resumirPeriodo, resumosDosDias } from '../src/services/historico';
import {
  csvDoRelatorio,
  montarRelatorio,
  nomeArquivoRelatorio,
  periodoDoRelatorio,
  textoDoRelatorio,
} from '../src/services/relatorio';
import { dia, habito, marca, reg } from './ajudas';

const HOJE = '2026-11-10'; // terça-feira

describe('T-51n · períodos do relatório', () => {
  it('esta semana (da segunda até hoje), este mês (do dia 1 até hoje) e mês anterior inteiro', () => {
    expect(periodoDoRelatorio('semana', HOJE, 1)).toEqual({ ok: true, periodo: { inicio: '2026-11-09', fim: HOJE } });
    expect(periodoDoRelatorio('semana', HOJE, 0)).toEqual({ ok: true, periodo: { inicio: '2026-11-08', fim: HOJE } });
    expect(periodoDoRelatorio('mes', HOJE)).toEqual({ ok: true, periodo: { inicio: '2026-11-01', fim: HOJE } });
    expect(periodoDoRelatorio('mesAnterior', HOJE)).toEqual({ ok: true, periodo: { inicio: '2026-10-01', fim: '2026-10-31' } });
    expect(periodoDoRelatorio('mesAnterior', '2026-01-15')).toEqual({ ok: true, periodo: { inicio: '2025-12-01', fim: '2025-12-31' } });
  });

  it('personalizado: aceita datas boas e corta o fim em hoje (nunca inclui o futuro)', () => {
    expect(periodoDoRelatorio('personalizado', HOJE, 1, { inicio: '2026-10-05', fim: '2026-10-20' })).toEqual({
      ok: true,
      periodo: { inicio: '2026-10-05', fim: '2026-10-20' },
    });
    expect(periodoDoRelatorio('personalizado', HOJE, 1, { inicio: '2026-11-05', fim: '2026-12-31' })).toEqual({
      ok: true,
      periodo: { inicio: '2026-11-05', fim: HOJE },
    });
  });

  it('personalizado: recusa com mensagem clara data inválida, início depois do fim, início no futuro e mais de 366 dias', () => {
    const erro = (inicio: string, fim: string) => {
      const r = periodoDoRelatorio('personalizado', HOJE, 1, { inicio, fim });
      return r.ok ? null : r.erro;
    };
    expect(erro('', '')).toMatch(/Escolha/);
    expect(erro('2026-02-30', '2026-03-01')).toMatch(/Escolha/);
    expect(erro('2026-10-20', '2026-10-05')).toMatch(/antes da data inicial/);
    expect(erro('2026-11-20', '2026-11-25')).toMatch(/futuro/);
    expect(erro('2025-01-01', '2026-11-10')).toMatch(/366/);
    expect(erro('2025-11-10', '2026-11-10')).toBeNull(); // 366 dias exatos (2026-11-10 inclusive) é o limite
    expect(erro('2025-11-09', '2026-11-10')).toMatch(/366/);
  });
});

/**
 * Cenário conferido à mão (hoje = 10/11, terça; primeiro registro em 02/11). Três hábitos:
 *  Cardio 30 min (quantidade) · Meditar (sim ou não) · Calorias até 1.500 kcal (limite)
 *  02 cardio 30, meditar, 1.200 kcal · 03 cardio 30, meditar, 1.800 kcal · 04 cardio 10, 1.500 kcal (nota)
 *  05 nada · 06 folga · 07 cardio 30, meditar, 1.000 kcal · 08 cardio 45, meditar, 1.500 kcal
 *  09 só meditar (nota) · 10 hoje, nada ainda
 */
function cenario() {
  const cardio = habito({ tipo: 'quantidade', meta: 30, nome: 'Cardio', unidade: 'min' });
  const meditar = habito({ tipo: 'conclusao', nome: 'Meditar', unidade: '' });
  const calorias = habito({ tipo: 'limite', meta: 1500, nome: 'Calorias', unidade: 'kcal', blocos: [300] });
  const registros = [
    reg(cardio, 30, '2026-11-02'), reg(cardio, 30, '2026-11-03'), reg(cardio, 10, '2026-11-04'),
    reg(cardio, 30, '2026-11-07'), reg(cardio, 45, '2026-11-08'),
    reg(calorias, 1200, '2026-11-02'), reg(calorias, 1800, '2026-11-03'), reg(calorias, 1500, '2026-11-04'),
    reg(calorias, 1000, '2026-11-07'), reg(calorias, 1500, '2026-11-08'),
  ];
  const marcacoes = ['2026-11-02', '2026-11-03', '2026-11-07', '2026-11-08', '2026-11-09'].map((d) => marca(meditar, d));
  const notas: Record<string, string> = { '2026-11-04': 'treino leve', '2026-11-09': 'viagem; "fim de semana"' };
  const entradas: EntradaDia[] = intervaloDeDatas('2026-10-25', '2026-11-30').map((data) => ({
    data,
    hoje: HOJE,
    habitos: [cardio, meditar, calorias],
    registros,
    marcacoes,
    dia: data === '2026-11-06' ? dia(data, { folga: true }) : notas[data] ? dia(data, { nota: notas[data] }) : undefined,
    inicioSemana: 1,
  }));
  return { cardio, meditar, calorias, entradas };
}

function relatorioDoMes() {
  const c = cenario();
  const r = montarRelatorio(c.entradas, [c.cardio, c.meditar, c.calorias], { inicio: '2026-11-01', fim: HOJE }, 'Este mês', '2026-11-02', HOJE);
  return { ...c, r };
}

describe('T-51n · números do relatório contados à mão', () => {
  it('resumo: 1 dia completo de 7, parciais, sem dados, folga e sequências', () => {
    const { r } = relatorioDoMes();
    // dias contados: 02, 03, 04, 05, 07, 08, 09 (01 é antes do 1º registro, 06 é folga, 10 é hoje em aberto)
    expect(r.resumo).toMatchObject({
      diasCompletos: 1,
      diasDoPeriodo: 7,
      consistenciaPct: 14,
      diasParciais: 5,
      diasSemDados: 1,
      diasFolga: 1,
      melhorSequencia: 1,
      sequenciaAtual: 0,
    });
    expect(r.metasSuperadas).toBe(1); // só o cardio de 45 min no dia 08
  });

  it('por hábito: dias feitos, total, média, metas superadas e dias dentro do limite', () => {
    const { r } = relatorioDoMes();
    const por = Object.fromEntries(r.habitos.map((h) => [h.nome, h]));
    expect(por.Cardio).toMatchObject({ diasProgramados: 7, diasFeitos: 4, total: 145, mediaPorDia: 20.71, metasSuperadas: 1, diasDentroDoLimite: null });
    expect(por.Meditar).toMatchObject({ diasProgramados: 7, diasFeitos: 5, total: 0 });
    // Calorias: feitos = dias exatamente em 1.500 (04 e 08); dentro do limite = 02, 04, 07 e 08 (03 passou de 1.500)
    expect(por.Calorias).toMatchObject({ diasProgramados: 7, diasFeitos: 2, total: 7000, mediaPorDia: 1000, diasDentroDoLimite: 4 });
  });

  it('bate com o resumo por hábito do Histórico (mesma regra)', () => {
    const { cardio, entradas, r } = relatorioDoMes();
    const doPeriodo = entradas.filter((e) => e.data >= '2026-11-01' && e.data <= HOJE);
    const hist = resumirPeriodo(resumosDosDias(doPeriodo, cardio.habito.id), '2026-11-02', HOJE, cardio.habito.id).habito;
    const linha = r.habitos.find((h) => h.nome === 'Cardio');
    expect(linha).toMatchObject({ diasProgramados: hist?.diasProgramados, diasFeitos: hist?.diasFeitos, total: hist?.total });
  });

  it('notas do período, em ordem, com a data', () => {
    const { r } = relatorioDoMes();
    expect(r.notas).toEqual([
      { data: '2026-11-04', texto: 'treino leve' },
      { data: '2026-11-09', texto: 'viagem; "fim de semana"' },
    ]);
  });

  it('nunca inclui dias futuros, mesmo que as entradas cheguem até o fim do mês', () => {
    const { entradas, cardio, meditar, calorias } = cenario();
    const r = montarRelatorio(entradas, [cardio, meditar, calorias], { inicio: '2026-11-01', fim: '2026-11-30' }, 'teste', '2026-11-02', HOJE);
    // o período pedido passa de hoje, mas nenhum dia futuro entra nas contas
    expect(r.resumo.diasDoPeriodo).toBe(7);
    expect(r.habitos.find((h) => h.nome === 'Cardio')?.diasProgramados).toBe(7);
  });

  it('período sem nenhum dado: zeros e "sem dias para contar", sem dividir por zero', () => {
    const { entradas, cardio, meditar, calorias } = cenario();
    const r = montarRelatorio(entradas, [cardio, meditar, calorias], { inicio: '2026-10-25', fim: '2026-10-31' }, 'Semana', '2026-11-02', HOJE);
    expect(r.resumo).toMatchObject({ diasCompletos: 0, diasDoPeriodo: 0, consistenciaPct: null });
    expect(textoDoRelatorio(r)).toContain('sem dias para contar neste período');
    expect(r.habitos.every((h) => h.mediaPorDia === null && h.diasProgramados === 0)).toBe(true);
  });

  it('hábito apagado mantendo o histórico aparece com a marca; sem dias programados, some; arquivado sem dias, some', () => {
    const { entradas, cardio, meditar } = cenario();
    const apagado = habito({ tipo: 'conclusao', nome: 'Apagado' });
    apagado.habito.status = 'removido';
    const arquivadoSemDias = habito({ tipo: 'conclusao', nome: 'Antigo', arquivadoEm: '2026-10-01' });
    const comEle: EntradaDia[] = entradas.map((e) => ({ ...e, habitos: [...e.habitos, apagado] }));
    const r = montarRelatorio(comEle, [cardio, meditar, apagado, arquivadoSemDias], { inicio: '2026-11-01', fim: HOJE }, 'Este mês', '2026-11-02', HOJE);
    expect(r.habitos.map((h) => h.nome)).toEqual(['Cardio', 'Meditar', 'Apagado']);
    expect(r.habitos[2].apagado).toBe(true);
    expect(textoDoRelatorio(r)).toContain('Apagado (apagado)');
  });
});

describe('T-51n · texto e CSV trazem os mesmos números', () => {
  it('texto simples, com tudo que o relatório calculou', () => {
    const { r } = relatorioDoMes();
    const texto = textoDoRelatorio(r);
    expect(texto).toContain('Período: 01/11/2026 a 10/11/2026 (Este mês)');
    expect(texto).toContain('Dias completos: 1 de 7 (14% dos dias do período)');
    expect(texto).toContain('Dias parciais: 5');
    expect(texto).toContain('Dias sem dados: 1');
    expect(texto).toContain('Dias de folga: 1');
    expect(texto).toContain('Sequência atual: 0 dias');
    expect(texto).toContain('Melhor sequência: 1 dia');
    expect(texto).toContain('Metas superadas: 1');
    expect(texto).toContain('Cardio (quantidade)');
    expect(texto).toContain('Dias feitos: 4 de 7');
    expect(texto).toContain('Total: 145 min');
    expect(texto).toContain('Média por dia programado: 20,71 min');
    expect(texto).toContain('Total: 7.000 kcal');
    expect(texto).toContain('Dias dentro do limite: 4');
    expect(texto).toContain('Meditar (sim ou não)');
    expect(texto).toContain('04/11/2026 - treino leve');
    expect(texto).toContain('09/11/2026 - viagem');
    expect(texto).not.toMatch(/falha:/i);
  });

  it('CSV: BOM, separador ;, vírgula decimal, CRLF e três blocos', () => {
    const { r } = relatorioDoMes();
    const csv = csvDoRelatorio(r);
    expect(csv.startsWith('﻿')).toBe(true);
    const linhas = csv.slice(1).split('\r\n');
    expect(linhas[0]).toBe('periodo_inicio;periodo_fim;dias_completos;dias_contados;consistencia_pct;dias_parciais;dias_sem_dados;dias_de_folga;sequencia_atual;melhor_sequencia;metas_superadas');
    expect(linhas[1]).toBe('2026-11-01;2026-11-10;1;7;14;5;1;1;0;1;1');
    expect(linhas[2]).toBe('');
    expect(linhas[3].split(';')[0]).toBe('habito');
    expect(linhas[4]).toBe('Cardio;quantidade;min;nao;7;4;145;20,71;1;');
    expect(linhas[5]).toBe('Meditar;sim ou não;;nao;7;5;;;;');
    expect(linhas[6]).toBe('Calorias;limite;kcal;nao;7;2;7000;1000;;4');
    expect(linhas[7]).toBe('');
    expect(linhas[8]).toBe('data;nota');
    expect(linhas[9]).toBe('2026-11-04;treino leve');
    expect(linhas[10]).toBe('2026-11-09;"viagem; ""fim de semana"""');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('nome dos arquivos leva o período', () => {
    expect(nomeArquivoRelatorio({ inicio: '2026-11-01', fim: '2026-11-10' }, 'csv')).toBe('habit-tracker-relatorio-2026-11-01-a-2026-11-10.csv');
    expect(nomeArquivoRelatorio({ inicio: '2026-11-01', fim: '2026-11-10' }, 'txt')).toMatch(/\.txt$/);
  });
});
