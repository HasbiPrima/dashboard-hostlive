import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LiveOps — Agency Management",
  description: "Manajemen jadwal live, absensi host, laporan performa, dan rekap TikTok Shop & Shopee",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
