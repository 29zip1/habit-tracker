import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { BancoHabitos } from '../src/database/db';
import { Operacoes } from '../src/database/operacoes';
import { calcularDia } from '../src/services/calculos';

let n = 0;
const abertos: Dexie[] = [];
function novoBanco(nome = `teste-${++n}-${Math.random()}`) {
  const db = new BancoHabitos(nome);
  abertos.push(db);
  return { db, ops: new Operacoes(db), nome };
}
afterEach(async () => {
  for (const d of abertos.splice(0)) d.close();
});

const HOJE = '2026-11-10';

const cardio = {
  nome: 'Cardio',
  icone: 'heart',
  cor: '#0B7A43',
  categoria: 'saude',
  tipo: 'quantidade' as const,
  unidade: 'min',
  meta: 30,
  blocos: [10],
  vigenteDesde: '2026-01-01',
};

describe('T-66 · migração do banco (v1 -> v2) não perde dados', () => {
  it('o contador da Fase 1 continua lá depois de migrar, e as tabelas novas existem', async () => {
    const nome = `migracao-${Math.random()}`;

    // Banco exatamente como o app da Fase 1 deixou no iPhone.
    const antigo = new Dexie(nome);
    antigo.version(1).stores({ teste: 'id' });
    await antigo.table('teste').put({ id: 'contador', valor: 7, atualizadoEm: '10/11/2026, 17:47:15' });
    antigo.close();

    // Abre com o app novo (versão 2).
    const { db } = novoBanco(nome);
    await db.open();
    expect(db.verno).toBe(4);
    const contador = await db.teste.get('contador');
    expect(contador?.valor).toBe(7);
    expect(await db.habitos.count()).toBe(0);
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      ['config', 'copias', 'dias', 'habitos', 'marcacoes', 'meta', 'registros', 'teste', 'versoes'],
    );
  });

  it('migrar de novo (abrir outra vez) não altera nada', async () => {
    const { db, nome } = novoBanco();
    await db.teste.put({ id: 'contador', valor: 3, atualizadoEm: 'x' });
    db.close();
    const { db: db2 } = novoBanco(nome);
    expect((await db2.teste.get('contador'))?.valor).toBe(3);
  });
});

describe('T-60 · salvamento imediato (RF-60)', () => {
  it('um registro continua lá depois de fechar e reabrir o banco', async () => {
    const { ops, db, nome } = novoBanco();
    const { habito } = await ops.criarHabito(cardio);
    await ops.registrarValor(habito.id, 10, HOJE, 'bloco', '07:10');
    db.close(); // como fechar o app à força

    const { db: db2 } = novoBanco(nome);
    const regs = await db2.registros.toArray();
    expect(regs).toHaveLength(1);
    expect(regs[0]).toMatchObject({ valor: 10, data: HOJE, horario: '07:10', origem: 'bloco' });
  });
});

describe('RF-18 · dados do registro', () => {
  it('guarda id, hábito, valor, data, horário, origem e datas de criação/edição', async () => {
    const { ops } = novoBanco();
    const { habito } = await ops.criarHabito(cardio);
    const r = await ops.registrarValor(habito.id, 5, HOJE, 'digitado', '09:40');
    expect(r.id).toBeTruthy();
    expect(r).toMatchObject({ habitoId: habito.id, valor: 5, data: HOJE, horario: '09:40', origem: 'digitado' });
    expect(r.criadoEm).toBeTruthy();
    expect(r.editadoEm).toBeTruthy();
  });

  it('IDs são únicos', async () => {
    const { ops } = novoBanco();
    const { habito } = await ops.criarHabito(cardio);
    const a = await ops.registrarValor(habito.id, 1, HOJE, 'bloco');
    const b = await ops.registrarValor(habito.id, 1, HOJE, 'bloco');
    expect(a.id).not.toBe(b.id);
  });

  it('rejeita valor zero, negativo ou data inválida', async () => {
    const { ops } = novoBanco();
    const { habito } = await ops.criarHabito(cardio);
    await expect(ops.registrarValor(habito.id, 0, HOJE, 'manual')).rejects.toThrow();
    await expect(ops.registrarValor(habito.id, -5, HOJE, 'manual')).rejects.toThrow();
    await expect(ops.registrarValor(habito.id, 5, '2026-02-30', 'manual')).rejects.toThrow();
  });
});

describe('corrigir, excluir e desfazer registros (RF-13, RF-16)', () => {
  it('corrigir devolve o registro antigo e atualiza o valor', async () => {
    const { ops, db } = novoBanco();
    const { habito } = await ops.criarHabito(cardio);
    const r = await ops.registrarValor(habito.id, 10, HOJE, 'bloco');
    const antigo = await ops.corrigirRegistro(r.id, 5);
    expect(antigo.valor).toBe(10);
    expect((await db.registros.get(r.id))?.valor).toBe(5);
  });

  it('excluir devolve o registro, que pode ser restaurado (Desfazer)', async () => {
    const { ops, db } = novoBanco();
    const { habito } = await ops.criarHabito(cardio);
    const r = await ops.registrarValor(habito.id, 10, HOJE, 'bloco');
    const removido = await ops.excluirRegistro(r.id);
    expect(await db.registros.count()).toBe(0);
    await ops.restaurarRegistros([removido!]);
    expect(await db.registros.count()).toBe(1);
  });

  it('desfazer tudo do dia remove só aquele hábito naquele dia e devolve tudo', async () => {
    const { ops, db } = novoBanco();
    const { habito } = await ops.criarHabito(cardio);
    const { habito: outro } = await ops.criarHabito({ ...cardio, nome: 'Leitura' });
    await ops.registrarValor(habito.id, 10, HOJE, 'bloco');
    await ops.registrarValor(habito.id, 20, HOJE, 'bloco');
    await ops.registrarValor(habito.id, 10, '2026-11-09', 'bloco');
    await ops.registrarValor(outro.id, 10, HOJE, 'bloco');

    const removidos = await ops.excluirRegistrosDoDia(habito.id, HOJE);
    expect(removidos).toHaveLength(2);
    expect(await db.registros.count()).toBe(2); // ontem do cardio + hoje da leitura

    await ops.restaurarRegistros(removidos);
    expect(await db.registros.count()).toBe(4);
  });
});

describe('marcações (conclusão e semanal)', () => {
  it('alternar marca e desmarca; no máximo uma por hábito por dia', async () => {
    const { ops, db } = novoBanco();
    const { habito } = await ops.criarHabito({
      nome: 'Meditar', icone: 'x', cor: '#000', categoria: 'g', tipo: 'conclusao', unidade: '', meta: 1, vigenteDesde: '2026-01-01',
    });
    expect(await ops.alternarMarcacao(habito.id, HOJE)).toBe(true);
    expect(await db.marcacoes.count()).toBe(1);
    expect(await ops.alternarMarcacao(habito.id, HOJE)).toBe(false);
    expect(await db.marcacoes.count()).toBe(0);
  });

  it('o banco recusa duas marcações do mesmo hábito no mesmo dia', async () => {
    const { db, ops } = novoBanco();
    const { habito } = await ops.criarHabito({
      nome: 'Treino', icone: 'x', cor: '#000', categoria: 'g', tipo: 'semanal', unidade: 'vezes', meta: 5, vigenteDesde: '2026-01-01',
    });
    const base = { habitoId: habito.id, data: HOJE, criadoEm: 'x' };
    await db.marcacoes.add({ id: 'a', ...base });
    await expect(db.marcacoes.add({ id: 'b', ...base })).rejects.toThrow();
  });
});

describe('versões do hábito (RF-31 e RF-C7) no banco', () => {
  it('mudar a meta cria nova versão e não altera a antiga', async () => {
    const { ops, db } = novoBanco();
    const { habito, versao } = await ops.criarHabito(cardio);
    await ops.adicionarVersao(habito.id, HOJE, { meta: 40 });

    const versoes = await db.versoes.where('habitoId').equals(habito.id).toArray();
    expect(versoes).toHaveLength(2);
    expect(versoes.find((v) => v.id === versao.id)?.meta).toBe(30); // antiga intacta
    expect(versoes.find((v) => v.vigenteDesde === HOJE)?.meta).toBe(40);
    expect(versoes.find((v) => v.vigenteDesde === HOJE)?.blocos).toEqual([10]); // herdou o resto
  });

  it('T-C7 de ponta a ponta: ontem usa meta 30, hoje usa meta 40', async () => {
    const { ops } = novoBanco();
    const { habito } = await ops.criarHabito(cardio);
    await ops.adicionarVersao(habito.id, HOJE, { meta: 40 });
    await ops.registrarValor(habito.id, 30, '2026-11-09', 'bloco');
    await ops.registrarValor(habito.id, 30, HOJE, 'bloco');

    const ontem = calcularDia(await ops.carregarEntradaDoDia('2026-11-09', HOJE));
    const hoje = calcularDia(await ops.carregarEntradaDoDia(HOJE, HOJE));
    expect(ontem.percentual).toBe(100);
    expect(hoje.percentual).toBe(75);
  });

  it('mudar de novo na mesma data substitui a versão daquela data (não duplica)', async () => {
    const { ops, db } = novoBanco();
    const { habito } = await ops.criarHabito(cardio);
    await ops.adicionarVersao(habito.id, HOJE, { meta: 40 });
    await ops.adicionarVersao(habito.id, HOJE, { meta: 45 });
    const versoes = await db.versoes.where('habitoId').equals(habito.id).toArray();
    expect(versoes).toHaveLength(2);
    expect(versoes.find((v) => v.vigenteDesde === HOJE)?.meta).toBe(45);
  });

  it('valida: meta zero, mais de 3 blocos e quantidade sem bloco são recusados', async () => {
    const { ops } = novoBanco();
    await expect(ops.criarHabito({ ...cardio, meta: 0 })).rejects.toThrow();
    await expect(ops.criarHabito({ ...cardio, blocos: [1, 2, 3, 4] })).rejects.toThrow();
    await expect(ops.criarHabito({ ...cardio, blocos: [] })).rejects.toThrow();
    await expect(ops.criarHabito({ ...cardio, nome: '   ' })).rejects.toThrow();
  });

  it('RF-C11: padrão do percentual: todos os tipos entram', async () => {
    const { ops } = novoBanco();
    const q = await ops.criarHabito(cardio);
    const l = await ops.criarHabito({ ...cardio, nome: 'Calorias', tipo: 'limite', meta: 1500, blocos: [300] });
    expect(q.versao.entraNoPercentual).toBe(true);
    expect(l.versao.entraNoPercentual).toBe(true);
  });
});

describe('arquivar e reativar (RF-32)', () => {
  it('arquivar mantém o histórico; reativar traz de volta', async () => {
    const { ops, db } = novoBanco();
    const { habito } = await ops.criarHabito(cardio);
    await ops.registrarValor(habito.id, 30, '2026-11-09', 'bloco');
    await ops.arquivarHabito(habito.id, HOJE);

    const passado = calcularDia(await ops.carregarEntradaDoDia('2026-11-09', HOJE));
    const hoje = calcularDia(await ops.carregarEntradaDoDia(HOJE, HOJE));
    expect(passado.percentual).toBe(100);
    expect(hoje.habitos[0].programado).toBe(false);
    expect(await db.registros.count()).toBe(1); // nada apagado

    await ops.reativarHabito(habito.id);
    const depois = calcularDia(await ops.carregarEntradaDoDia(HOJE, HOJE));
    expect(depois.habitos[0].programado).toBe(true);
  });

  it('a ordem dos hábitos é sequencial', async () => {
    const { ops } = novoBanco();
    const a = await ops.criarHabito(cardio);
    const b = await ops.criarHabito({ ...cardio, nome: 'B' });
    expect(b.habito.ordem).toBe(a.habito.ordem + 1);
  });
});

describe('dia, configurações e metadados', () => {
  it('dia de folga e nota são salvos; nota passa de 280 caracteres é recusada', async () => {
    const { ops } = novoBanco();
    expect(await ops.lerDia(HOJE)).toMatchObject({ fechado: false, folga: false });
    await ops.salvarDia(HOJE, { folga: true });
    await ops.salvarDia(HOJE, { nota: 'resfriado' });
    expect(await ops.lerDia(HOJE)).toMatchObject({ folga: true, nota: 'resfriado' });
    await expect(ops.salvarDia(HOJE, { nota: 'a'.repeat(281) })).rejects.toThrow();
    expect((await ops.salvarDia(HOJE, { nota: 'a'.repeat(280) })).nota).toHaveLength(280);
  });

  it('configurações têm padrão e validam o início do dia (00:00 a 05:00)', async () => {
    const { ops } = novoBanco();
    expect(await ops.lerConfig()).toMatchObject({ inicioDoDiaHora: 0, inicioSemana: 1, dicaVisivel: true, avisoBackupDias: 7 });
    await ops.salvarConfig({ inicioDoDiaHora: 5 });
    expect((await ops.lerConfig()).inicioDoDiaHora).toBe(5);
    await expect(ops.salvarConfig({ inicioDoDiaHora: 6 })).rejects.toThrow();
    await expect(ops.salvarConfig({ inicioSemana: 7 })).rejects.toThrow();
  });

  it('marcador de existência e versão do formato são gravados', async () => {
    const { ops, db } = novoBanco();
    await ops.garantirMeta();
    const criado = (await db.meta.get('criadoEm'))?.valor;
    expect(criado).toBeTruthy();
    expect((await db.meta.get('versaoFormato'))?.valor).toBe(4);
    await ops.garantirMeta(); // de novo não muda a data de criação
    expect((await db.meta.get('criadoEm'))?.valor).toBe(criado);
  });
});

describe('RF-66 · nada é apagado sozinho', () => {
  it('ler, calcular e abrir o banco várias vezes não remove nenhum registro', async () => {
    const { ops, db, nome } = novoBanco();
    const { habito } = await ops.criarHabito(cardio);
    for (let i = 0; i < 5; i++) await ops.registrarValor(habito.id, 10, HOJE, 'bloco');
    await ops.garantirMeta();
    calcularDia(await ops.carregarEntradaDoDia(HOJE, HOJE));
    db.close();
    const { db: db2 } = novoBanco(nome);
    await new Operacoes(db2).garantirMeta();
    expect(await db2.registros.count()).toBe(5);
    expect(await db2.habitos.count()).toBe(1);
    expect(await db2.versoes.count()).toBe(1);
  });
});
