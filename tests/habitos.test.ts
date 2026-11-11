import { afterEach, describe, expect, it } from 'vitest';
import { calcularDia, versaoVigente } from '../src/services/calculos';
import {
  descreverVersao,
  formularioVazio,
  habitoParaFormulario,
  lerFormulario,
  numeroDoTexto,
  OUTRA_UNIDADE,
  versaoMudou,
  type FormHabito,
} from '../src/services/habitos';
import { fecharTodos, HOJE, modeloCardio, novoBancoDeTeste } from './apoioBanco';

afterEach(fecharTodos);

const base = (p: Partial<FormHabito> = {}): FormHabito => ({ ...formularioVazio(), nome: 'Ler', ...p });

describe('T-30c · validação do formulário (mensagens claras)', () => {
  it('formulário padrão é válido', () => {
    expect(lerFormulario(base()).ok).toBe(true);
  });

  it('sem nome', () => {
    const r = lerFormulario(base({ nome: '   ' }));
    expect(r).toEqual({ ok: false, erro: 'Dê um nome ao hábito.' });
  });

  it('meta zero, negativa ou texto', () => {
    for (const meta of ['0', '-5', 'abc', '']) {
      expect(lerFormulario(base({ meta })).ok).toBe(false);
    }
  });

  it('meta semanal só de 1 a 7, inteira', () => {
    expect(lerFormulario(base({ tipo: 'semanal', meta: '8' })).ok).toBe(false);
    expect(lerFormulario(base({ tipo: 'semanal', meta: '2,5' })).ok).toBe(false);
    expect(lerFormulario(base({ tipo: 'semanal', meta: '5' })).ok).toBe(true);
  });

  it('quantidade e limite precisam de pelo menos 1 bloco válido, no máximo 3', () => {
    expect(lerFormulario(base({ blocos: [''] })).ok).toBe(false);
    expect(lerFormulario(base({ blocos: ['0'] })).ok).toBe(false);
    expect(lerFormulario(base({ blocos: ['1', '2', '3', '4'] })).ok).toBe(false);
    expect(lerFormulario(base({ tipo: 'limite', blocos: [] })).ok).toBe(false);
  });

  it('dias escolhidos: nenhum dia é inválido', () => {
    expect(lerFormulario(base({ dias: [] })).ok).toBe(false);
    expect(lerFormulario(base({ dias: [3, 1] })).ok).toBe(true);
  });

  it('data final antes da inicial e datas inválidas', () => {
    expect(lerFormulario(base({ dataInicial: '2026-05-10', dataFinal: '2026-05-01' })).ok).toBe(false);
    expect(lerFormulario(base({ dataInicial: '2026-02-30' })).ok).toBe(false);
  });

  it('unidade personalizada ("km", "capítulos") e vazia', () => {
    const ok = lerFormulario(base({ unidade: OUTRA_UNIDADE, unidadeOutra: ' km ' }));
    expect(ok.ok && ok.versao.unidade).toBe('km');
    expect(lerFormulario(base({ unidade: OUTRA_UNIDADE, unidadeOutra: '  ' })).ok).toBe(false);
  });

  it('conclusão não pede meta, unidade nem blocos; semanal usa "vezes" e ignora dias', () => {
    const c = lerFormulario(base({ tipo: 'conclusao', meta: 'lixo', blocos: [] }));
    expect(c.ok && c.versao).toMatchObject({ tipo: 'conclusao', meta: 1, unidade: '', blocos: [] });
    const s = lerFormulario(base({ tipo: 'semanal', meta: '4', dias: [1] }));
    expect(s.ok && s.versao).toMatchObject({ unidade: 'vezes', meta: 4, blocos: [], frequencia: { tipo: 'todos' } });
  });

  it('números com vírgula (pt-BR) e ponto', () => {
    expect(numeroDoTexto('2,5')).toBe(2.5);
    expect(numeroDoTexto('2.5')).toBe(2.5);
    const r = lerFormulario(base({ blocos: ['0,5', '7'], meta: '1,5' }));
    expect(r.ok && r.versao).toMatchObject({ meta: 1.5, blocos: [0.5, 7] });
  });
});

describe('RF-31 · o que exige "valer a partir de"', () => {
  async function cardio() {
    const { ops } = novoBancoDeTeste();
    const c = await ops.criarHabito(modeloCardio);
    return { ops, ...c };
  }

  it('abrir e salvar sem mexer não conta como mudança (ida e volta pelo formulário)', async () => {
    const { habito, versao } = await cardio();
    const r = lerFormulario(habitoParaFormulario(habito, versao));
    expect(r.ok && versaoMudou(versao, r.versao)).toBe(false);
  });

  it('mudar meta, bloco, unidade, tipo, frequência ou percentual conta como mudança', async () => {
    const { habito, versao } = await cardio();
    const f = habitoParaFormulario(habito, versao);
    const muda = (p: Partial<FormHabito>) => {
      const r = lerFormulario({ ...f, ...p });
      return r.ok && versaoMudou(versao, r.versao);
    };
    expect(muda({ meta: '45' })).toBe(true);
    expect(muda({ blocos: ['7'] })).toBe(true);
    expect(muda({ blocos: ['10', '20'] })).toBe(true);
    expect(muda({ unidade: OUTRA_UNIDADE, unidadeOutra: 'km' })).toBe(true);
    expect(muda({ tipo: 'conclusao' })).toBe(true);
    expect(muda({ dias: [1, 3, 5] })).toBe(true);
    expect(muda({ entra: false })).toBe(true);
    // só nome, ícone, cor, categoria: não é mudança de versão
    expect(muda({ nome: 'Outro', icone: 'book', cor: '#1F6FB5', categoria: 'x' })).toBe(false);
  });
});

describe('T-31 · editar nunca muda o passado (RF-C7)', () => {
  it('T-31a/b: mudar bloco e meta a partir de hoje; dia passado mantém +10 e meta 30', async () => {
    const { db, ops } = novoBancoDeTeste();
    const { habito } = await ops.criarHabito({ ...modeloCardio, vigenteDesde: '2026-11-01' });
    await ops.registrarValor(habito.id, 30, '2026-11-09', 'bloco', '08:00');

    const f = habitoParaFormulario(habito, (await db.versoes.toArray())[0]);
    const r = lerFormulario({ ...f, meta: '45', blocos: ['7'] });
    if (!r.ok) throw new Error(r.erro);
    await ops.salvarEdicao(habito.id, r.campos, r.versao, HOJE);

    const todos = await ops.lerHabitosCompletos();
    const hc = todos[0];
    expect(hc.versoes).toHaveLength(2);
    expect(versaoVigente(hc.versoes, '2026-11-09')).toMatchObject({ meta: 30, blocos: [10] });
    expect(versaoVigente(hc.versoes, HOJE)).toMatchObject({ meta: 45, blocos: [7] });

    // o dia passado continua 100% (30 de 30), não vira 67% (30 de 45)
    const entrada = await ops.carregarEntradaDoDia('2026-11-09', HOJE);
    expect(calcularDia(entrada).percentual).toBe(100);
  });

  it('T-31f: "outra data" vale só a partir dela', async () => {
    const { ops } = novoBancoDeTeste();
    const { habito } = await ops.criarHabito({ ...modeloCardio, vigenteDesde: '2026-11-01' });
    await ops.salvarEdicao(habito.id, { nome: 'Cardio' } as never, { tipo: 'quantidade', unidade: 'min', meta: 60, blocos: [10], passoAjuste: 1 }, '2026-11-20');
    const hc = (await ops.lerHabitosCompletos())[0];
    expect(versaoVigente(hc.versoes, '2026-11-19')?.meta).toBe(30);
    expect(versaoVigente(hc.versoes, '2026-11-20')?.meta).toBe(60);
  });

  it('T-31d: mudar só o nome e o ícone não cria versão nova', async () => {
    const { ops } = novoBancoDeTeste();
    const { habito } = await ops.criarHabito(modeloCardio);
    await ops.salvarEdicao(habito.id, { nome: 'Corrida', icone: 'bike', cor: '#1F6FB5', categoria: 'saude' }, null, HOJE);
    const hc = (await ops.lerHabitosCompletos())[0];
    expect(hc.versoes).toHaveLength(1);
    expect(hc.habito).toMatchObject({ nome: 'Corrida', icone: 'bike', cor: '#1F6FB5' });
  });

  it('T-31e: mudar o tipo de conclusão para quantidade; o passado continua como conclusão', async () => {
    const { db, ops } = novoBancoDeTeste();
    const { habito } = await ops.criarHabito({
      nome: 'Ler a Bíblia', icone: 'book-open', cor: '#0B7A43', categoria: 'g',
      tipo: 'conclusao', unidade: '', meta: 1, vigenteDesde: '2026-11-01',
    });
    await ops.alternarMarcacao(habito.id, '2026-11-09');

    const f = habitoParaFormulario(habito, (await db.versoes.toArray())[0]);
    const r = lerFormulario({ ...f, tipo: 'quantidade', unidade: 'páginas', meta: '5', blocos: ['1', '5'] });
    if (!r.ok) throw new Error(r.erro);
    await ops.salvarEdicao(habito.id, r.campos, r.versao, HOJE);

    const passado = calcularDia(await ops.carregarEntradaDoDia('2026-11-09', HOJE));
    expect(passado.habitos[0].tipo).toBe('conclusao');
    expect(passado.percentual).toBe(100);

    await ops.registrarValor(habito.id, 2, HOJE, 'bloco', '08:00');
    const hoje = calcularDia(await ops.carregarEntradaDoDia(HOJE, HOJE));
    expect(hoje.habitos[0]).toMatchObject({ tipo: 'quantidade', total: 2, meta: 5 });
    expect(hoje.percentual).toBe(40);
  });

  it('a edição é tudo ou nada: versão inválida não muda nem o nome', async () => {
    const { ops } = novoBancoDeTeste();
    const { habito } = await ops.criarHabito(modeloCardio);
    await expect(
      ops.salvarEdicao(habito.id, { nome: 'Novo nome' }, { tipo: 'quantidade', unidade: 'min', meta: -1, blocos: [10] }, HOJE),
    ).rejects.toThrow();
    expect((await ops.lerHabitosCompletos())[0].habito.nome).toBe('Cardio');
  });
});

describe('T-32 · arquivar e reativar', () => {
  it('arquivado some do dia a partir da data e o histórico continua; reativar traz de volta', async () => {
    const { ops } = novoBancoDeTeste();
    const { habito } = await ops.criarHabito({ ...modeloCardio, vigenteDesde: '2026-11-01' });
    await ops.registrarValor(habito.id, 30, '2026-11-09', 'bloco', '08:00');
    await ops.arquivarHabito(habito.id, HOJE);

    const hoje = calcularDia(await ops.carregarEntradaDoDia(HOJE, HOJE));
    expect(hoje.habitos[0].programado).toBe(false);
    const passado = calcularDia(await ops.carregarEntradaDoDia('2026-11-09', HOJE));
    expect(passado.habitos[0].total).toBe(30);
    expect(passado.percentual).toBe(100);

    await ops.reativarHabito(habito.id);
    const volta = calcularDia(await ops.carregarEntradaDoDia(HOJE, HOJE));
    expect(volta.habitos[0].programado).toBe(true);
    expect((await ops.lerHabitosCompletos())[0].habito.status).toBe('ativo');
  });
});

describe('Lista da aba Hábitos', () => {
  it('descreve cada tipo em português simples', async () => {
    const { ops } = novoBancoDeTeste();
    const q = await ops.criarHabito({ ...modeloCardio, blocos: [10, 20] });
    expect(descreverVersao(q.versao)).toBe('30 min por dia · botões +10 +20');
    const l = await ops.criarHabito({ ...modeloCardio, tipo: 'limite', unidade: 'kcal', meta: 1500, blocos: [300] });
    expect(descreverVersao(l.versao)).toBe('Até 1.500 kcal por dia · botões +300');
    const s = await ops.criarHabito({ ...modeloCardio, tipo: 'semanal', unidade: 'vezes', meta: 5, blocos: [] });
    expect(descreverVersao(s.versao)).toBe('5 vezes por semana');
    const c = await ops.criarHabito({ ...modeloCardio, tipo: 'conclusao', unidade: '', meta: 1, blocos: [], frequencia: { tipo: 'dias', dias: [1, 3, 5] } });
    expect(descreverVersao(c.versao)).toBe('Sim ou não · seg, qua, sex');
  });
});
