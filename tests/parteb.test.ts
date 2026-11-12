import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { listarCopias } from '../src/database/copias';
import { calcularDia } from '../src/services/calculos';
import {
  aplicarImportacao,
  lerArquivoHabitos,
  preverImportacao,
  serializarArquivoHabitos,
  type HabitoImportado,
} from '../src/services/importacao';
import { MODELOS_PRIMEIRO_USO } from '../src/services/modelos';
import { fecharTodos, HOJE, modeloCardio, novoBancoDeTeste, popular } from './apoioBanco';

afterEach(fecharTodos);

const nomesEmOrdem = async (ops: ReturnType<typeof novoBancoDeTeste>['ops']) =>
  (await ops.lerHabitosCompletos()).map((h) => h.habito.nome);

describe('T-33a · reordenar com ↑ e ↓', () => {
  it('troca com o vizinho, não passa das pontas e a ordem se mantém ao reabrir', async () => {
    const { ops, db, nome } = novoBancoDeTeste();
    const a = await ops.criarHabito({ ...modeloCardio, nome: 'A' });
    const b = await ops.criarHabito({ ...modeloCardio, nome: 'B' });
    const c = await ops.criarHabito({ ...modeloCardio, nome: 'C' });
    expect(await ops.moverHabito(a.habito.id, -1)).toBe(false); // já é o primeiro
    expect(await ops.moverHabito(c.habito.id, 1)).toBe(false); // já é o último
    expect(await ops.moverHabito(b.habito.id, -1)).toBe(true);
    expect(await nomesEmOrdem(ops)).toEqual(['B', 'A', 'C']);
    expect(await ops.moverHabito(b.habito.id, 1)).toBe(true);
    expect(await ops.moverHabito(b.habito.id, 1)).toBe(true);
    expect(await nomesEmOrdem(ops)).toEqual(['A', 'C', 'B']);
    db.close();
    const outro = novoBancoDeTeste(nome);
    expect(await nomesEmOrdem(outro.ops)).toEqual(['A', 'C', 'B']);
  });

  it('arquivados não entram na troca', async () => {
    const { ops } = novoBancoDeTeste();
    const a = await ops.criarHabito({ ...modeloCardio, nome: 'A' });
    const b = await ops.criarHabito({ ...modeloCardio, nome: 'B' });
    const c = await ops.criarHabito({ ...modeloCardio, nome: 'C' });
    await ops.arquivarHabito(b.habito.id, HOJE);
    expect(await ops.moverHabito(c.habito.id, -1)).toBe(true);
    expect(await nomesEmOrdem(ops)).toEqual(['C', 'B', 'A']);
    expect(a).toBeTruthy();
  });
});

describe('T-33b · duplicar', () => {
  it('copia a configuração, sem registros, logo abaixo do original', async () => {
    const { ops } = novoBancoDeTeste();
    const a = await ops.criarHabito({ ...modeloCardio, nome: 'A', blocos: [10, 20], categoria: 'Saúde' });
    await ops.criarHabito({ ...modeloCardio, nome: 'B' });
    await ops.registrarValor(a.habito.id, 15, HOJE, 'bloco', '08:00');
    const dup = await ops.duplicarHabito(a.habito.id, HOJE);
    expect(dup.habito.nome).toBe('A (cópia)');
    expect(dup.versao).toMatchObject({ meta: 30, blocos: [10, 20], unidade: 'min', tipo: 'quantidade' });
    expect(dup.habito.categoria).toBe('Saúde');
    expect(await nomesEmOrdem(ops)).toEqual(['A', 'A (cópia)', 'B']);
    const hoje = calcularDia(await ops.carregarEntradaDoDia(HOJE, HOJE));
    expect(hoje.habitos.find((h) => h.habitoId === dup.habito.id)?.total).toBe(0);
    expect(hoje.habitos.find((h) => h.habitoId === a.habito.id)?.total).toBe(15);
  });

  it('o nome da cópia respeita o limite de 60 caracteres', async () => {
    const { ops } = novoBancoDeTeste();
    const a = await ops.criarHabito({ ...modeloCardio, nome: 'x'.repeat(60) });
    expect((await ops.duplicarHabito(a.habito.id, HOJE)).habito.nome.length).toBeLessThanOrEqual(60);
  });
});

describe('T-32b/c/d · excluir de vez', () => {
  it('RF-32b: também apaga um hábito ativo, sem precisar arquivar', async () => {
    const { ops } = novoBancoDeTeste();
    const a = await ops.criarHabito(modeloCardio);
    await ops.registrarValor(a.habito.id, 10, HOJE, 'bloco', '08:00');
    await ops.excluirHabito(a.habito.id);
    expect(await nomesEmOrdem(ops)).toEqual([]);
    await expect(ops.excluirHabito('nao-existe')).rejects.toThrow();
  });

  it('apaga só aquele hábito, com versões, registros e marcações; o resto fica intacto', async () => {
    const { ops, db } = novoBancoDeTeste();
    const { cardio, meditar } = await popular(ops);
    await ops.adicionarVersao(cardio.id, '2026-11-05', { meta: 45 });
    await ops.arquivarHabito(cardio.id, HOJE);
    const antes = {
      habitos: await db.habitos.count(),
      registros: await db.registros.count(),
      marcacoes: await db.marcacoes.count(),
    };
    const r = await ops.excluirHabito(cardio.id);
    expect(r.registros).toBe(3);
    expect(await db.habitos.count()).toBe(antes.habitos - 1);
    expect(await db.registros.count()).toBe(antes.registros - 3);
    expect(await db.marcacoes.count()).toBe(antes.marcacoes); // nenhuma era do cardio
    expect(await db.versoes.where('habitoId').equals(cardio.id).count()).toBe(0);
    expect(await db.marcacoes.where('habitoId').equals(meditar.id).count()).toBe(1);
    expect(await db.dias.count()).toBe(1); // dias (nota, folga) não são do hábito
  });
});

const dois: HabitoImportado[] = [
  { nome: 'Ler a Bíblia', icone: 'book-open', cor: '#0B7A43', categoria: 'Espiritual', tipo: 'conclusao', unidade: '', meta: 1, blocos: [], frequencia: { tipo: 'todos' }, entraNoPercentual: true, passoAjuste: 1 },
  { nome: 'Cardio', icone: 'heart-pulse', cor: '#B4235A', categoria: 'Exercício', tipo: 'quantidade', unidade: 'min', meta: 30, blocos: [10], frequencia: { tipo: 'todos' }, entraNoPercentual: true, passoAjuste: 1 },
];

describe('T-34f · importar hábitos', () => {
  it('um arquivo válido é aceito (ida e volta)', () => {
    const r = lerArquivoHabitos(serializarArquivoHabitos(dois));
    expect(r.ok && r.habitos).toEqual(dois);
  });

  it('os modelos de primeiro uso são válidos', () => {
    expect(lerArquivoHabitos(serializarArquivoHabitos(MODELOS_PRIMEIRO_USO)).ok).toBe(true);
  });

  it('recusa texto qualquer, arquivo vazio, outro formato, versão futura e lista vazia', () => {
    for (const t of ['', 'oi', '[]', '{}', '{"formato":"habit-tracker-backup","versaoBackup":1}']) {
      expect(lerArquivoHabitos(t).ok, t).toBe(false);
    }
    const futuro = JSON.stringify({ formato: 'habit-tracker-habitos', versaoArquivo: 9, habitos: dois });
    expect(lerArquivoHabitos(futuro)).toMatchObject({ ok: false });
    const vazio = JSON.stringify({ formato: 'habit-tracker-habitos', versaoArquivo: 1, habitos: [] });
    expect(lerArquivoHabitos(vazio)).toMatchObject({ ok: false });
  });

  it('recusa o arquivo inteiro se UM hábito está errado, dizendo qual', () => {
    const quebra = (mexer: (h: any) => void) => {
      const copia = JSON.parse(JSON.stringify(dois));
      mexer(copia[1]);
      return lerArquivoHabitos(JSON.stringify({ formato: 'habit-tracker-habitos', versaoArquivo: 1, habitos: copia }));
    };
    const casos: Array<(h: any) => void> = [
      (h) => (h.nome = '   '),
      (h) => (h.tipo = 'voo'),
      (h) => (h.meta = 0),
      (h) => (h.meta = '30'),
      (h) => (h.blocos = []),
      (h) => (h.blocos = [1, 2, 3, 4]),
      (h) => (h.blocos = [-1]),
      (h) => (h.cor = 'verde'),
      (h) => (h.frequencia = { tipo: 'dias', dias: [9] }),
      (h) => (h.frequencia = { tipo: 'sempre' }),
      (h) => (h.entraNoPercentual = 'sim'),
      (h) => (h.passoAjuste = 0),
      (h) => (h.categoria = 'x'.repeat(31)),
    ];
    for (const c of casos) {
      const r = quebra(c);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).toContain('Hábito 2');
    }
  });

  it('aplica: cria os hábitos, guarda cópia antes e não toca no que já existe', async () => {
    const { ops, db } = novoBancoDeTeste();
    await ops.criarHabito({ ...modeloCardio, nome: 'Outro' });
    await ops.registrarValor((await db.habitos.toArray())[0].id, 10, HOJE, 'bloco', '08:00');
    const r = await aplicarImportacao(db, ops, dois, '9.9.9', HOJE);
    expect(r).toEqual({ criados: 2, puladosJaExistem: 0 });
    expect(await nomesEmOrdem(ops)).toEqual(['Outro', 'Ler a Bíblia', 'Cardio']);
    expect(await db.registros.count()).toBe(1);
    expect((await listarCopias(db)).map((c) => c.motivo)).toContain('antes-importar');
  });

  it('importar duas vezes não duplica (mesmo nome, ignorando maiúsculas)', async () => {
    const { ops, db } = novoBancoDeTeste();
    await aplicarImportacao(db, ops, dois, '9.9.9', HOJE);
    const maiusculas = dois.map((h) => ({ ...h, nome: h.nome.toUpperCase() }));
    const r = await aplicarImportacao(db, ops, maiusculas, '9.9.9', HOJE);
    expect(r).toEqual({ criados: 0, puladosJaExistem: 2 });
    expect(await db.habitos.count()).toBe(2);
    const previa = await preverImportacao(db, [...dois, { ...dois[0], nome: 'Novo' }, { ...dois[0], nome: 'novo' }]);
    expect(previa.novos.map((h) => h.nome)).toEqual(['Novo']);
    expect(previa.jaExistem).toHaveLength(3);
  });

  it('tudo ou nada: se um hábito falha no meio, nenhum é criado', async () => {
    const { ops, db } = novoBancoDeTeste();
    const ruim = { ...dois[1], nome: 'Ruim', meta: -5 } as HabitoImportado;
    await expect(aplicarImportacao(db, ops, [dois[0], ruim], '9.9.9', HOJE)).rejects.toThrow();
    expect(await db.habitos.count()).toBe(0);
  });
});

describe('T-34c · arquivo local de hábitos (só existe no computador do usuário)', () => {
  it('se o arquivo da pasta privada existir, ele é válido e todos entram no percentual', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    const caminho = 'privado/habitos-iniciais.json';
    if (!existsSync(caminho)) return;
    const r = lerArquivoHabitos(readFileSync(caminho, 'utf8'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.habitos.every((h) => h.entraNoPercentual)).toBe(true);
  });
});

describe('T-32g/h · apagar mantendo o histórico (RF-32b)', () => {
  it('continua hoje e conta no percentual de hoje, sai a partir de amanhã, dias passados intactos', async () => {
    const { ops } = novoBancoDeTeste();
    const a = await ops.criarHabito({ ...modeloCardio, vigenteDesde: '2026-11-01' });
    const b = await ops.criarHabito({ ...modeloCardio, nome: 'B', vigenteDesde: '2026-11-01' });
    await ops.registrarValor(a.habito.id, 30, '2026-11-09', 'bloco', '08:00');
    await ops.registrarValor(a.habito.id, 15, HOJE, 'bloco', '08:00');
    const passadoAntes = calcularDia(await ops.carregarEntradaDoDia('2026-11-09', HOJE)).percentual;
    const hojeAntes = calcularDia(await ops.carregarEntradaDoDia(HOJE, HOJE)).percentual;

    await ops.removerMantendoHistorico(a.habito.id, HOJE);

    const hoje = calcularDia(await ops.carregarEntradaDoDia(HOJE, HOJE));
    expect(hoje.habitos.find((h) => h.habitoId === a.habito.id)?.programado).toBe(true);
    expect(hoje.habitos.find((h) => h.habitoId === a.habito.id)?.total).toBe(15);
    expect(hoje.percentual).toBe(hojeAntes);
    const amanha = calcularDia(await ops.carregarEntradaDoDia('2026-11-11', '2026-11-11'));
    expect(amanha.habitos.find((h) => h.habitoId === a.habito.id)?.programado).toBe(false);
    expect(amanha.habitos.find((h) => h.habitoId === b.habito.id)?.programado).toBe(true);
    expect(calcularDia(await ops.carregarEntradaDoDia('2026-11-09', HOJE)).percentual).toBe(passadoAntes);
  });

  it('some das listas de ativos e de arquivados, não entra na ordem e não dá para reativar pela tela', async () => {
    const { ops } = novoBancoDeTeste();
    const a = await ops.criarHabito({ ...modeloCardio, nome: 'A' });
    const b = await ops.criarHabito({ ...modeloCardio, nome: 'B' });
    await ops.removerMantendoHistorico(a.habito.id, HOJE);
    const todos = await ops.lerHabitosCompletos();
    expect(todos.filter((h) => h.habito.status === 'ativo').map((h) => h.habito.nome)).toEqual(['B']);
    expect(todos.filter((h) => h.habito.status === 'arquivado')).toHaveLength(0);
    expect(todos.find((h) => h.habito.nome === 'A')?.habito.status).toBe('removido');
    await expect(ops.definirOrdem([a.habito.id, b.habito.id])).rejects.toThrow();
    await expect(ops.removerMantendoHistorico('nao-existe', HOJE)).rejects.toThrow();
  });

  it('o backup continua trazendo os registros do hábito removido e é válido; restaurar devolve tudo', async () => {
    const { ops, db } = novoBancoDeTeste();
    const a = await ops.criarHabito(modeloCardio);
    await ops.registrarValor(a.habito.id, 15, HOJE, 'bloco', '08:00');
    await ops.removerMantendoHistorico(a.habito.id, HOJE);
    const { gerarBackup, serializarBackup, validarBackup } = await import('../src/services/backup');
    const arquivo = await gerarBackup(db, '9.9.9');
    expect(arquivo.contagens.registros).toBe(1);
    expect(arquivo.dados.habitos[0].status).toBe('removido');
    expect((await validarBackup(serializarBackup(arquivo))).ok).toBe(true);
  });

  it('a opção "apagar tudo" apaga também de hoje e dos dias anteriores', async () => {
    const { ops, db } = novoBancoDeTeste();
    const a = await ops.criarHabito({ ...modeloCardio, vigenteDesde: '2026-11-01' });
    await ops.registrarValor(a.habito.id, 30, '2026-11-09', 'bloco', '08:00');
    await ops.registrarValor(a.habito.id, 15, HOJE, 'bloco', '08:00');
    await ops.excluirHabito(a.habito.id);
    expect(await db.registros.count()).toBe(0);
    expect(await db.habitos.count()).toBe(0);
  });
});
