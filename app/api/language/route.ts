import { NextRequest, NextResponse } from 'next/server';
import { LOCALE_COOKIE, safeReturnPath } from '@/features/language/messages.mjs';
export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin;
  if (request.headers.get('origin') && request.headers.get('origin') !== origin)
    return new NextResponse('Invalid origin', { status: 403 });
  let data: FormData;
  try {
    data = await request.formData();
  } catch {
    return new NextResponse('Invalid form', { status: 400 });
  }
  const locale = data.get('locale');
  if (locale !== 'en' && locale !== 'fr')
    return new NextResponse('Unsupported language', { status: 400 });
  const submitted = data.get('returnTo');
  const returnTo = safeReturnPath(
    typeof submitted === 'string' && submitted ? submitted : request.headers.get('referer'),
    origin,
  );
  const response = NextResponse.redirect(new URL(returnTo, origin), 303);
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
    sameSite: 'lax',
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
