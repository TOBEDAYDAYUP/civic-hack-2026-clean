export type Locale = 'en' | 'fr';
export const french: Readonly<Record<string, string>>;
export const LOCALE_COOKIE: string;
export function normalizeLocale(value: unknown): Locale;
export function translate(
  locale: Locale,
  message: string | number | null | undefined,
  values?: Record<string, string | number>,
): string;
export function safeReturnPath(value: string | null | undefined, origin: string): string;
