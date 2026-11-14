import { afterEach, describe, expect, it } from 'vitest';
import { diaEditavel } from '../src/services/calculos';
import { gerarBackup, serializarBackup, validarBackup } from '../src/services/backup';
import { fecharTodos, HOJE, novoBancoDeTeste, popular } from './apoioBanco';
import type { Dia } from '../src/types';

afterEach(fecharTodos);

const ONTEM = '2026-11-09';
const AMANHA = '2026-11-11';
const aberto: Dia = { data: HOJE, fechado: false, folga: false };
const finalizado: Dia = { data: HOJE, fechado: true, folga: false };

describe('T-75a · RF-75: regra de dia editável', () => {
  it('hoje aberto é editável', () => {
    expect(diaEditavel(HOJE, HOJE, undefined, false)).toBe(true);
    expect(diaEditavel(HOJE, HOJE, aberto, false)).toBe(true);
  });
  it('hoje finalizado fica travado', () => {
    expect(diaEditavel(HOJE, HOJE, finalizado, false)).toBe(false);
  });
  it('dia passado fica travado, mesmo sem registro de dia', () => {
    expect(diaEditavel(ONTEM, HOJE, undefined, false)).toBe(false);
    expect(diaEditavel(ONTEM, HOJE, { data: ONTEM, fechado: false, folga: false }, false)).toBe(false);
    expect(diaEditavel(ONTEM, HOJE, { data: ONTEM, fechado: true, folga: false }, false)).toBe(false);
  });
  it('dia passado reaberto nesta tela é editável', () => {
    expect(diaEditavel(ONTEM, HOJE, undefined, true)).toBe(true);
  });
  it('dia futuro nunca é editável', () => {
    expect(diaEditavel(AMANHA, HOJE, undefined, false)).toBe(false);
    expect(diaEditavel(AMANHA, HOJE, undefined, true)).toBe(false);
  });
});

describe('T-75b · RF-75: nada novo no banco', () => {
  it('o dia não ganha campo novo e o backup continua válido', async () => {
    const { db, ops } = novoBancoDeTeste();
    await popular(ops);
    await ops.salvarDia(ONTEM, { fechado: true });
    const dia = await db.dias.get(ONTEM);
    expect(Object.keys(dia ?? {}).sort()).toEqual(['data', 'fechado', 'folga']);
    const texto = serializarBackup(await gerarBackup(db, '9.9.9'));
    expect((await validarBackup(texto)).ok).toBe(true);
  });
});

describe('T-77b · RF-77: contador antigo', () => {
  it('a tabela do contador continua no banco e não entra no backup', async () => {
    const { db, ops } = novoBancoDeTeste();
    await popular(ops);
    await db.teste.put({ id: 'contador', valor: 4, atualizadoEm: 'x' });
    expect((await db.teste.get('contador'))?.valor).toBe(4);
    const texto = serializarBackup(await gerarBackup(db, '9.9.9'));
    expect(texto).not.toContain('contador');
    expect(Object.keys(JSON.parse(texto).dados)).not.toContain('teste');
  });
});
