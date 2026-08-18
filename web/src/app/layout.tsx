import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StoryForge — Interactive RPG Novel',
  description: 'AI-powered interactive fiction and deterministic RPG engine',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full bg-[#090a0f] text-zinc-100 flex flex-col">{children}</body>
    </html>
  );
}
