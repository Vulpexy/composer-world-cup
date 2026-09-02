import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '大师对位 · MusiCup｜古典作曲家世界杯',
  description: '试听、了解并选出你更想继续聆听的古典音乐作曲家。',
  openGraph: {
    title: '大师对位 · MusiCup',
    description: '这一票，交给你的耳朵。试听、了解，再选出你更想继续聆听的作曲家。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '大师对位 · MusiCup' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '大师对位 · MusiCup',
    description: '这一票，交给你的耳朵。',
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
      <body>{children}</body>
    </html>
  );
}

