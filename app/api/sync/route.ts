import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fetchTorontoNotices, TorontoNotice } from '@/lib/toronto';
import { simplifyWithOllama } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StoredNotice = Omit<TorontoNotice, 'raw'> & {
  simple: Awaited<ReturnType<typeof simplifyWithOllama>>['result'];
  generatedBy: string;
  generatedAt: string;
};

function comparableDate(value: string | null | undefined) {
  return value || '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const requested = Number((body as { limit?: number }).limit ?? 5);
    const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : 5, 1), 10);

    const all = await fetchTorontoNotices();
    const latest = [...all]
      .sort((a, b) => comparableDate(b.noticeDate).localeCompare(comparableDate(a.noticeDate)))
      .slice(0, limit);

    const dataDir = path.join(process.cwd(), 'data');
    const file = path.join(dataDir, 'generated-notices.json');
    await mkdir(dataDir, { recursive: true });

    let existing: StoredNotice[] = [];
    try {
      const text = await readFile(file, 'utf8');
      const parsed = JSON.parse(text || '[]');
      if (Array.isArray(parsed)) existing = parsed as StoredNotice[];
    } catch {}

    const byId = new Map(existing.map((item) => [item.id, item]));
    let generated = 0;
    let reused = 0;

    for (const notice of latest) {
      const current = byId.get(notice.id);
      if (current && current.title === notice.title && current.description === notice.description && current.decisionBody === notice.decisionBody) {
        reused++;
        continue;
      }

      const { raw, ...source } = notice;
      const ai = await simplifyWithOllama(source);
      byId.set(notice.id, {
        ...source,
        simple: ai.result,
        generatedBy: ai.model,
        generatedAt: new Date().toISOString(),
      });
      generated++;
    }

    const merged = [...byId.values()]
      .sort((a, b) => comparableDate(b.noticeDate).localeCompare(comparableDate(a.noticeDate)))
      .slice(0, 50);

    await writeFile(file, JSON.stringify(merged, null, 2) + '\n', 'utf8');

    return NextResponse.json({
      ok: true,
      source: 'City of Toronto Public Notices Open Data API',
      checked: latest.length,
      generated,
      reused,
      totalStored: merged.length,
      updatedAt: new Date().toISOString(),
      note: 'This local prototype writes generated content to data/generated-notices.json. Production hosting should use durable storage or a scheduled ingestion job.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      ok: false,
      error: message,
      hint: message.toLowerCase().includes('ollama')
        ? 'Make sure Ollama is running locally and qwen3.5:4b is installed.'
        : 'Check the Toronto source and local Ollama service.',
    }, { status: 500 });
  }
}
