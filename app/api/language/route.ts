import { NextRequest, NextResponse } from 'next/server';
import { LOCALE_COOKIE, safeReturnPath } from '@/features/language/messages.mjs';
export async function POST(request: NextRequest) {
  // Next's standalone server can canonicalize nextUrl to localhost. Use the
  // actual request Host for same-origin checks and redirects on custom domains.
  const requestUrl = new URL(request.url);
  const host = request.headers.get('host');
  if (host) requestUrl.host = host;
  const origin = requestUrl.origin;
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
