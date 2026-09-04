import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: '大师对位 · MusiCup｜Classical Composer World Cup',
  description: '试听、了解并选出你的古典作曲家冠军。Listen, compare, and choose your classical composer champion.',
  openGraph: {
    title: '大师对位 · MusiCup',
    description: '这一票，交给你的耳朵。Listen, compare, and choose your classical composer champion.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '大师对位 · MusiCup' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '大师对位 · MusiCup',
    description: 'Listen, compare, and choose your classical composer champion.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}


