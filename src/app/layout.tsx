import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "HighRidge Forms",
  description: "Streamlined form management for HighRidge",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={GeistSans.variable}>
        <body className="min-h-screen bg-background font-sans antialiased">
          <main className="relative flex min-h-screen flex-col">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
