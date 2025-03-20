// app/dashboard/page.tsx
"use client";
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { useUser } from "@clerk/nextjs";
import FormsTable from "~/components/FormsTable";

export default function DashboardPage() {
  const { user } = useUser();

  if (!user) {
    return <SignIn />;
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

      <div className="mb-4">
        <p>
          Welcome, <span className="font-semibold">{user.firstName ?? user.emailAddresses[0]?.emailAddress}</span>!
        </p>
      </div>

      {/* Button to create a new Reimbursement Form */}
      <div className="mb-6">
        <Link
          href="/forms/new?type=REIMBURSEMENT"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create New Form
        </Link>
      </div>

      <Suspense fallback={<div>Loading forms...</div>}>
        <FormsTable />
      </Suspense>
    </div>
  );
}
