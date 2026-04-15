import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Provably Fair Plinko",
  description: "A deterministic Plinko game with commit-reveal verification.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
