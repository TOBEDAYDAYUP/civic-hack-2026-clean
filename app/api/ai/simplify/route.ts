import {authorized} from '@/lib/supabase/admin-auth';
import { NextRequest, NextResponse } from 'next/server';
import { simplifyWithOllama, DEFAULT_OLLAMA_MODEL } from '@/lib/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if(!authorized(request))return NextResponse.json({ok:false,error:'Administrator authentication required'},{status:401});
  try {
    const source = await request.json();
    const { model, result } = await simplifyWithOllama(source);
    return NextResponse.json({ ok: true, model, generatedAt: new Date().toISOString(), result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      ok: false,
      model: DEFAULT_OLLAMA_MODEL,
      error: message,
      hint: 'Start Ollama locally and run: ollama pull qwen3.5:4b',
    }, { status: 503 });
  }
}
