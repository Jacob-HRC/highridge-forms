import { Button } from "~/components/ui/button";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-950">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
          High<span className="text-sky-500">Ridge</span> Forms
        </h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
          <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 text-white hover:bg-white/20">
            <h3 className="text-2xl font-bold">Streamlined Forms</h3>
            <div className="text-lg">
              Create, manage, and analyze forms with ease. Built for efficiency.
            </div>
          </div>
          <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 text-white hover:bg-white/20">
            <h3 className="text-2xl font-bold">Secure Access</h3>
            <div className="text-lg">
              Enterprise-grade security with role-based access control.
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4">
          <SignUpButton mode="modal">
            <Button variant="default" size="lg" className="gap-2 bg-white/10 hover:bg-sky-500">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
          </SignUpButton>
          <SignInButton mode="modal">
            <Button variant="ghost" size="lg" className="text-white hover:text-white/80">
              Sign In
            </Button>
          </SignInButton>
        </div>
      </div>
    </div>
  );
}
