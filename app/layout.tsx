import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MakeThisContent — Trends Intelligence for Creators",
  description: "See what your audience is talking about right now. Enter your niche, get 10 live trending topics with real Twitter conversations.",
  openGraph: {
    title: "MakeThisContent",
    description: "Real-time trend intelligence for content creators",
    siteName: "MakeThisContent",
  },
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
