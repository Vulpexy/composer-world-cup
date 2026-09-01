import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '古典音乐作曲家世界杯｜对战卡片原型',
  description: '试听、了解并选出你更想继续聆听的古典音乐作曲家。',
  openGraph: {
    title: '古典音乐作曲家世界杯',
    description: '这一票，交给你的耳朵。试听、了解，再选出你更想继续聆听的作曲家。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '古典音乐作曲家世界杯' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '古典音乐作曲家世界杯',
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
