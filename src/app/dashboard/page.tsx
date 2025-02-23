// app/dashboard/page.tsx
import { currentUser } from "@clerk/nextjs/server";
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { getForms } from "../serveractions/forms/reimburesementformactions";

type Form = {
  id: number;
  submitterEmail: string;
  submitterName: string;
  reimbursedName: string;
  reimbursedEmail: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export default async function DashboardPage() {
  // 1. Get the currently logged-in user from Clerk
  const user = await currentUser()
  if (!user) {
    // If no user, you could redirect or show an error
    return <SignIn />;
  }

  // 2. Fetch forms using the server action
  let forms: Form[] = [];
  let error: string | null = null;

  try {
    forms = await getForms(); // Call the server action directly
  } catch (e) {
    console.error('Forms fetch error:', e);
    error = `Error fetching forms: ${e instanceof Error ? e.message : 'Unknown error'}`;
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
              <th className="border border-gray-300 p-2">Reimbursed</th>
              <th className="border border-gray-300 p-2">Submitted By</th>
              <th className="border border-gray-300 p-2">Created</th>
              <th className="border border-gray-300 p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((form) => (
              <tr key={form.id}>
                <td className="border border-gray-300 p-2">
                  {form.reimbursedName} ({form.reimbursedEmail})
                </td>
                <td className="border border-gray-300 p-2">
                  {form.submitterName} ({form.submitterEmail})
                </td>
                <td className="border border-gray-300 p-2">
                  {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : 'N/A'}
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
