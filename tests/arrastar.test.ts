import { afterEach, describe, expect, it } from 'vitest';
import { deslocamentoDaLinha, moverItem, posicaoDeDestino } from '../src/services/ordenar';
import { fecharTodos, HOJE, modeloCardio, novoBancoDeTeste } from './apoioBanco';

afterEach(fecharTodos);

// 4 linhas de 64 px; os meios originais ficam em 32, 96, 160, 224
const meios = [32, 96, 160, 224];

describe('T-33i · conta da nova posição pelo ponto do dedo', () => {
  it('sem mexer, fica onde estava', () => {
    for (let i = 0; i < 4; i++) expect(posicaoDeDestino(meios, i, meios[i])).toBe(i);
  });

  it('arrastar para baixo passa pelos vizinhos quando o meio cruza o deles', () => {
    expect(posicaoDeDestino(meios, 0, 90)).toBe(0); // ainda não cruzou o meio da linha 1 (96)
    expect(posicaoDeDestino(meios, 0, 100)).toBe(1);
    expect(posicaoDeDestino(meios, 0, 170)).toBe(2);
    expect(posicaoDeDestino(meios, 0, 400)).toBe(3); // além do fim: última posição
  });

  it('arrastar para cima', () => {
    expect(posicaoDeDestino(meios, 3, 150)).toBe(2);
    expect(posicaoDeDestino(meios, 3, 40)).toBe(1);
    expect(posicaoDeDestino(meios, 3, -200)).toBe(0); // além do começo: primeira posição
  });
});

describe('moverItem e deslocamento visual', () => {
  it('move sem alterar a lista original e respeita os limites', () => {
    const l = ['a', 'b', 'c', 'd'];
    expect(moverItem(l, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moverItem(l, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moverItem(l, 1, 1)).toEqual(l);
    expect(moverItem(l, 1, 99)).toEqual(['a', 'c', 'd', 'b']);
    expect(moverItem(l, 9, 0)).toEqual(l);
    expect(l).toEqual(['a', 'b', 'c', 'd']);
  });

  it('as linhas do caminho andam uma altura para abrir espaço; as outras ficam paradas', () => {
    // item 0 arrastado até a posição 2: linhas 1 e 2 sobem
    expect([0, 1, 2, 3].map((k) => deslocamentoDaLinha(k, 0, 2, 64))).toEqual([0, -64, -64, 0]);
    // item 3 arrastado até a posição 1: linhas 1 e 2 descem
    expect([0, 1, 2, 3].map((k) => deslocamentoDaLinha(k, 3, 1, 64))).toEqual([0, 64, 64, 0]);
    // sem sair do lugar: ninguém anda
    expect([0, 1, 2, 3].map((k) => deslocamentoDaLinha(k, 2, 2, 64))).toEqual([0, 0, 0, 0]);
  });

  it('o deslocamento visual combina com o resultado de moverItem', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    for (let de = 0; de < 5; de++) {
      for (let para = 0; para < 5; para++) {
        const final = moverItem(ids, de, para);
        ids.forEach((id, k) => {
          if (k === de) return;
          const andou = deslocamentoDaLinha(k, de, para, 1);
          expect(final.indexOf(id) - k, `${de}->${para} linha ${k}`).toBe(andou);
        });
      }
    }
  });
});

describe('T-33h · gravar a ordem (RF-33b)', () => {
  it('muda só a ordem dos ativos, mantém os arquivados no lugar e sobrevive a fechar e reabrir', async () => {
    const { ops, db, nome } = novoBancoDeTeste();
    const a = await ops.criarHabito({ ...modeloCardio, nome: 'A' });
    const b = await ops.criarHabito({ ...modeloCardio, nome: 'B' });
    const c = await ops.criarHabito({ ...modeloCardio, nome: 'C' });
    const d = await ops.criarHabito({ ...modeloCardio, nome: 'D' });
    await ops.arquivarHabito(b.habito.id, HOJE);
    const ordemAntes = Object.fromEntries((await db.habitos.toArray()).map((h) => [h.nome, h.ordem]));

    await ops.definirOrdem([d.habito.id, a.habito.id, c.habito.id]);

    const nomes = (await ops.lerHabitosCompletos()).map((h) => h.habito.nome);
    expect(nomes).toEqual(['D', 'B', 'A', 'C']);
    const depois = Object.fromEntries((await db.habitos.toArray()).map((h) => [h.nome, h.ordem]));
    expect(depois.B).toBe(ordemAntes.B); // arquivado não se mexe
    expect(new Set(Object.values(depois)).size).toBe(4); // sem posições repetidas

    db.close();
    const outro = novoBancoDeTeste(nome);
    expect((await outro.ops.lerHabitosCompletos()).map((h) => h.habito.nome)).toEqual(['D', 'B', 'A', 'C']);
  });

  it('recusa hábito repetido, arquivado ou inexistente, sem mudar nada', async () => {
    const { ops } = novoBancoDeTeste();
    const a = await ops.criarHabito({ ...modeloCardio, nome: 'A' });
    const b = await ops.criarHabito({ ...modeloCardio, nome: 'B' });
    await ops.arquivarHabito(b.habito.id, HOJE);
    await expect(ops.definirOrdem([a.habito.id, a.habito.id])).rejects.toThrow();
    await expect(ops.definirOrdem([a.habito.id, b.habito.id])).rejects.toThrow();
    await expect(ops.definirOrdem([a.habito.id, 'nao-existe'])).rejects.toThrow();
    expect((await ops.lerHabitosCompletos()).map((h) => h.habito.nome)).toEqual(['A', 'B']);
  });
});
