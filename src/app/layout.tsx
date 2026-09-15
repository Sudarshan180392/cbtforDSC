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
      <body className="min-h-full flex flex-col bg-gray-100">
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
