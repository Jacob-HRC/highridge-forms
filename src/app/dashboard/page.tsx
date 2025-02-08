// app/dashboard/page.tsx
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";

type Form = {
  id: number;
  submitterEmail: string;
  submitterName: string;
  reimbursedName: string;
  reimbursedEmail: string;
  createdAt: string;
  updatedAt: string;
};

export default async function DashboardPage() {
  // 1. Get the currently logged-in user from Clerk
  const user = await currentUser()
  if (!user) {
    // If no user, you could redirect or show an error
    return <div className="p-4">Please sign in to view the dashboard.</div>;
  }

  // 2. Fetch forms from our REST endpoint
  let forms: Form[] = [];
  let error: string | null = null;

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/forms`, {
      method: "GET",
      cache: "no-cache",
    });

    if (!res.ok) {
      error = "Error fetching forms.";
    } else {
      forms = await res.json();
    }
  } catch (e) {
    error = "Error fetching forms.";
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

      {/* Display the list of forms in a table */}
      {forms.length === 0 ? (
        <p>{error || "No forms found."}</p>
      ) : (
        <table className="w-full border-collapse border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-300 p-2">ID</th>
              <th className="border border-gray-300 p-2">Reimbursed Name</th>
              <th className="border border-gray-300 p-2">Reimbursed Email</th>
              <th className="border border-gray-300 p-2">Submitter</th>
              <th className="border border-gray-300 p-2">Created</th>
              <th className="border border-gray-300 p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => (
              <tr key={form.id}>
                <td className="border border-gray-300 p-2">{form.id}</td>
                <td className="border border-gray-300 p-2">{form.reimbursedName}</td>
                <td className="border border-gray-300 p-2">{form.reimbursedEmail}</td>
                <td className="border border-gray-300 p-2">
                  {form.submitterName} ({form.submitterEmail})
                </td>
                <td className="border border-gray-300 p-2">
                  {new Date(form.createdAt).toLocaleDateString()}
                </td>
                <td className="border border-gray-300 p-2">
                  {/* Link to edit/view this form */}
                  <Link
                    href={`/forms/${form.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
