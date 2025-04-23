'use client';

import Link from 'next/link';
import { Button } from '~/components/ui/button';
import { getForms } from '~/app/serveractions/forms/reimburesementformactions';
import { deleteForm } from '~/app/serveractions/forms/deleteFormAction';
import { useState, useEffect } from 'react';
import FormPdfButton from '~/components/form-pdf-button';

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
    void loadForms();
  }, []);

  const loadForms = async () => {
    try {
      const formsData = await getForms();
      // Sort forms by updatedAt date in descending order
      const sortedForms = formsData.sort((a, b) => {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      });
      setForms(sortedForms);
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
        void loadForms();
      } else {
        setError(result.error ?? 'Failed to delete form');
      }
    } catch (e) {
      console.error('Delete error:', e);
      setError(`Error deleting form: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  if (forms.length === 0) {
    return <p>{error ?? "No forms found."}</p>;
  }

  return (
    <table className="w-full border-collapse bg-gray-800 text-gray-100">
      <thead className="bg-gray-700">
        <tr>
          <th className="border-b border-gray-600 p-3 text-left font-medium">Reimbursed</th>
          <th className="border-b border-gray-600 p-3 text-left font-medium">Submitted By</th>
          <th className="border-b border-gray-600 p-3 text-left font-medium">Created</th>
          <th className="border-b border-gray-600 p-3 text-left font-medium">Actions</th>
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
                <Button
                  variant="default"
                  size="sm"
                  asChild
                  className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700"
                >
                  <Link href={`/forms/${form.id}`}>View</Link>
                </Button>
                <FormPdfButton formId={form.id} formTitle={`reimbursement-form-${form.id}`} />
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