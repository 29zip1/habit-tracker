import Dexie, { type EntityTable } from 'dexie';

// Fase 1: só um dado de teste, para provar que o iPhone guarda e devolve.
export interface DadoTeste {
  id: string; // sempre 'contador'
  valor: number;
  atualizadoEm: string; // data/hora local, texto
}

class BancoTeste extends Dexie {
  teste!: EntityTable<DadoTeste, 'id'>;

  constructor() {
    super('habit-tracker');
    this.version(1).stores({ teste: 'id' });
  }
}

export const db = new BancoTeste();

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
