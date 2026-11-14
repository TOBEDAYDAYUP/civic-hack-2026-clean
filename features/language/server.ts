import 'server-only';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, normalizeLocale, translate } from './messages.mjs';
export async function getLanguage() {
  return normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
export async function getTranslator() {
  const locale = await getLanguage();
  return {
    locale,
    intlLocale: locale === 'fr' ? 'fr-CA' : 'en-CA',
    t: (message: string | number | null | undefined, values?: Record<string, string | number>) =>
      translate(locale, message, values),
  };
}
