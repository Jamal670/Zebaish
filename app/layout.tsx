import React from 'react';
import type { Metadata } from 'next';
import "./globals.css";
import { AuthProvider } from "@/components/context/AuthProvider";
import { AppProvider } from "@/components/context/AppContext";
import { MainLayoutShell } from "@/components/MainLayoutShell";

export const metadata: Metadata = {
  title: 'ZEBAISH | Official Luxury Fashion Store',
  description: "Pakistan's Premier Designer Leftover Stock Hub.",
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" sizes="any" />
        <link rel="shortcut icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Allura&family=Great+Vibes&family=Cinzel:wght@400;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-white text-stone-900 antialiased selection:bg-stone-900 selection:text-white">
        <AuthProvider>
          <AppProvider>
            <MainLayoutShell>{children}</MainLayoutShell>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
