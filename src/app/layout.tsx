import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "HighRidge Forms",
  description: "Streamlined form management for HighRidge",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

function Header() {
  return (
    <header className="flex justify-between items-center p-4 bg-zinc-800 text-white">
      <h1 className="text-2xl font-bold">HighRidge Forms</h1>
      <SignedIn>
        {/* Mount the UserButton component */}
        <UserButton />
      </SignedIn>
      <SignedOut>
        {/* Signed out users get sign in button */}
        <SignInButton mode="modal"/>
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
        <body className="min-h-screen bg-background font-sans antialiased">
          <Header />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
