'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { translate, type Locale } from './messages.mjs';
const LanguageContext = createContext<Locale>('en');
export function LanguageProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LanguageContext.Provider value={locale}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const locale = useContext(LanguageContext);
  return useMemo(
    () => ({
      locale,
      intlLocale: locale === 'fr' ? 'fr-CA' : 'en-CA',
      t: (message: string | number | null | undefined, values?: Record<string, string | number>) =>
        translate(locale, message, values),
    }),
    [locale],
  );
}
export function SourceLanguageNote() {
  const { locale, t } = useLanguage();
  return locale === 'fr' ? (
    <p className="source-language-note">
      {t(
        'Original content is in English. Interface translation does not alter the official record.',
      )}
    </p>
  ) : null;
}
