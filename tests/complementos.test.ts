// RF-83 e RF-84: medida e observação opcionais por hábito (testes automáticos T-83 e T-84).
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { calcularDia } from '../src/services/calculos';
import {
  avisoOutraUnidade,
  medidaLigadaNaVersao,
  resumirMedidas,
  totaisDeMedidaPorIntervalo,
} from '../src/services/complementos';
import { aplicarBackup, gerarBackup, serializarBackup, validarBackup, calcularIntegridade } from '../src/services/backup';
import { formularioVazio, habitoParaFormulario, lerFormulario, versaoMudou } from '../src/services/habitos';
import { csvDoRelatorio, montarRelatorio, textoDoRelatorio } from '../src/services/relatorio';
import { BancoHabitos } from '../src/database/db';
import { abrirBancoComSeguranca } from '../src/database/iniciar';
import { HOJE, fecharTodos, novoBancoDeTeste, popular } from './apoioBanco';
import type { Operacoes, NovoHabito } from '../src/database/operacoes';

afterEach(fecharTodos);

const base: NovoHabito = {
  nome: 'Cardio',
  icone: 'heart-pulse',
  cor: '#0B7A43',
  categoria: 'saude',
  tipo: 'conclusao',
  unidade: '',
  meta: 1,
  vigenteDesde: '2026-01-01',
  medidaLigada: true,
  unidadeMedida: 'min',
  observacaoLigada: true,
};

async function criarCardio(ops: Operacoes, extra: Partial<NovoHabito> = {}) {
  return (await ops.criarHabito({ ...base, ...extra })).habito;
}

describe('T-83 · medida opcional: gravar, substituir e remover', () => {
  it('T-83d/f · um valor por dia: salvar de novo substitui (não soma)', async () => {
    const { ops, db } = novoBancoDeTeste();
    const h = await criarCardio(ops);
    await ops.salvarMedida(h.id, '2026-11-09', 40, 'min');
    const antiga = await ops.salvarMedida(h.id, '2026-11-09', 25, 'min');
    expect(antiga?.valor).toBe(40);
    const todas = await db.medidas.toArray();
    expect(todas).toHaveLength(1);
    expect(todas[0].valor).toBe(25);
  });

  it('T-83g · zero, negativo, texto e unidade vazia são recusados e nada é salvo', async () => {
    const { ops, db } = novoBancoDeTeste();
    const h = await criarCardio(ops);
    await expect(ops.salvarMedida(h.id, '2026-11-09', 0, 'min')).rejects.toThrow();
    await expect(ops.salvarMedida(h.id, '2026-11-09', -5, 'min')).rejects.toThrow();
    await expect(ops.salvarMedida(h.id, '2026-11-09', Number.NaN, 'min')).rejects.toThrow();
    await expect(ops.salvarMedida(h.id, '2026-11-09', 10, '  ')).rejects.toThrow();
    await expect(ops.salvarMedida(h.id, 'ontem', 10, 'min')).rejects.toThrow();
    expect(await db.medidas.count()).toBe(0);
  });

  it('remover a medida do dia devolve o que foi removido (Desfazer)', async () => {
    const { ops, db } = novoBancoDeTeste();
    const h = await criarCardio(ops);
    await ops.salvarMedida(h.id, '2026-11-09', 40, 'min');
    const removida = await ops.removerMedida(h.id, '2026-11-09');
    expect(removida?.valor).toBe(40);
    expect(await db.medidas.count()).toBe(0);
    await ops.restaurarComplementos(h.id, '2026-11-09', removida, undefined);
    expect((await db.medidas.toArray())[0].valor).toBe(40);
  });

  it('T-83e/h · salvar medida não marca o hábito e não muda nenhum cálculo do dia', async () => {
    const { ops, db } = novoBancoDeTeste();
    const h = await criarCardio(ops);
    const antes = calcularDia(await ops.carregarEntradaDoDia('2026-11-09', HOJE));
    await ops.salvarMedida(h.id, '2026-11-09', 40, 'min');
    await ops.salvarObservacaoHabito(h.id, '2026-11-09', 'esteira');
    expect(await db.marcacoes.count()).toBe(0);
    const depois = calcularDia(await ops.carregarEntradaDoDia('2026-11-09', HOJE));
    expect(depois).toEqual(antes);
    expect(depois.habitos[0].marcadoNoDia).toBe(false);
  });
});

describe('T-84 · observação por hábito', () => {
  it('T-84a · aceita 140 caracteres e recusa 141', async () => {
    const { ops } = novoBancoDeTeste();
    const h = await criarCardio(ops);
    await ops.salvarObservacaoHabito(h.id, '2026-11-09', 'a'.repeat(140));
    await expect(ops.salvarObservacaoHabito(h.id, '2026-11-09', 'a'.repeat(141))).rejects.toThrow(/140/);
  });

  it('uma por hábito por dia; texto vazio remove; Desfazer volta o que havia', async () => {
    const { ops, db } = novoBancoDeTeste();
    const h = await criarCardio(ops);
    await ops.salvarObservacaoHabito(h.id, '2026-11-09', 'primeira');
    const antes = await ops.salvarObservacaoHabito(h.id, '2026-11-09', 'segunda');
    expect(antes?.texto).toBe('primeira');
    expect(await db.observacoes.count()).toBe(1);
    await ops.restaurarComplementos(h.id, '2026-11-09', undefined, antes);
    expect((await db.observacoes.toArray())[0].texto).toBe('primeira');
    await ops.salvarObservacaoHabito(h.id, '2026-11-09', '   ');
    expect(await db.observacoes.count()).toBe(0);
  });
});

describe('T-83b/c · configuração do hábito', () => {
  it('só sim ou não e semanal aceitam medida; quantidade e limite recusam', async () => {
    const { ops } = novoBancoDeTeste();
    await expect(ops.criarHabito({ ...base, tipo: 'quantidade', meta: 30, blocos: [10], unidade: 'min' })).rejects.toThrow();
    await expect(ops.criarHabito({ ...base, tipo: 'limite', meta: 30, blocos: [10], unidade: 'min' })).rejects.toThrow();
    await expect(ops.criarHabito({ ...base, unidadeMedida: '' })).rejects.toThrow(/unidade/i);
    await expect(ops.criarHabito({ ...base, tipo: 'semanal', unidade: 'vezes', meta: 3 })).resolves.toBeTruthy();
    // observação vale para todos os tipos
    await expect(
      ops.criarHabito({ ...base, nome: 'Água', tipo: 'quantidade', meta: 30, blocos: [10], unidade: 'ml', medidaLigada: false }),
    ).resolves.toBeTruthy();
  });

  it('T-83a · hábito sem complementos continua sem nenhum campo novo na versão', async () => {
    const { ops } = novoBancoDeTeste();
    const { versao } = await ops.criarHabito({ ...base, medidaLigada: false, observacaoLigada: false });
    expect('medidaLigada' in versao).toBe(false);
    expect('observacaoLigada' in versao).toBe(false);
    expect('unidadeMedida' in versao).toBe(false);
    expect(medidaLigadaNaVersao(versao)).toBe(false);
  });

  it('formulário: valida a unidade e mudar um complemento pede "valer a partir de"', async () => {
    const f = { ...formularioVazio(), nome: 'Cardio', tipo: 'conclusao' as const, medidaLigada: true, unidadeMedida: '__outra__', unidadeMedidaOutra: '' };
    expect(lerFormulario(f).ok).toBe(false);
    const ok = lerFormulario({ ...f, unidadeMedidaOutra: 'capítulos' });
    expect(ok.ok && ok.versao.unidadeMedida).toBe('capítulos');
    // quantidade ignora a medida
    const q = lerFormulario({ ...formularioVazio(), nome: 'Água', tipo: 'quantidade', medidaLigada: true });
    expect(q.ok && q.versao.medidaLigada).toBe(false);

    const { ops } = novoBancoDeTeste();
    const { habito, versao } = await ops.criarHabito({ ...base, medidaLigada: false, observacaoLigada: false });
    const livre = lerFormulario(habitoParaFormulario(habito, versao));
    expect(livre.ok && versaoMudou(versao, livre.versao)).toBe(false);
    const ligando = lerFormulario({ ...habitoParaFormulario(habito, versao), medidaLigada: true, unidadeMedida: 'min' });
    expect(ligando.ok && versaoMudou(versao, ligando.versao)).toBe(true);
  });

  it('T-83m · desligar o complemento não apaga o que foi anotado', async () => {
    const { ops, db } = novoBancoDeTeste();
    const h = await criarCardio(ops);
    await ops.salvarMedida(h.id, '2026-11-09', 40, 'min');
    await ops.salvarObservacaoHabito(h.id, '2026-11-09', 'esteira');
    const nova = await ops.adicionarVersao(h.id, '2026-11-10', { medidaLigada: false, observacaoLigada: false });
    expect(nova.medidaLigada).toBeUndefined();
    expect(await db.medidas.count()).toBe(1);
    expect(await db.observacoes.count()).toBe(1);
    // religar traz a configuração de volta
    const religada = await ops.adicionarVersao(h.id, '2026-11-11', { medidaLigada: true, unidadeMedida: 'min' });
    expect(religada.medidaLigada).toBe(true);
  });

  it('apagar o hábito de vez leva junto as medidas e observações dele, e só as dele', async () => {
    const { ops, db } = novoBancoDeTeste();
    const a = await criarCardio(ops);
    const b = await criarCardio(ops, { nome: 'Leitura' });
    await ops.salvarMedida(a.id, '2026-11-09', 40, 'min');
    await ops.salvarMedida(b.id, '2026-11-09', 30, 'min');
    await ops.salvarObservacaoHabito(a.id, '2026-11-09', 'x');
    await ops.excluirHabito(a.id);
    expect((await db.medidas.toArray()).map((m) => m.habitoId)).toEqual([b.id]);
    expect(await db.observacoes.count()).toBe(0);
  });
});

describe('T-83i/j/u/w · contas da medida (relatório e unidades)', () => {
  const medida = (habitoId: string, data: string, valor: number, unidade = 'min') => ({
    id: `${habitoId}-${data}-${unidade}`,
    habitoId,
    data,
    valor,
    unidade,
    criadoEm: '2026-11-10T10:00:00.000Z',
    editadoEm: '2026-11-10T10:00:00.000Z',
  });
  const periodo = { inicio: '2026-11-01', fim: '2026-11-10' };

  it('T-83i · total e média só dos dias anotados; dia sem medida não vira zero', () => {
    const ms = [medida('h', '2026-11-02', 30), medida('h', '2026-11-05', 40), medida('h', '2026-11-08', 50)];
    const r = resumirMedidas(ms, 'h', 'min', periodo, HOJE);
    expect(r.diasComMedida).toBe(3);
    expect(r.total).toBe(120);
    expect(r.media).toBe(40);
    expect(avisoOutraUnidade(r)).toBeNull();
  });

  it('T-83j · sem nenhuma medida: média nula (nunca zero)', () => {
    const r = resumirMedidas([], 'h', 'min', periodo, HOJE);
    expect(r.diasComMedida).toBe(0);
    expect(r.media).toBeNull();
  });

  it('só conta o período, o hábito certo e nunca dias futuros', () => {
    const ms = [medida('h', '2026-10-31', 99), medida('h', '2026-11-02', 10), medida('x', '2026-11-02', 77), medida('h', '2026-11-12', 55)];
    const r = resumirMedidas(ms, 'h', 'min', { inicio: '2026-11-01', fim: '2026-11-30' }, HOJE);
    expect(r.total).toBe(10);
  });

  it('T-83u/w · troca de unidade: soma só a unidade atual e avisa das antigas, sem converter', () => {
    const ms = [medida('h', '2026-11-02', 30), medida('h', '2026-11-03', 40), medida('h', '2026-11-05', 2, 'h'), medida('h', '2026-11-06', 1, 'h'), medida('h', '2026-11-07', 1.5, 'h')];
    const emH = resumirMedidas(ms, 'h', 'h', periodo, HOJE);
    expect(emH.total).toBe(4.5);
    expect(emH.diasComMedida).toBe(3);
    expect(avisoOutraUnidade(emH)).toBe('2 medidas antigas em min não entram neste total');
    const emMin = resumirMedidas(ms, 'h', 'min', periodo, HOJE);
    expect(emMin.total).toBe(70);
    expect(avisoOutraUnidade(emMin)).toBe('3 medidas antigas em h não entram neste total');
    expect(avisoOutraUnidade(resumirMedidas([medida('h', '2026-11-02', 30)], 'h', 'h', periodo, HOJE))).toBe(
      '1 medida antiga em min não entra neste total',
    );
  });

  it('T-83y · sem troca de unidade não há aviso', () => {
    expect(avisoOutraUnidade(resumirMedidas([medida('h', '2026-11-02', 30)], 'h', 'min', periodo, HOJE))).toBeNull();
  });

  it('T-83r/s/t · gráfico da Evolução: total por semana, período vazio é nulo (não zero)', () => {
    const semanas = [
      { inicio: '2026-10-26', fim: '2026-11-01' },
      { inicio: '2026-11-02', fim: '2026-11-08' },
      { inicio: '2026-11-09', fim: '2026-11-15' },
    ];
    const ms = [medida('h', '2026-11-03', 30), medida('h', '2026-11-04', 40), medida('h', '2026-11-05', 1, 'h')];
    expect(totaisDeMedidaPorIntervalo(ms, 'h', 'min', semanas, HOJE)).toEqual([null, 70, null]);
  });
});

describe('T-83i/k · relatório, texto e CSV com medida e observações', () => {
  async function relatorio() {
    const { ops, db } = novoBancoDeTeste();
    const { cardio, meditar } = await popular(ops);
    void cardio;
    const leitura = (await ops.criarHabito({ ...base, nome: 'Leitura', unidadeMedida: 'páginas' })).habito;
    const novo = await criarCardio(ops, { nome: 'Corrida' });
    for (const [d, v] of [['2026-11-02', 30], ['2026-11-05', 40], ['2026-11-08', 50]] as const) await ops.salvarMedida(novo.id, d, v, 'min');
    await ops.salvarMedida(leitura.id, '2026-11-03', 20, 'páginas');
    await ops.salvarObservacaoHabito(novo.id, '2026-11-05', 'esteira; "forte"');
    await ops.salvarObservacaoHabito(meditar.id, '2026-11-09', 'cinco minutos');
    const periodo = { inicio: '2026-11-01', fim: HOJE };
    const [entradas, habitos, primeira, medidas, obs] = await Promise.all([
      ops.carregarEntradasDoIntervalo(periodo.inicio, periodo.fim, HOJE),
      ops.lerHabitosCompletos(),
      ops.primeiraData(),
      ops.lerMedidasDoIntervalo(periodo.inicio, periodo.fim),
      ops.lerObservacoesDoIntervalo(periodo.inicio, periodo.fim),
    ]);
    void db;
    return montarRelatorio(entradas, habitos, periodo, 'Este mês', primeira, HOJE, medidas, obs);
  }

  it('só os hábitos com a medida ligada trazem resumo de medida', async () => {
    const r = await relatorio();
    const corrida = r.habitos.find((h) => h.nome === 'Corrida');
    expect(corrida?.medida).toMatchObject({ diasComMedida: 3, total: 120, media: 40, unidade: 'min' });
    expect(r.habitos.find((h) => h.nome === 'Meditar')?.medida).toBeNull();
    expect(r.habitos.find((h) => h.nome === 'Cardio')?.medida).toBeNull();
  });

  it('texto: medida e lista de observações com data completa', async () => {
    const t = textoDoRelatorio(await relatorio());
    expect(t).toContain('Medida anotada: 3 dias: total 120 min · média 40 min por dia anotado');
    expect(t).toContain('OBSERVAÇÕES DOS HÁBITOS');
    expect(t).toContain('05/11/2026 - Corrida - esteira; "forte"');
    expect(t).toContain('09/11/2026 - Meditar - cinco minutos');
  });

  it('CSV: colunas da medida e quarto bloco de observações com os mesmos números', async () => {
    const csv = csvDoRelatorio(await relatorio());
    const linhas = csv.slice(1).split('\r\n');
    expect(linhas.find((l) => l.startsWith('Corrida;'))).toMatch(/;3;120;40;min;0$/);
    const i = linhas.indexOf('data;habito;observacao');
    expect(i).toBeGreaterThan(0);
    expect(linhas[i + 1]).toBe('2026-11-05;Corrida;"esteira; ""forte"""');
    expect(linhas[i + 2]).toBe('2026-11-09;Meditar;cinco minutos');
  });
});

describe('T-83p · backup, restauração e importação', () => {
  it('ida e volta: medidas e observações voltam idênticas', async () => {
    const a = novoBancoDeTeste();
    const h = await criarCardio(a.ops);
    await a.ops.salvarMedida(h.id, '2026-11-09', 40, 'min');
    await a.ops.salvarObservacaoHabito(h.id, '2026-11-09', 'esteira');
    const arquivo = await gerarBackup(a.db, '9.9.9');
    expect(arquivo.contagens).toMatchObject({ medidas: 1, observacoes: 1 });

    const r = await validarBackup(serializarBackup(arquivo));
    expect(r.ok).toBe(true);
    const b = novoBancoDeTeste();
    await b.db.open();
    if (r.ok) await aplicarBackup(b.db, r.arquivo);
    expect(await b.db.medidas.toArray()).toEqual(await a.db.medidas.toArray());
    expect(await b.db.observacoes.toArray()).toEqual(await a.db.observacoes.toArray());
  });

  it('backup antigo (versão 1, sem medidas) continua sendo aceito e restaura sem medidas', async () => {
    const dados = { habitos: [], versoes: [], registros: [], marcacoes: [], dias: [], config: null };
    const antigo = {
      formato: 'habit-tracker-backup',
      versaoBackup: 1,
      versaoApp: '0.12.1',
      criadoEm: '2026-11-10T10:00:00.000Z',
      contagens: { habitos: 0, versoes: 0, registros: 0, marcacoes: 0, dias: 0 },
      integridade: await calcularIntegridade(JSON.stringify(dados)),
      dados,
    };
    const r = await validarBackup(JSON.stringify(antigo));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.arquivo.dados.medidas).toEqual([]);
      expect(r.arquivo.dados.observacoes).toEqual([]);
    }
  });

  it('arquivo com medida inválida, repetida ou ligada a hábito que não existe é recusado', async () => {
    const a = novoBancoDeTeste();
    const h = await criarCardio(a.ops);
    await a.ops.salvarMedida(h.id, '2026-11-09', 40, 'min');
    const arquivo = await gerarBackup(a.db, '9.9.9');

    const refazer = async (alterar: (d: typeof arquivo.dados) => void) => {
      const copia = JSON.parse(serializarBackup(arquivo)) as typeof arquivo;
      alterar(copia.dados);
      copia.integridade = await calcularIntegridade(JSON.stringify(copia.dados));
      copia.contagens.medidas = copia.dados.medidas.length;
      return validarBackup(JSON.stringify(copia));
    };
    expect((await refazer((d) => (d.medidas[0].valor = -3))).ok).toBe(false);
    expect((await refazer((d) => (d.medidas[0].habitoId = 'nao-existe'))).ok).toBe(false);
    expect((await refazer((d) => d.medidas.push({ ...d.medidas[0], id: 'outra' }))).ok).toBe(false);
    // texto de observação com mais de 140 caracteres
    const comObs = await refazer((d) => {
      d.observacoes = [
        { id: 'o1', habitoId: h.id, data: '2026-11-09', texto: 'a'.repeat(141), criadoEm: '2026-11-10T10:00:00.000Z', editadoEm: '2026-11-10T10:00:00.000Z' },
      ];
    });
    expect(comObs.ok).toBe(false);
    // o original continua válido
    expect((await validarBackup(serializarBackup(arquivo))).ok).toBe(true);
  });
});

describe('T-83o · migração: banco da 0.12.1 (formato 4) com dados abre no formato 5 sem perder nada', () => {
  it('hábitos, versões, registros, marcações e notas ficam intactos; medidas e observações começam vazias', async () => {
    const nome = `mig-${Math.random()}`;
    const antigo = new Dexie(nome);
    antigo.version(4).stores({
      teste: 'id',
      habitos: 'id, status, ordem',
      versoes: 'id, habitoId, [habitoId+vigenteDesde]',
      registros: 'id, habitoId, data, [habitoId+data]',
      marcacoes: 'id, data, &[habitoId+data]',
      dias: 'data',
      config: 'id',
      meta: 'chave',
      copias: 'id, criadaEm, motivo',
    });
    await antigo.open();
    await antigo.table('habitos').add({
      id: 'h1', nome: 'Cardio', icone: 'heart-pulse', cor: '#0B7A43', categoria: 'g', ordem: 0, status: 'ativo',
      criadoEm: '2026-01-01T10:00:00.000Z', editadoEm: '2026-01-01T10:00:00.000Z',
    });
    await antigo.table('versoes').add({
      id: 'v1', habitoId: 'h1', vigenteDesde: '2026-01-01', tipo: 'quantidade', unidade: 'min', meta: 30, blocos: [10],
      frequencia: { tipo: 'todos' }, entraNoPercentual: true, passoAjuste: 1,
    });
    await antigo.table('registros').add({
      id: 'r1', habitoId: 'h1', valor: 10, data: '2026-11-09', horario: '07:10', origem: 'bloco',
      criadoEm: '2026-11-09T10:00:00.000Z', editadoEm: '2026-11-09T10:00:00.000Z',
    });
    await antigo.table('dias').add({ data: '2026-11-09', fechado: false, folga: false, nota: 'dia bom' });
    antigo.close();

    const db = new BancoHabitos(nome);
    const r = await abrirBancoComSeguranca(db, '0.13.0', HOJE);
    expect(r).toEqual({ ok: true, migrou: true });
    expect(db.verno).toBe(5);
    expect(await db.habitos.count()).toBe(1);
    expect((await db.versoes.get('v1'))?.meta).toBe(30);
    expect((await db.registros.get('r1'))?.valor).toBe(10);
    expect((await db.dias.get('2026-11-09'))?.nota).toBe('dia bom');
    expect(await db.medidas.count()).toBe(0);
    expect(await db.observacoes.count()).toBe(0);
    // a cópia "antes de migrar" foi guardada e é um backup válido
    const copia = (await db.copias.toArray())[0];
    expect(copia.motivo).toBe('antes-migrar');
    expect((await validarBackup(copia.conteudo)).ok).toBe(true);
    db.close();
  });
});
