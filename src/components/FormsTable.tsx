'use client';

import Link from 'next/link';
import { Button } from '~/components/ui/button';
import { getForms } from '~/app/serveractions/forms/reimburesementformactions';
import { deleteForm } from '~/app/serveractions/forms/deleteFormAction';
import { useState, useEffect } from 'react';

type Form = {
  id: number;
  submitterEmail: string;
  submitterName: string;
  reimbursedName: string;
  reimbursedEmail: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export default function FormsTable() {
  const [forms, setForms] = useState<Form[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      const formsData = await getForms();
      setForms(formsData);
    } catch (e) {
      console.error('Forms fetch error:', e);
      setError(`Error fetching forms: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (formId: number) => {
    if (!confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await deleteForm(formId);
      if (result.success) {
        loadForms();
      } else {
        setError(result.error || 'Failed to delete form');
      }
    } catch (e) {
      console.error('Delete error:', e);
      setError(`Error deleting form: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  if (forms.length === 0) {
    return <p>{error || "No forms found."}</p>;
  }

  return (
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
              <div className="flex gap-2">
                <Link
                  href={`/forms/${form.id}`}
                  className="text-blue-600 hover:underline"
                >
                  View
                </Link>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(form.id)}
                  className="px-2 py-1 text-xs"
                >
                  Delete
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}