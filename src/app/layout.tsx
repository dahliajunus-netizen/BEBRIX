import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "BEBRIX — Latihan Tantangan Bebras untuk SMP", template: "%s · BEBRIX" },
  description:
    "Platform latihan berpikir komputasional untuk siswa SMP: soal asli Tantangan Bebras Indonesia 2016–2020, modul belajar, simulasi kompetisi, dan analitik kemajuan.",
};

export const viewport: Viewport = { themeColor: "#0b1f3a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AuthProvider>
          <Suspense>{children}</Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
