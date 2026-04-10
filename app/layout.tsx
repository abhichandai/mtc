import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import ThemeProvider from "./components/ThemeProvider";
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

// Inline script runs before React hydrates — prevents flash of wrong theme
const antiFlashScript = `
(function() {
  try {
    var pref = localStorage.getItem('mtc_theme_pref') || 'auto';
    var resolved;
    if (pref === 'light') { resolved = 'light'; }
    else if (pref === 'dark') { resolved = 'dark'; }
    else {
      var h = new Date().getHours();
      resolved = (h >= 20 || h < 7) ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <script dangerouslySetInnerHTML={{ __html: antiFlashScript }} />
        </head>
        <body>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
