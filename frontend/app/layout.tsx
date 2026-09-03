import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CriptaLab | Orjuela Heredia',
  description:
    'Laboratorio interactivo para analizar y descifrar criptogramas clásicos César, Afín y Vigenère.',
  metadataBase: new URL('http://www.orjuelaheredia.space'),
  openGraph: {
    title: 'CriptaLab | Orjuela Heredia',
    description: 'Encuentra el patrón. Revela el mensaje.',
    images: ['/og.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CriptaLab | Orjuela Heredia',
    description: 'Encuentra el patrón. Revela el mensaje.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
