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
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="container mx-auto p-6">
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-8">
          <h1 className="text-3xl font-bold mb-4 text-gray-100">Dashboard</h1>

          <div className="mb-6 bg-gray-700/50 p-4 rounded-lg">
            <p className="text-lg">
              Welcome, <span className="font-semibold text-blue-400">{user.firstName ?? user.emailAddresses[0]?.emailAddress}</span>!
            </p>
          </div>

          {/* Button to create a new Reimbursement Form */}
          <div className="mb-8">
            <Link
              href="/forms/new?type=REIMBURSEMENT"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors hover:bg-blue-700 shadow-lg hover:shadow-blue-500/25"
            >
              Create New Form
            </Link>
          </div>

          <Suspense fallback={<div className="text-gray-400">Loading forms...</div>}>
            <FormsTable />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
