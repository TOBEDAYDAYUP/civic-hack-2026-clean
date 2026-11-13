/**
 * One shared Ollama pipeline for the protected Next.js API and the admin CLI.
 * A focused, evidence-numbered call checks each record even if the initial
 * summary found an impact. This provides per-proposal specificity. This keeps the local Qwen model and API unchanged.
 */
import {
  simplifiedNoticeSchema,
  impactPrompt,
  validateSimplifiedNotice,
  buildSourceEvidence,
  evidenceRecoverySchema,
  evidenceRecoveryPrompt,
  supportedEvidenceLinkedImpacts,
  sourceGroundedFallbackImpacts,
  filterSupportedImpacts,
} from './impact-analysis.mjs';

export async function analyzeNoticeWithOllama(
  source,
  {
    baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    model = process.env.OLLAMA_MODEL || 'qwen3.5:4b',
    fetchImpl = fetch,
    log = () => {},
    sourceKind = 'official notice',
  } = {},
) {
  const apiUrl = `${baseUrl.replace(/\/$/, '')}/api/chat`;

  async function chat(system, user, schema) {
    const response = await fetchImpl(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: false,
        think: false,
        format: schema,
        options: { temperature: 0.05 },
      }),
    });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload.message?.content) throw new Error('Ollama returned no structured content');
    let parsed;
    try {
      parsed = JSON.parse(payload.message.content);
    } catch {
      throw new Error('Ollama did not return valid JSON');
    }
    return { parsed, responseModel: payload.model || model };
  }

  const primary = await chat(
    sourceKind === 'curated Council summary'
      ? impactPrompt +
          '\nThis input is only a SHORT CURATED SUMMARY, not a full original Council report. Treat its quoted text as secondary summary evidence, not an original City excerpt. Council adopted does not mean built or completed.'
      : impactPrompt,
    `Explain this ${sourceKind}.\n\n${JSON.stringify(source, null, 2)}`,
    simplifiedNoticeSchema,
  );
  const result = validateSimplifiedNotice(primary.parsed, source);
  const diagnostics = {
    originalCandidates: Array.isArray(primary.parsed.impacts) ? primary.parsed.impacts.length : 0,
    primaryVerified: result.impacts.length,
    recovered: 0,
    fallback: false,
  };

  const evidence = buildSourceEvidence(source);
  if (evidence.length) {
    try {
      // The second pass analyzes evidence passages individually. Merge with
      // primary impacts; one verified, specific explanation per category.
      const recovery = await chat(
        evidenceRecoveryPrompt +
          (sourceKind === 'curated Council summary'
            ? '\nThe passages are excerpts from a CURATED summary, not the complete official Council document. Preserve the "Council adopted" status without inventing implementation.'
            : ''),
        `Analyze THIS record, not a generic housing proposal. Cite only the numbered passages.\n\n${JSON.stringify(evidence)}`,
        evidenceRecoverySchema,
      );
      const recovered = supportedEvidenceLinkedImpacts(recovery.parsed?.impacts, evidence);
      diagnostics.recovered = recovered.length;
      // Keep distinct verified categories from both passes. Prefer the most
      // explanatory, record-specific candidate within each supported category.
      const byCategory = new Map(result.impacts.map((impact) => [impact.category, impact]));
      for (const impact of recovered) {
        const existing = byCategory.get(impact.category);
        if (!existing || impact.explanation.length > existing.explanation.length) {
          byCategory.set(impact.category, impact);
        }
      }
      result.impacts = [...byCategory.values()];
      log(`Independent category pass: ${recovered.length} verified categories`);
    } catch (error) {
      log(
        `Independent category pass unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
  // Independently source-grounded candidate categories can complement a
  // narrow Qwen answer, but cannot invent unsupported prices, traffic or jobs.
  // Prefer richer, source-specific AI writing whenever it exists.
  const fallback = sourceGroundedFallbackImpacts(source);
  const byCategory = new Map(result.impacts.map((impact) => [impact.category, impact]));
  let fallbackAdded = 0;
  for (const impact of fallback) {
    if (!byCategory.has(impact.category)) {
      byCategory.set(impact.category, impact);
      fallbackAdded++;
    }
  }
  result.impacts = filterSupportedImpacts([...byCategory.values()], source);
  diagnostics.fallback = fallbackAdded > 0;
  if (fallback.length) log(`Checked ${fallback.length} source-grounded impact category/categories`);

  return { model: primary.responseModel, result, diagnostics };
}
