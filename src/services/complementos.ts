// RF-83 e RF-84: contas da medida opcional e das observações. Sem acesso ao banco nem à tela.
// A medida nunca entra em porcentagem, sequência nem metas: aqui só se soma e se tira média.
import type { DataLocal, Medida, VersaoHabito } from '../types';
import type { Intervalo } from './historico';
import { tipoAceitaMedida } from './habitos';

const arredondar = (n: number, casas: number) => Math.round(n * 10 ** casas) / 10 ** casas;

/** O hábito tem a medida opcional ligada nesta versão? */
export const medidaLigadaNaVersao = (v: VersaoHabito | undefined): v is VersaoHabito & { unidadeMedida: string } =>
  !!v && v.medidaLigada === true && tipoAceitaMedida(v.tipo) && (v.unidadeMedida ?? '') !== '';

export interface ResumoMedida {
  unidade: string;
  /** Dias com medida anotada na unidade atual. */
  diasComMedida: number;
  total: number;
  /** Média só dos dias anotados; null se não houve nenhum. Dia sem medida nunca vira zero. */
  media: number | null;
  /** Medidas do período em OUTRA unidade (não entram no total, nem são convertidas). */
  outraUnidade: number;
  unidadesAntigas: string[];
}

/** Total e média da medida de um hábito no período, só na unidade atual (decisão de 17/11/2026). */
export function resumirMedidas(
  medidas: Medida[],
  habitoId: string,
  unidadeAtual: string,
  periodo: Intervalo,
  hoje: DataLocal,
): ResumoMedida {
  const doHabito = medidas.filter(
    (m) => m.habitoId === habitoId && m.data >= periodo.inicio && m.data <= periodo.fim && m.data <= hoje,
  );
  const naUnidade = doHabito.filter((m) => m.unidade === unidadeAtual);
  const outras = doHabito.filter((m) => m.unidade !== unidadeAtual);
  const total = naUnidade.reduce((s, m) => s + m.valor, 0);
  return {
    unidade: unidadeAtual,
    diasComMedida: naUnidade.length,
    total: arredondar(total, 6),
    media: naUnidade.length === 0 ? null : arredondar(total / naUnidade.length, 2),
    outraUnidade: outras.length,
    unidadesAntigas: [...new Set(outras.map((m) => m.unidade))].sort(),
  };
}

/** "2 medidas antigas em min não entram neste total" (ou null se não há o que avisar). */
export function avisoOutraUnidade(r: Pick<ResumoMedida, 'outraUnidade' | 'unidadesAntigas'>): string | null {
  if (r.outraUnidade === 0) return null;
  const n = r.outraUnidade;
  return `${n} ${n === 1 ? 'medida antiga' : 'medidas antigas'} em ${r.unidadesAntigas.join(', ')} ${
    n === 1 ? 'não entra' : 'não entram'
  } neste total`;
}

/**
 * Total da medida por semana ou mês, para o gráfico da Evolução. Intervalo sem nenhuma
 * medida na unidade atual vira null: a barra fica vazia ("—"), nunca zero.
 */
export function totaisDeMedidaPorIntervalo(
  medidas: Medida[],
  habitoId: string,
  unidadeAtual: string,
  intervalos: Intervalo[],
  hoje: DataLocal,
): (number | null)[] {
  return intervalos.map((i) => {
    const doIntervalo = medidas.filter(
      (m) =>
        m.habitoId === habitoId && m.unidade === unidadeAtual && m.data >= i.inicio && m.data <= i.fim && m.data <= hoje,
    );
    if (doIntervalo.length === 0) return null;
    return arredondar(
      doIntervalo.reduce((s, m) => s + m.valor, 0),
      6,
    );
  });
}
