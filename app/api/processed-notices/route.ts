import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const file = path.join(process.cwd(), 'data', 'generated-notices.json');
    const text = await readFile(file, 'utf8');
    const notices = JSON.parse(text || '[]');
    return NextResponse.json({
      ok: true,
      count: Array.isArray(notices) ? notices.length : 0,
      notices: Array.isArray(notices) ? notices : [],
    });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      count: 0,
      notices: [],
      warning: error instanceof Error ? error.message : 'Could not read generated notices',
    });
  }
}
