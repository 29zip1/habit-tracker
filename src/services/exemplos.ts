// Hábitos de EXEMPLO genéricos, só para testar a tela Hoje na Fase 3.
// Não contêm nada pessoal. Saem na Fase 5, quando existir a tela de criar hábitos.
import type { Operacoes, NovoHabito } from '../database/operacoes';
import type { DataLocal } from '../types';
import { somarDias } from './datas';

type Modelo = Omit<NovoHabito, 'vigenteDesde' | 'exemplo'>;

export const MODELOS_EXEMPLO: Modelo[] = [
  { nome: 'Meditar', descricao: 'Exemplo', icone: 'brain', cor: '#0B7A43', categoria: 'exemplo', tipo: 'conclusao', unidade: '', meta: 1 },
  { nome: 'Treino', icone: 'dumbbell', cor: '#0B7A43', categoria: 'exemplo', tipo: 'semanal', unidade: 'vezes', meta: 5 },
  { nome: 'Cardio', icone: 'heart-pulse', cor: '#0B7A43', categoria: 'exemplo', tipo: 'quantidade', unidade: 'min', meta: 30, blocos: [10], passoAjuste: 1 },
  { nome: 'Leitura', icone: 'book', cor: '#0B7A43', categoria: 'exemplo', tipo: 'quantidade', unidade: 'páginas', meta: 20, blocos: [10], passoAjuste: 1 },
  { nome: 'Idioma', icone: 'languages', cor: '#0B7A43', categoria: 'exemplo', tipo: 'quantidade', unidade: 'min', meta: 20, blocos: [10], passoAjuste: 1 },
  { nome: 'Água', icone: 'droplet', cor: '#0B7A43', categoria: 'exemplo', tipo: 'quantidade', unidade: 'ml', meta: 2000, blocos: [250, 500], passoAjuste: 50 },
  { nome: 'Calorias', icone: 'utensils', cor: '#0B7A43', categoria: 'exemplo', tipo: 'limite', unidade: 'kcal', meta: 1500, blocos: [300], passoAjuste: 50 },
];

/** Cria os 7 hábitos de exemplo, com vigência de 60 dias atrás, para a faixa de dias ter histórico. */
export async function carregarExemplos(ops: Operacoes, hoje: DataLocal): Promise<number> {
  const vigenteDesde = somarDias(hoje, -60);
  for (const m of MODELOS_EXEMPLO) {
    await ops.criarHabito({ ...m, vigenteDesde, exemplo: true });
  }
  return MODELOS_EXEMPLO.length;
}
