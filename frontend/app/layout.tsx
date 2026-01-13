import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SSE Dashboard',
  description: 'Real-time dashboard powered by Server-Sent Events and Redis Pub/Sub.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">{children}</div>
      </body>
    </html>
  );
}
