import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { listarCopias } from '../src/database/copias';
import { BancoHabitos } from '../src/database/db';
import { abrirBancoComSeguranca } from '../src/database/iniciar';
import { Operacoes } from '../src/database/operacoes';
import { validarBackup } from '../src/services/backup';
import { HOJE } from './apoioBanco';

const abertos: Dexie[] = [];
afterEach(() => {
  for (const d of abertos.splice(0)) d.close();
});

const nomeNovo = () => `boot-${Math.random()}`;

/** Banco exatamente como o app da Fase 2/3 (formato 2) deixou no iPhone. */
async function bancoAntigoV2(nome: string, comDados: boolean) {
  const antigo = new Dexie(nome);
  antigo.version(2).stores({
    teste: 'id',
    habitos: 'id, status, ordem',
    versoes: 'id, habitoId, [habitoId+vigenteDesde]',
    registros: 'id, habitoId, data, [habitoId+data]',
    marcacoes: 'id, data, &[habitoId+data]',
    dias: 'data',
    config: 'id',
    meta: 'chave',
  });
  await antigo.open();
  if (comDados) {
    const t = '2026-01-01T00:00:00.000Z';
    await antigo.table('habitos').add({ id: 'h1', nome: 'Cardio', icone: 'x', cor: '#000', categoria: 'g', ordem: 0, status: 'ativo', criadoEm: t, editadoEm: t });
    await antigo.table('versoes').add({
      id: 'v1', habitoId: 'h1', vigenteDesde: '2026-01-01', tipo: 'quantidade', unidade: 'min', meta: 30,
      blocos: [10], frequencia: { tipo: 'todos' }, entraNoPercentual: true, passoAjuste: 1,
    });
    await antigo.table('registros').bulkAdd([
      { id: 'r1', habitoId: 'h1', valor: 10, data: '2026-11-09', horario: '07:00', origem: 'bloco', criadoEm: t, editadoEm: t },
      { id: 'r2', habitoId: 'h1', valor: 20, data: '2026-11-10', horario: '08:00', origem: 'digitado', criadoEm: t, editadoEm: t },
    ]);
  }
  await antigo.table('teste').put({ id: 'contador', valor: 4, atualizadoEm: 'x' });
  antigo.close();
}

describe('T-66b e RF-71 · migração com cópia antes de migrar', () => {
  it('dados reais (formato 2) sobrevivem e uma cópia "antes de migrar" é guardada', async () => {
    const nome = nomeNovo();
    await bancoAntigoV2(nome, true);

    const db = new BancoHabitos(nome);
    abertos.push(db);
    const r = await abrirBancoComSeguranca(db, '1.0.0', HOJE);

    expect(r).toEqual({ ok: true, migrou: true });
    expect(db.verno).toBe(4);
    expect(await db.habitos.count()).toBe(1);
    expect(await db.registros.count()).toBe(2);
    expect((await db.teste.get('contador'))?.valor).toBe(4);

    const copias = await listarCopias(db);
    expect(copias).toHaveLength(1);
    expect(copias[0]).toMatchObject({ motivo: 'antes-migrar', habitos: 1, registros: 2 });
    const valida = await validarBackup(copias[0].conteudo);
    expect(valida.ok).toBe(true);
  });

  it('RF-C11: a migração liga "entra no percentual" em Treino e Calorias, sem apagar nada', async () => {
    const nome = nomeNovo();
    await bancoAntigoV2(nome, true);
    const antigo = new Dexie(nome);
    antigo.version(2).stores({ teste: 'id', habitos: 'id, status, ordem', versoes: 'id, habitoId, [habitoId+vigenteDesde]', registros: 'id, habitoId, data, [habitoId+data]', marcacoes: 'id, data, &[habitoId+data]', dias: 'data', config: 'id', meta: 'chave' });
    await antigo.open();
    await antigo.table('versoes').bulkAdd([
      { id: 'v2', habitoId: 'h2', vigenteDesde: '2026-01-01', tipo: 'semanal', unidade: 'vezes', meta: 5, blocos: [], frequencia: { tipo: 'todos' }, entraNoPercentual: false, passoAjuste: 1 },
      { id: 'v3', habitoId: 'h3', vigenteDesde: '2026-01-01', tipo: 'limite', unidade: 'kcal', meta: 1500, blocos: [300], frequencia: { tipo: 'todos' }, entraNoPercentual: false, passoAjuste: 50 },
    ]);
    antigo.close();

    const db = new BancoHabitos(nome);
    abertos.push(db);
    await abrirBancoComSeguranca(db, '1.0.0', HOJE);

    const versoes = await db.versoes.toArray();
    expect(versoes).toHaveLength(3);
    expect(versoes.every((v) => v.entraNoPercentual === true)).toBe(true);
    expect(await db.registros.count()).toBe(2);
  });

  it('abrir de novo (já migrado) não cria outra cópia', async () => {
    const nome = nomeNovo();
    await bancoAntigoV2(nome, true);
    const db = new BancoHabitos(nome);
    abertos.push(db);
    await abrirBancoComSeguranca(db, '1.0.0', HOJE);
    db.close();

    const db2 = new BancoHabitos(nome);
    abertos.push(db2);
    const r = await abrirBancoComSeguranca(db2, '1.0.0', HOJE);
    expect(r).toEqual({ ok: true, migrou: false });
    expect(await listarCopias(db2)).toHaveLength(1);
  });

  it('banco antigo sem hábitos ou registros: migra sem cópia (nada a proteger)', async () => {
    const nome = nomeNovo();
    await bancoAntigoV2(nome, false);
    const db = new BancoHabitos(nome);
    abertos.push(db);
    const r = await abrirBancoComSeguranca(db, '1.0.0', HOJE);
    expect(r).toEqual({ ok: true, migrou: true });
    expect(await listarCopias(db)).toHaveLength(0);
  });

  it('banco da Fase 1 (só o contador) migra sem perder o contador', async () => {
    const nome = nomeNovo();
    const v1 = new Dexie(nome);
    v1.version(1).stores({ teste: 'id' });
    await v1.table('teste').put({ id: 'contador', valor: 7, atualizadoEm: 'x' });
    v1.close();
    const db = new BancoHabitos(nome);
    abertos.push(db);
    const r = await abrirBancoComSeguranca(db, '1.0.0', HOJE);
    expect(r).toEqual({ ok: true, migrou: true });
    expect((await db.teste.get('contador'))?.valor).toBe(7);
  });

  it('banco novo: abre normalmente e grava o marcador de existência', async () => {
    const db = new BancoHabitos(nomeNovo());
    abertos.push(db);
    const r = await abrirBancoComSeguranca(db, '1.0.0', HOJE);
    expect(r).toEqual({ ok: true, migrou: false });
    expect((await db.meta.get('versaoFormato'))?.valor).toBe(4);
    expect(await db.meta.get('criadoEm')).toBeTruthy();
  });
});

describe('T-63b · banco que não abre: nunca começa do zero em silêncio', () => {
  it('dados de uma versão mais nova do app: avisa e devolve o erro', async () => {
    const nome = nomeNovo();
    const futuro = new Dexie(nome);
    futuro.version(99).stores({ teste: 'id', habitos: 'id' });
    await futuro.table('habitos').add({ id: 'x', nome: 'Futuro' });
    futuro.close();

    const db = new BancoHabitos(nome);
    abertos.push(db);
    const r = await abrirBancoComSeguranca(db, '1.0.0', HOJE);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro).toContain('mais nova');
      expect(r.dadosLegados?.contagens.habitos).toBe(1); // dados legíveis são preservados para exportar
    }
    // e o banco não foi recriado nem apagado
    const ainda = new Dexie(nome);
    abertos.push(ainda);
    await ainda.open();
    expect(ainda.verno).toBe(99);
    expect(await ainda.table('habitos').count()).toBe(1);
  });
});

describe('operações do app seguem funcionando depois da migração', () => {
  it('dá para registrar normalmente no banco migrado', async () => {
    const nome = nomeNovo();
    await bancoAntigoV2(nome, true);
    const db = new BancoHabitos(nome);
    abertos.push(db);
    await abrirBancoComSeguranca(db, '1.0.0', HOJE);
    const ops = new Operacoes(db);
    await ops.registrarValor('h1', 5, HOJE, 'manual', '10:00');
    expect(await db.registros.count()).toBe(3);
  });
});
