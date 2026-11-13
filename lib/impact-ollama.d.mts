import type { StructuredNotice } from './impact-analysis.mjs';

export type ImpactGenerationDiagnostics = {
  originalCandidates: number;
  primaryVerified: number;
  recovered: number;
  fallback: boolean;
};

/** Shared Ollama summarizer with source-linked impact recovery. */
export function analyzeNoticeWithOllama(
  source: unknown,
  options?: {
    baseUrl?: string;
    model?: string;
    fetchImpl?: typeof fetch;
    log?: (message: string) => void;
    sourceKind?: 'official notice' | 'curated Council summary';
  },
): Promise<{
  model: string;
  result: StructuredNotice;
  diagnostics: ImpactGenerationDiagnostics;
}>;
