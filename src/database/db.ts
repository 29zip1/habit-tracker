import Dexie, { type EntityTable } from 'dexie';
import type {
  ConfigApp,
  Copia,
  Dia,
  Habito,
  Marcacao,
  MetaBanco,
  Registro,
  VersaoHabito,
} from '../types';

// Fase 1: só um dado de teste, para provar que o iPhone guarda e devolve.
export interface DadoTeste {
  id: string; // sempre 'contador'
  valor: number;
  atualizadoEm: string; // data/hora local, texto
}

export class BancoHabitos extends Dexie {
  teste!: EntityTable<DadoTeste, 'id'>;
  habitos!: EntityTable<Habito, 'id'>;
  versoes!: EntityTable<VersaoHabito, 'id'>;
  registros!: EntityTable<Registro, 'id'>;
  marcacoes!: EntityTable<Marcacao, 'id'>;
  dias!: EntityTable<Dia, 'data'>;
  config!: EntityTable<ConfigApp, 'id'>;
  meta!: EntityTable<MetaBanco, 'chave'>;
  copias!: EntityTable<Copia, 'id'>;

  constructor(nome = 'habit-tracker') {
    super(nome);

    // Versão 1 (Fase 1): só o contador de teste.
    this.version(1).stores({ teste: 'id' });

    // Versão 2 (Fase 2): só ACRESCENTA tabelas. Nada é apagado, nem a tabela
    // "teste" (RF-66: nunca apagar dados sozinho).
    this.version(2).stores({
      teste: 'id',
      habitos: 'id, status, ordem',
      versoes: 'id, habitoId, [habitoId+vigenteDesde]',
      registros: 'id, habitoId, data, [habitoId+data]',
      marcacoes: 'id, data, &[habitoId+data]',
      dias: 'data',
      config: 'id',
      meta: 'chave',
    });

    // Versão 3 (Fase 4): só ACRESCENTA a tabela das cópias automáticas (RF-69).
    this.version(3).stores({
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

    // Versão 4 (RF-C11): todo hábito entra no percentual do dia. Até aqui limite e
    // semanal foram gravados como "fora" só pelo padrão (não havia tela para mudar).
    // Não apaga nada: só liga a opção nas versões que estavam desligadas.
    this.version(4)
      .stores({
        teste: 'id',
        habitos: 'id, status, ordem',
        versoes: 'id, habitoId, [habitoId+vigenteDesde]',
        registros: 'id, habitoId, data, [habitoId+data]',
        marcacoes: 'id, data, &[habitoId+data]',
        dias: 'data',
        config: 'id',
        meta: 'chave',
        copias: 'id, criadaEm, motivo',
      })
      .upgrade((tx) =>
        tx
          .table('versoes')
          .toCollection()
          .modify((v: { entraNoPercentual?: boolean }) => {
            v.entraNoPercentual = true;
          }),
      );
  }
}

export const db = new BancoHabitos();

export async function lerContador(): Promise<DadoTeste | undefined> {
  return db.teste.get('contador');
}

export async function somarContador(): Promise<DadoTeste> {
  const atual = await lerContador();
  const novo: DadoTeste = {
    id: 'contador',
    valor: (atual?.valor ?? 0) + 1,
    atualizadoEm: new Date().toLocaleString('pt-BR'),
  };
  await db.teste.put(novo);
  return novo;
}
