// Modelos genéricos da tela de primeiro uso (RF-34). Nada pessoal aqui.
import type { HabitoImportado } from './importacao';

const verde = '#0B7A43';

export const MODELOS_PRIMEIRO_USO: HabitoImportado[] = [
  { nome: 'Meditar', icone: 'brain', cor: '#7A4FC2', categoria: 'Saúde', tipo: 'conclusao', unidade: '', meta: 1, blocos: [], frequencia: { tipo: 'todos' }, entraNoPercentual: true, passoAjuste: 1 },
  { nome: 'Treino', icone: 'dumbbell', cor: '#C2410C', categoria: 'Exercício', tipo: 'semanal', unidade: 'vezes', meta: 5, blocos: [], frequencia: { tipo: 'todos' }, entraNoPercentual: true, passoAjuste: 1 },
  { nome: 'Cardio', icone: 'heart-pulse', cor: '#B4235A', categoria: 'Exercício', tipo: 'quantidade', unidade: 'min', meta: 30, blocos: [10], frequencia: { tipo: 'todos' }, entraNoPercentual: true, passoAjuste: 1 },
  { nome: 'Leitura', icone: 'book', cor: '#1F6FB5', categoria: 'Estudos', tipo: 'quantidade', unidade: 'páginas', meta: 20, blocos: [10], frequencia: { tipo: 'todos' }, entraNoPercentual: true, passoAjuste: 1 },
  { nome: 'Idioma', icone: 'languages', cor: '#0E8A8A', categoria: 'Estudos', tipo: 'quantidade', unidade: 'min', meta: 20, blocos: [10], frequencia: { tipo: 'todos' }, entraNoPercentual: true, passoAjuste: 1 },
  { nome: 'Água', icone: 'droplet', cor: '#1F6FB5', categoria: 'Saúde', tipo: 'quantidade', unidade: 'ml', meta: 2000, blocos: [250, 500], frequencia: { tipo: 'todos' }, entraNoPercentual: true, passoAjuste: 50 },
  { nome: 'Calorias', icone: 'utensils', cor: verde, categoria: 'Alimentação', tipo: 'limite', unidade: 'kcal', meta: 1500, blocos: [300], frequencia: { tipo: 'todos' }, entraNoPercentual: true, passoAjuste: 50 },
];
