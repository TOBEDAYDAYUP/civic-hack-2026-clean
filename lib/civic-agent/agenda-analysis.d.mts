import type { AgendaItem } from './agendas.mjs';
export const AGENDA_ANALYSIS_VERSION: string;
export function agendaKey(item: AgendaItem): string;
export function agendaHash(item: AgendaItem): string;
export type AgendaAnalysis = { shortTitle: string; summary: string };
export function validateAgendaAnalysis(output: unknown, item: AgendaItem): AgendaAnalysis;
export function analyzeAgenda(
  item: AgendaItem,
  options?: { baseUrl?: string; model?: string; fetcher?: typeof fetch },
): Promise<AgendaAnalysis>;

export function currentAgendaAnalysis(
  item: AgendaItem,
  row: { source_hash: string; short_title: string; summary: string } | null | undefined,
): AgendaAnalysis | null;
