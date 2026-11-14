import type { Metadata } from 'next';
import { LanguageProvider } from '@/features/language/LanguageProvider';
import { getLanguage } from '@/features/language/server';
import '@/features/language/language.css';
import './globals.css';
import '@/features/decisions/decisions.css';
import '@/features/map/map.css';
import '@/features/notices/notices.css';
import '@/features/navigation/layout.css';

export const metadata: Metadata = {
  title: 'Your City Council — Toronto Edition',
  description: 'Independent civic information prototype for Toronto municipal decisions.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLanguage();
  return (
    <html lang={locale}>
      <body>
        <LanguageProvider locale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
