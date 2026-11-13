export type ImpactCategory =
  | 'Housing & Affordability'
  | 'Daily Life & Transportation'
  | 'Economy & Financial Impact'
  | 'Environment & Public Space'
  | 'Community & Public Services'
  | 'Other Impacts';

export type ImpactItem = {
  category: ImpactCategory;
  explanation: string;
  certainty: 'confirmed' | 'potential';
  sourceExcerpt: string;
};
export type StructuredNotice = {
  plainTitle: string;
  whatIsHappening: string;
  keyPoints: string[];
  whyItMatters: string;
  impacts: ImpactItem[];
  whoMayBeAffected: string;
  where: string;
  decisionStage: string;
  howToParticipate: string;
  participationDeadline: string;
  uncertainty: string;
};

export const IMPACT_CATEGORIES: ImpactCategory[];
export const IMPACT_ANALYSIS_VERSION: 'impact-v5';
export const simplifiedNoticeSchema: Record<string, unknown>;
export const impactPrompt: string;
export function filterSupportedImpacts(items: unknown, source: unknown): ImpactItem[];
export type NoticeImpactPresentation = {
  impacts: ImpactItem[];
  fromSavedAnalysis: boolean;
};
export function noticeImpactPresentation(notice: unknown): NoticeImpactPresentation;
export function validateSimplifiedNotice(output: unknown, source: unknown): StructuredNotice;

export type EvidenceSnippet = { id: string; text: string };
export const evidenceRecoverySchema: Record<string, unknown>;
export const evidenceRecoveryPrompt: string;
export function buildSourceEvidence(source: unknown): EvidenceSnippet[];
export function supportedEvidenceLinkedImpacts(
  items: unknown,
  evidence: EvidenceSnippet[],
): ImpactItem[];
export function sourceGroundedFallbackImpacts(source: unknown): ImpactItem[];
