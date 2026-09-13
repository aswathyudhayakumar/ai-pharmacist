import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Pharmacist — Tata 1mg prototype",
  description: "An ambient agentic pharmacist layer prototyped over a Tata 1mg-style pharmacy app.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-card focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
