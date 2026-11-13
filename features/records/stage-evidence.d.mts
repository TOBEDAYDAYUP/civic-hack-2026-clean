export function stageEvidence(input?: { text?: string; title?: string; sourceUrl?: string }): {
  milestones: {
    status: 'unknown' | 'recorded' | 'latest';
    date: string | null;
    quote: string;
    sourceUrl: string;
  }[];
  latest: number;
  review: boolean;
};
