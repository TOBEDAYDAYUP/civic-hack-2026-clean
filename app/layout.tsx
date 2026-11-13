import type { Metadata } from 'next';
import './globals.css';
import '@/features/map/map.css';
import '@/features/notices/notices.css';
import '@/features/decisions/decisions.css';
import '@/features/navigation/layout.css';

export const metadata: Metadata = {
  title: 'Your City Council — Toronto Edition',
  description: 'Independent civic information prototype for Toronto municipal decisions.'
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
