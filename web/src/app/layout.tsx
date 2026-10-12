import type { Metadata, Viewport } from 'next';
import { Agentation } from 'agentation';
import { AuthProvider } from '@/lib/context/AuthContext';
import { Toaster } from '@/lib/notify';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#090a0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'افسانه‌ساز (AfsanehSaz) — رمان تعاملی نقش‌آفرینی',
  description: 'رمان تعاملی نقش‌آفرینی و شبیه‌ساز روایت با هوش مصنوعی',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'افسانه‌ساز',
  },
  icons: {
    icon: '/images/app_icon.jpg',
    apple: '/images/app_icon.jpg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className="dark h-full antialiased">
      <body className="min-h-full bg-[#090a0f] text-zinc-100 flex flex-col">
        <AuthProvider>
          {children}
          <Toaster />
          {process.env.NODE_ENV === 'development' && <Agentation />}
        </AuthProvider>
      </body>
    </html>
  );
}
