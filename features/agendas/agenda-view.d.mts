import type { AgendaItem } from '@/lib/civic-agent/agendas.mjs';
export type AgendaDisplayItem = AgendaItem & {
  displayTitle: string;
  summary: string;
  aiReady: boolean;
  topic: string;
};
export type AgendaGroup = {
  id: number;
  date: string;
  committee: string;
  items: AgendaDisplayItem[];
};
export function agendaTopic(title: string): string;
export function fallbackAgendaTitle(title: string): string;
export function groupAgendaItems(
  items: AgendaDisplayItem[],
  filters?: { query?: string; committee?: string; date?: string },
): AgendaGroup[];
