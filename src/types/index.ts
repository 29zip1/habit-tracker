// Modelo de dados do Habit Tracker (seção 4 da especificação).
// Datas são sempre texto local "AAAA-MM-DD", nunca UTC.

export type DataLocal = string;

export type TipoHabito = 'conclusao' | 'quantidade' | 'limite' | 'semanal';

/** dias: 0 = domingo ... 6 = sábado (igual ao Date.getDay). */
export type Frequencia = { tipo: 'todos' } | { tipo: 'dias'; dias: number[] };

export interface Habito {
  id: string;
  nome: string;
  descricao?: string;
  icone: string;
  cor: string;
  categoria: string;
  ordem: number;
  /** 'removido' = apagado mantendo o histórico (RF-32b): some das listas, os registros ficam. */
  status: 'ativo' | 'arquivado' | 'removido';
  dataInicial?: DataLocal;
  dataFinal?: DataLocal;
  /** A partir desta data o hábito deixa de aparecer. O passado continua contando. */
  arquivadoEm?: DataLocal;
  /** Hábito de exemplo (Fase 3): pode ser removido em bloco pelo usuário. Sai na Fase 5. */
  exemplo?: boolean;
  criadoEm: string;
  editadoEm: string;
}

/** Configuração do hábito a partir de uma data (RF-C7: nunca altera o passado). */
export interface VersaoHabito {
  id: string;
  habitoId: string;
  vigenteDesde: DataLocal;
  tipo: TipoHabito;
  unidade: string;
  /** Meta diária (quantidade), limite diário (limite) ou vezes por semana (semanal). */
  meta: number;
  /** De 1 a 3 valores dos botões rápidos (só quantidade e limite). */
  blocos: number[];
  frequencia: Frequencia;
  entraNoPercentual: boolean;
  /** Passo dos botões − e + da janela de valor. */
  passoAjuste: number;
}

export type OrigemRegistro = 'bloco' | 'digitado' | 'manual';

export interface Registro {
  id: string;
  habitoId: string;
  valor: number;
  data: DataLocal;
  /** "HH:MM", horário local. */
  horario: string;
  origem: OrigemRegistro;
  criadoEm: string;
  editadoEm: string;
}

/** Conclusão de um hábito sim/não ou semanal (no máximo uma por hábito por dia). */
export interface Marcacao {
  id: string;
  habitoId: string;
  data: DataLocal;
  criadoEm: string;
}

export interface Dia {
  data: DataLocal;
  fechado: boolean;
  folga: boolean;
  nota?: string;
}

export interface ConfigApp {
  id: 'config';
  tema: 'sistema' | 'claro' | 'escuro';
  /** Hora em que o dia vira (0 a 5). Padrão 0 (meia-noite). */
  inicioDoDiaHora: number;
  /** 0 = domingo ... 6 = sábado. Padrão 1 (segunda). */
  inicioSemana: number;
  dicaVisivel: boolean;
  avisoBackupDias: number;
  /** RF-62c: se ligado, a faixa de backup não tem "Depois" e só some com o backup feito. */
  avisoBackupFixo?: boolean;
  ultimoBackup?: string;
}

export interface MetaBanco {
  chave: string;
  valor: string | number;
}

export type MotivoCopia =
  | 'diaria'
  | 'antes-restaurar'
  | 'antes-atualizar'
  | 'antes-migrar'
  | 'antes-excluir'
  | 'antes-importar';

/** Cópia automática interna (RF-69). Fica no iPhone, junto com os dados. */
export interface Copia {
  id: string;
  criadaEm: string;
  data: DataLocal;
  motivo: MotivoCopia;
  habitos: number;
  registros: number;
  integridade: string;
  /** O arquivo de backup completo, em texto JSON. */
  conteudo: string;
  /** Cópias de segurança (antes de restaurar, atualizar...) ficam até esta data. */
  protegidaAte?: string;
}

export const CONFIG_PADRAO: ConfigApp = {
  id: 'config',
  tema: 'sistema',
  inicioDoDiaHora: 0,
  inicioSemana: 1,
  dicaVisivel: true,
  avisoBackupDias: 7,
};

export const VERSAO_FORMATO_BANCO = 4;
