import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Greek ERP Starter",
  description: "Multi-tenant ERP and invoicing starter for Greek businesses"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
