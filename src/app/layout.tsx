import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoDev — Where code meets clout",
  description: "The developer community where your side projects actually matter.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
