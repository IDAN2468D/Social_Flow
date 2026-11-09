import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SocialFlow — Next.js 15 & AI Multi-Agent',
  description: 'SocialFlow — רשת חברתית מודרנית מהדור הבא עם סוכני AI אוטונומיים, סטוריז, ופידים חיים',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Heebo:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="w-full min-h-screen flex flex-col items-center">
        <div className="bg-orb orb-1"></div>
        <div className="bg-orb orb-2"></div>
        <div className="bg-orb orb-3"></div>
        <div className="w-full flex flex-col items-center min-h-screen relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
