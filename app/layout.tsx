// Root layout — this file wraps EVERY page in the app/ directory.
// In the Next.js App Router, layout.tsx defines the shared HTML shell
// (the <html> and <body> tags, fonts, global styles). It is a Server
// Component by default, so it renders on the server before reaching the browser.
import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Metadata is read by Next.js to fill the <head> (browser tab title, SEO).
export const metadata: Metadata = {
  title: "Finra — Hub Financeiro Pessoal",
  description: "Controle de orçamento doméstico, investimentos e metas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Shared top navigation. `next/link` does client-side navigation
            between routes without a full page reload. */}
        <nav className="border-b border-gray-800 bg-gray-900">
          <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
            <Link href="/" className="font-bold tracking-tight">
              Finra
            </Link>
            <Link
              href="/transactions"
              className="text-sm text-gray-300 hover:text-white"
            >
              Transações
            </Link>
            <Link
              href="/metas"
              className="text-sm text-gray-300 hover:text-white"
            >
              Metas
            </Link>
            <Link
              href="/settings"
              className="text-sm text-gray-300 hover:text-white"
            >
              Configurações
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
