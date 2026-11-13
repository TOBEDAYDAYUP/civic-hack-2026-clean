import { simplifiedNoticeSchema, type StructuredNotice } from './impact-analysis.mjs';
import { analyzeNoticeWithOllama } from './impact-ollama.mjs';

export const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:4b';
export const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(
  /\/$/,
  '',
);
export { simplifiedNoticeSchema };
export type SimplifiedNotice = StructuredNotice;

export async function simplifyWithOllama(
  source: unknown,
): Promise<{ model: string; result: SimplifiedNotice }> {
  const { model, result } = await analyzeNoticeWithOllama(source, {
    model: DEFAULT_OLLAMA_MODEL,
    baseUrl: OLLAMA_BASE_URL,
  });
  return { model, result };
}
