// Exportação CSV dos registros (RF-61). Pensado para abrir no Excel em português:
// separador ";", vírgula decimal, acentos corretos (BOM UTF-8) e linhas CRLF.
import type { Habito, Marcacao, Registro, VersaoHabito } from '../types';
import { versaoVigente } from './calculos';

export const BOM = '﻿';

export function escapar(valor: string): string {
  return /[";\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

export function numeroPtBr(n: number): string {
  return String(n).replace('.', ',');
}

export const CABECALHO_CSV = ['data', 'horario', 'habito', 'valor', 'unidade', 'origem'];

export function gerarCsvRegistros(
  habitos: Habito[],
  versoes: VersaoHabito[],
  registros: Registro[],
  marcacoes: Marcacao[],
): string {
  const nomes = new Map(habitos.map((h) => [h.id, h.nome]));
  const versoesPorHabito = new Map<string, VersaoHabito[]>();
  for (const v of versoes) versoesPorHabito.set(v.habitoId, [...(versoesPorHabito.get(v.habitoId) ?? []), v]);
  const unidade = (habitoId: string, data: string) =>
    versaoVigente(versoesPorHabito.get(habitoId) ?? [], data)?.unidade ?? '';

  const linhas: { data: string; horario: string; campos: string[] }[] = [];
  for (const r of registros) {
    linhas.push({
      data: r.data,
      horario: r.horario,
      campos: [r.data, r.horario, nomes.get(r.habitoId) ?? '', numeroPtBr(r.valor), unidade(r.habitoId, r.data), r.origem],
    });
  }
  for (const m of marcacoes) {
    linhas.push({
      data: m.data,
      horario: '',
      campos: [m.data, '', nomes.get(m.habitoId) ?? '', '1', 'feito', 'marcacao'],
    });
  }
  linhas.sort((a, b) =>
    a.data === b.data ? (a.horario < b.horario ? -1 : a.horario > b.horario ? 1 : 0) : a.data < b.data ? -1 : 1,
  );

  const corpo = [CABECALHO_CSV, ...linhas.map((l) => l.campos)].map((c) => c.map(escapar).join(';'));
  return BOM + corpo.join('\r\n') + '\r\n';
}
