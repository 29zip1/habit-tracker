// Funções de data (RF-C8). Tudo no fuso local do aparelho, em texto "AAAA-MM-DD".
// A aritmética de dias usa o calendário local (não milissegundos), então
// mudanças de horário de verão não deslocam o dia.
import type { DataLocal } from '../types';

const PADRAO = /^(\d{4})-(\d{2})-(\d{2})$/;

const dois = (n: number) => String(n).padStart(2, '0');

export function ehDataValida(texto: string): boolean {
  const m = PADRAO.exec(texto);
  if (!m) return false;
  const a = Number(m[1]);
  const mes = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(a, mes - 1, d, 12);
  return dt.getFullYear() === a && dt.getMonth() === mes - 1 && dt.getDate() === d;
}

/** Converte "AAAA-MM-DD" em Date ao meio-dia local. Lança erro se for inválida. */
export function paraDate(texto: DataLocal): Date {
  if (!ehDataValida(texto)) throw new Error(`Data inválida: ${texto}`);
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
}

export function formatarData(d: Date): DataLocal {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

export function formatarHorario(d: Date): string {
  return `${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

export function somarDias(texto: DataLocal, dias: number): DataLocal {
  const d = paraDate(texto);
  d.setDate(d.getDate() + dias);
  return formatarData(d);
}

/** 0 = domingo ... 6 = sábado. */
export function diaDaSemana(texto: DataLocal): number {
  return paraDate(texto).getDay();
}

/** Primeiro dia da semana que contém a data. inicioSemana: 0 = domingo, 1 = segunda (padrão). */
export function inicioDaSemana(texto: DataLocal, inicioSemana = 1): DataLocal {
  const dif = (diaDaSemana(texto) - inicioSemana + 7) % 7;
  return somarDias(texto, -dif);
}

/** Os 7 dias da semana que contém a data, em ordem. */
export function diasDaSemana(texto: DataLocal, inicioSemana = 1): DataLocal[] {
  const primeiro = inicioDaSemana(texto, inicioSemana);
  return Array.from({ length: 7 }, (_, k) => somarDias(primeiro, k));
}

/** Lista de datas de `inicio` até `fim`, inclusive. */
export function intervaloDeDatas(inicio: DataLocal, fim: DataLocal): DataLocal[] {
  const lista: DataLocal[] = [];
  let atual = inicio;
  while (atual <= fim) {
    lista.push(atual);
    atual = somarDias(atual, 1);
    if (lista.length > 3700) throw new Error('Intervalo de datas grande demais.');
  }
  return lista;
}

/**
 * Data "lógica" de um instante: se ainda não passou do início do dia
 * configurado (padrão 00:00, até 05:00), vale o dia anterior.
 */
export function dataLogica(agora: Date, inicioDoDiaHora = 0): DataLocal {
  const d = new Date(agora.getTime());
  if (d.getHours() < inicioDoDiaHora) d.setDate(d.getDate() - 1);
  return formatarData(d);
}
