'use client';
import { useLanguage } from './LanguageProvider';
export default function LanguageSwitcher() {
  const { locale } = useLanguage();
  return (
    <form
      action="/api/language"
      method="post"
      className="language-switcher"
      aria-label={locale === 'fr' ? 'Langue de l’interface' : 'Interface language'}
      onSubmit={(event) => {
        const input = event.currentTarget.elements.namedItem('returnTo') as HTMLInputElement;
        input.value = window.location.pathname + window.location.search + window.location.hash;
      }}
    >
      <input type="hidden" name="returnTo" value="" />
      <button
        type="submit"
        name="locale"
        value="en"
        lang="en"
        aria-label="Use English"
        aria-pressed={locale === 'en'}
      >
        EN<span className="language-full"> · English</span>
      </button>
      <button
        type="submit"
        name="locale"
        value="fr"
        lang="fr"
        aria-label="Utiliser le français"
        aria-pressed={locale === 'fr'}
      >
        FR<span className="language-full"> · Français</span>
      </button>
    </form>
  );
}
