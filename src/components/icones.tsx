// Ícones Lucide embutidos no app (nada é carregado da internet). Só os usados,
// para o app continuar leve. A tela de escolher ícone (Fase 5) usa esta lista.
import {
  Apple,
  Bike,
  Book,
  BookOpen,
  Brain,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  Coffee,
  Droplet,
  Dumbbell,
  Footprints,
  HeartPulse,
  Languages,
  Leaf,
  ListChecks,
  Moon,
  Music,
  Pencil,
  Settings,
  Star,
  Sun,
  Target,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

export const ICONES_HABITO: Record<string, LucideIcon> = {
  'book-open': BookOpen,
  book: Book,
  dumbbell: Dumbbell,
  'heart-pulse': HeartPulse,
  languages: Languages,
  droplet: Droplet,
  utensils: Utensils,
  brain: Brain,
  footprints: Footprints,
  moon: Moon,
  sun: Sun,
  coffee: Coffee,
  pencil: Pencil,
  music: Music,
  bike: Bike,
  apple: Apple,
  leaf: Leaf,
  star: Star,
  target: Target,
  check: Check,
};

export function IconeHabito({ nome, cor, tamanho = 22 }: { nome: string; cor?: string; tamanho?: number }) {
  const Icone = ICONES_HABITO[nome] ?? Target;
  return <Icone size={tamanho} strokeWidth={1.8} color={cor} aria-hidden="true" />;
}

export const ICONES_NAVEGACAO = {
  hoje: CalendarCheck,
  historico: CalendarDays,
  evolucao: ChartNoAxesColumn,
  habitos: ListChecks,
  ajustes: Settings,
};
