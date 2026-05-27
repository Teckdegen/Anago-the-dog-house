import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dog House — Protocol Admin",
  description: "DeFi protocol admin: farms, locks, vesting on Monad",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
