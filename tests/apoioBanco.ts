// Ajudas para os testes que usam o banco de mentira (fake-indexeddb).
import 'fake-indexeddb/auto';
import { BancoHabitos } from '../src/database/db';
import { Operacoes, type NovoHabito } from '../src/database/operacoes';

let n = 0;
const abertos: BancoHabitos[] = [];

export function novoBancoDeTeste(nome = `t-${++n}-${Math.random()}`) {
  const db = new BancoHabitos(nome);
  abertos.push(db);
  return { db, ops: new Operacoes(db), nome };
}

export function fecharTodos() {
  for (const d of abertos.splice(0)) d.close();
}

export const HOJE = '2026-11-10';

export const modeloCardio: NovoHabito = {
  nome: 'Cardio',
  icone: 'heart-pulse',
  cor: '#0B7A43',
  categoria: 'saude',
  tipo: 'quantidade',
  unidade: 'min',
  meta: 30,
  blocos: [10],
  vigenteDesde: '2026-01-01',
};

/** Cria 3 hábitos (conclusão, quantidade e semanal) com alguns registros, marcações e dias. */
export async function popular(ops: Operacoes) {
  const cardio = await ops.criarHabito(modeloCardio);
  const meditar = await ops.criarHabito({
    nome: 'Meditar', icone: 'brain', cor: '#0B7A43', categoria: 'g', tipo: 'conclusao', unidade: '', meta: 1, vigenteDesde: '2026-01-01',
  });
  const treino = await ops.criarHabito({
    nome: 'Treino; "forte"', icone: 'dumbbell', cor: '#0B7A43', categoria: 'g', tipo: 'semanal', unidade: 'vezes', meta: 5, vigenteDesde: '2026-01-01',
  });
  await ops.registrarValor(cardio.habito.id, 10, '2026-11-09', 'bloco', '07:10');
  await ops.registrarValor(cardio.habito.id, 5.5, HOJE, 'digitado', '08:00');
  await ops.registrarValor(cardio.habito.id, 20, HOJE, 'manual', '19:30');
  await ops.alternarMarcacao(meditar.habito.id, HOJE);
  await ops.alternarMarcacao(treino.habito.id, '2026-11-09');
  await ops.salvarDia(HOJE, { nota: 'dia bom', folga: false });
  await ops.salvarConfig({ inicioSemana: 0 });
  return { cardio: cardio.habito, meditar: meditar.habito, treino: treino.habito };
}
