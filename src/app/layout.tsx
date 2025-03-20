import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export const metadata: Metadata = {
  title: "HighRidge Forms",
  description: "Streamlined form management for HighRidge",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

function Header() {
  return (
    <header className="flex justify-between items-center p-4 bg-gray-800/95 text-white border-b border-gray-700">
      <SignedIn>
        <Link href="/dashboard">
          <h1 className="text-2xl font-bold cursor-pointer">HighRidge Forms</h1>
        </Link>
      </SignedIn>
      <SignedOut>
        <Link href="/">
          <h1 className="text-2xl font-bold cursor-pointer">HighRidge Forms</h1>
        </Link>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal" />
      </SignedOut>
    </header>
  )
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={GeistSans.variable}>
        <body className="min-h-screen bg-gray-900 font-sans antialiased text-white">
          <Header />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
