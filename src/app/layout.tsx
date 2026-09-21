import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "CBT Exam System",
  description: "CBT Examination System",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Gurmukhi:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-gray-100 font-sans">
        <div className="bg-gray-900 text-white text-center py-1 text-xs font-bold tracking-widest z-50">
          Designed &amp; developed by Sudarshan Mishra.
        </div>
        <main className="flex-1 flex flex-col min-h-0">
          <Providers>{children}</Providers>
        </main>
        <div className="bg-gray-900 text-white text-center py-1 text-xs font-bold tracking-widest z-50">
          Designed &amp; developed by Sudarshan Mishra.
        </div>
      </body>
    </html>
  );
}
