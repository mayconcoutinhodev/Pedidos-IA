import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Central de Pedidos",
  description: "Processamento inteligente de pedidos via IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
