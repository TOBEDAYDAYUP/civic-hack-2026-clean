export const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:4b';
export const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');

export const simplifiedNoticeSchema = {
  type: 'object',
  properties: {
    plainTitle: { type: 'string' },
    whatIsHappening: { type: 'string' },
    whyItMatters: { type: 'string' },
    whoMayBeAffected: { type: 'string' },
    where: { type: 'string' },
    decisionStage: { type: 'string' },
    howToParticipate: { type: 'string' },
    participationDeadline: { type: 'string' },
    uncertainty: { type: 'string' },
  },
  required: [
    'plainTitle', 'whatIsHappening', 'whyItMatters', 'whoMayBeAffected',
    'where', 'decisionStage', 'howToParticipate', 'participationDeadline', 'uncertainty',
  ],
} as const;

export type SimplifiedNotice = {
  plainTitle: string;
  whatIsHappening: string;
  whyItMatters: string;
  whoMayBeAffected: string;
  where: string;
  decisionStage: string;
  howToParticipate: string;
  participationDeadline: string;
  uncertainty: string;
};

const systemPrompt = `You rewrite City of Toronto municipal notices for ordinary residents.

Accuracy rules are more important than style:
- Use only facts present in the supplied source record.
- Never invent a deadline, location, impact, decision status, or participation method.
- Preserve uncertainty. If the source does not say something, write "Not specified in the source."
- Distinguish a proposal, staff recommendation, committee decision, and final Council decision. Do not upgrade one stage into another.
- Do not imply that a location mentioned is the entire affected area unless the source says so.
- Keep names, dates, numbers, and addresses exact when they matter.

Readability rules:
- Use plain English suitable for a broad public audience.
- Prefer short sentences and common words.
- Avoid bureaucratic jargon. If a legal/planning term is essential, explain it briefly.
- Keep each field concise (usually 1-3 short sentences).

Return only the JSON object required by the schema.`;

export async function simplifyWithOllama(source: unknown): Promise<{model: string; result: SimplifiedNotice}> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEFAULT_OLLAMA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Rewrite this municipal source record.\n\n${JSON.stringify(source, null, 2)}` },
      ],
      stream: false,
      think: false,
      format: simplifiedNoticeSchema,
      options: { temperature: 0.05 },
    }),
  });

  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
  const data = await response.json() as { message?: { content?: string }; model?: string };
  const content = data.message?.content;
  if (!content) throw new Error('Ollama returned no message content');
  return { model: data.model || DEFAULT_OLLAMA_MODEL, result: JSON.parse(content) as SimplifiedNotice };
}
