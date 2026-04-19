import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";

import "@/app/globals.css";
import { IntegrationProvider } from "@/context/IntegrationContext";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope"
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "Broly Analytics Agent",
  description: "A Next.js POC for connecting Google Analytics 4 to a chat-first analytics experience.",
  icons: {
    icon: "/broly.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${inter.variable}`} suppressHydrationWarning>
        <IntegrationProvider>{children}</IntegrationProvider>
      </body>
    </html>
  );
}
