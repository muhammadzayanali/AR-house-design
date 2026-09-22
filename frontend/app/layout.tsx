import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";

import { AuthProvider } from "@/components/providers/AuthProvider";
import { SiteHeader } from "@/components/layout/SiteHeader";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plotline — Architectural Planning Assistant",
  description:
    "Measure a plot in AR, get a rule-based house recommendation, and generate an AI-narrated report.",
  applicationName: "Plotline",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#14110e",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-paper text-ink"
        suppressHydrationWarning
      >
        <AuthProvider>
          <SiteHeader />
          <div className="flex flex-1 flex-col">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
