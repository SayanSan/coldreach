import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ColdReach — Cold Outreach Campaign Platform",
  description: "Send targeted cold outreach campaigns, track replies, and convert leads with AI-powered email automation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>" />
      </head>
      <body>{children}</body>
    </html>
  );
}
