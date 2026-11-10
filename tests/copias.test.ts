import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  criarCopiaDeSeguranca,
  criarCopiaDiaria,
  criarCopiaDiariaSegura,
  limparCopias,
  listarCopias,
  validarCopia,
} from '../src/database/copias';
import { restaurarComSeguranca } from '../src/database/restauracao';
import { somarDias } from '../src/services/datas';
import { fecharTodos, HOJE, modeloCardio, novoBancoDeTeste, popular } from './apoioBanco';

afterEach(fecharTodos);

const momento = (data: string) => new Date(`${data}T09:00:00`);

describe('T-69a · cópia diária', () => {
  it('cria uma cópia na primeira abertura do dia, quando há dados', async () => {
    const { db, ops } = novoBancoDeTeste();
    await popular(ops);
    const c = await criarCopiaDiaria(db, '1.0.0', HOJE, momento(HOJE));
    expect(c).not.toBeNull();
    expect(c).toMatchObject({ motivo: 'diaria', data: HOJE, habitos: 3, registros: 3 });
    expect(c?.protegidaAte).toBeUndefined();
  });

  it('não cria cópia de banco vazio', async () => {
    const { db } = novoBancoDeTeste();
    expect(await criarCopiaDiaria(db, '1.0.0', HOJE, momento(HOJE))).toBeNull();
  });

  it('não cria duas no mesmo dia', async () => {
    const { db, ops } = novoBancoDeTeste();
    const { cardio } = await popular(ops);
    await criarCopiaDiaria(db, '1.0.0', HOJE, momento(HOJE));
    await ops.registrarValor(cardio.id, 10, HOJE, 'bloco');
    expect(await criarCopiaDiaria(db, '1.0.0', HOJE, momento(HOJE))).toBeNull();
    expect(await listarCopias(db)).toHaveLength(1);
  });

  it('se nada mudou desde a última cópia, não cria outra no dia seguinte', async () => {
    const { db, ops } = novoBancoDeTeste();
    await popular(ops);
    await criarCopiaDiaria(db, '1.0.0', HOJE, momento(HOJE));
    const amanha = somarDias(HOJE, 1);
    expect(await criarCopiaDiaria(db, '1.0.0', amanha, momento(amanha))).toBeNull();
  });

  it('se algo mudou, cria no dia seguinte', async () => {
    const { db, ops } = novoBancoDeTeste();
    const { cardio } = await popular(ops);
    await criarCopiaDiaria(db, '1.0.0', HOJE, momento(HOJE));
    await ops.registrarValor(cardio.id, 10, HOJE, 'bloco');
    const amanha = somarDias(HOJE, 1);
    expect(await criarCopiaDiaria(db, '1.0.0', amanha, momento(amanha))).not.toBeNull();
    expect(await listarCopias(db)).toHaveLength(2);
  });

  it('a cópia é um backup válido e restaurável', async () => {
    const { db, ops } = novoBancoDeTeste();
    await popular(ops);
    const c = await criarCopiaDiaria(db, '1.0.0', HOJE, momento(HOJE));
    const v = await validarCopia(c!);
    expect(v.ok).toBe(true);
  });
});

describe('T-69b · só as 14 cópias diárias mais recentes ficam; os dados nunca são tocados', () => {
  it('20 dias de uso: 14 cópias, 20 registros', async () => {
    const { db, ops } = novoBancoDeTeste();
    const { habito } = await ops.criarHabito(modeloCardio);
    let dia = '2026-10-01';
    for (let i = 0; i < 20; i++) {
      await ops.registrarValor(habito.id, 10, dia, 'bloco');
      await criarCopiaDiaria(db, '1.0.0', dia, momento(dia));
      dia = somarDias(dia, 1);
    }
    const copias = await listarCopias(db);
    expect(copias).toHaveLength(14);
    expect(copias[0].data).toBe('2026-10-20'); // a mais nova fica
    expect(copias[13].data).toBe('2026-10-07'); // as 6 mais antigas saíram
    expect(await db.registros.count()).toBe(20); // nenhum registro foi apagado
    expect(await db.habitos.count()).toBe(1);
  });
});

describe('T-69d · cópias de segurança antes de ações perigosas', () => {
  it('ficam protegidas por 30 dias e não são descartadas pela regra das 14', async () => {
    const { db, ops } = novoBancoDeTeste();
    await popular(ops);
    const t0 = momento(HOJE);
    for (const motivo of ['antes-atualizar', 'antes-excluir', 'antes-migrar'] as const) {
      await criarCopiaDeSeguranca(db, motivo, '1.0.0', HOJE, t0);
    }
    expect(await listarCopias(db)).toHaveLength(3);

    // muitas diárias depois: as de segurança continuam
    const { cardio } = { cardio: (await db.habitos.toArray())[0] };
    let dia = HOJE;
    for (let i = 0; i < 20; i++) {
      dia = somarDias(dia, 1);
      await ops.registrarValor(cardio.id, 1, dia, 'bloco');
      await criarCopiaDiaria(db, '1.0.0', dia, momento(dia));
    }
    const todas = await listarCopias(db);
    expect(todas.filter((c) => c.motivo === 'diaria')).toHaveLength(14);
    expect(todas.filter((c) => c.motivo !== 'diaria')).toHaveLength(3);
  });

  it('depois de 30 dias as cópias de segurança podem ser descartadas; antes disso, não', async () => {
    const { db, ops } = novoBancoDeTeste();
    await popular(ops);
    await criarCopiaDeSeguranca(db, 'antes-atualizar', '1.0.0', HOJE, momento(HOJE));
    const em10 = new Date(momento(HOJE).getTime() + 10 * 86_400_000);
    const em31 = new Date(momento(HOJE).getTime() + 31 * 86_400_000);
    expect(await limparCopias(db, em10)).toBe(0);
    expect(await listarCopias(db)).toHaveLength(1);
    expect(await limparCopias(db, em31)).toBe(1);
    expect(await listarCopias(db)).toHaveLength(0);
    expect(await db.registros.count()).toBe(3); // dados intactos
  });

  it('restaurar uma cópia interna (T-69c): prévia válida, estado atual guardado antes, sem duplicar', async () => {
    const { db, ops } = novoBancoDeTeste();
    const { cardio } = await popular(ops);
    const c = await criarCopiaDiaria(db, '1.0.0', HOJE, momento(HOJE));
    await ops.registrarValor(cardio.id, 99, HOJE, 'bloco'); // muda depois da cópia
    expect(await db.registros.count()).toBe(4);

    const r = await restaurarComSeguranca(db, c!.conteudo, '1.0.0', HOJE, momento(HOJE));
    expect(r.ok).toBe(true);
    expect(await db.registros.count()).toBe(3); // voltou ao estado da cópia
    const tipos = (await listarCopias(db)).map((x) => x.motivo).sort();
    expect(tipos).toEqual(['antes-restaurar', 'diaria']); // o estado de antes foi guardado
  });
});

describe('T-69f · falha ao guardar a cópia não atrapalha o uso', () => {
  it('armazenamento cheio: devolve "falhou", não lança erro e os dados seguem intactos', async () => {
    const { db, ops } = novoBancoDeTeste();
    await popular(ops);
    const espiao = vi.spyOn(Object.getPrototypeOf(db.copias), 'add').mockRejectedValue(new DOMException('cheio', 'QuotaExceededError'));
    const r = await criarCopiaDiariaSegura(db, '1.0.0', HOJE, momento(HOJE));
    espiao.mockRestore();
    expect(r).toBe('falhou');
    expect(await db.registros.count()).toBe(3);
    // e depois, com espaço de novo, volta a funcionar
    expect(await criarCopiaDiariaSegura(db, '1.0.0', HOJE, momento(HOJE))).toBe('criada');
  });
});
