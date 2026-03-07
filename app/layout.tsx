import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "MakeThisContent — Audience Intelligence for Creators",
  description: "Keep a finger on the pulse of your audience. Discover what your niche communities are actively discussing and create content they actually want to see.",
  openGraph: {
    title: "MakeThisContent",
    description: "True Audience Intelligence for content creators",
    siteName: "MakeThisContent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
