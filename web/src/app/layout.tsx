import type { Metadata } from 'next';
import { Agentation } from 'agentation';
import { AuthProvider } from '@/lib/context/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'افسانه‌ساز (AfsanehSaz) — رمان تعاملی نقش‌آفرینی',
  description: 'رمان تعاملی نقش‌آفرینی و شبیه‌ساز روایت با هوش مصنوعی',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full bg-[#090a0f] text-zinc-100 flex flex-col">
        <AuthProvider>
          {children}
          {process.env.NODE_ENV === 'development' && <Agentation />}
        </AuthProvider>
      </body>
    </html>
  );
}
