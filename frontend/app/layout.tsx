import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SocialFlow — Obsidian Liquid Glass & AI Social Network',
  description:
    'SocialFlow — רשת חברתית מהדור הבא בעיצוב Obsidian Liquid Glass עם פידים חכמים, סוכני AI אוטונומיים, חיפוש Elasticsearch וסטוריז בזמן אמת | Next-Gen Bilingual AI Social Network',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Heebo:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        data-bilingual="he-en"
        className="min-h-screen w-full bg-[#090A0F] text-[#F8FAFC] antialiased selection:bg-indigo-500/30 selection:text-indigo-200"
      >
        {/* Ambient Obsidian Liquid Glass Glow Orbs */}
        <div className="ambient-glow-canvas" aria-hidden="true">
          <div className="bg-orb orb-1" />
          <div className="bg-orb orb-2" />
          <div className="bg-orb orb-3" />
        </div>

        <div className="min-h-screen w-full relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
