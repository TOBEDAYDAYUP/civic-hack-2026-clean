export function torontoDate(date?: Date): string;
export type AgendaItem = {
  meetingId: number;
  meetingDate: string;
  committee: string;
  reference: string;
  title: string;
  sourceUrl: string;
};
export function collectAgendas(fetcher?: typeof fetch, now?: Date): Promise<AgendaItem[]>;
