"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Shadcn form components
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { TransactionForm } from "~/components/TransactionForm";
import { ACCOUNT_LINES, DEPARTMENTS } from "~/lib/constants";


import { reimbursementFormSchema, type FormValues } from "~/lib/schema";

// Add import for the server action
import { addForm } from "~/app/serveractions/forms/reimburesementformactions";

// Form content component that uses useSearchParams
function FormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();

  // Determine form type; if not "REIMBURSEMENT", you might want to handle gracefully.
  const formType: string = searchParams.get("type") ?? "REIMBURSEMENT";

  // Clerk user info for submitter
  const submitterEmail =
    user?.emailAddresses?.[0]?.emailAddress ?? "";
  const submitterName =
    user?.fullName ?? user?.username ?? "";

  // Initialize react-hook-form with default values.
  const form = useForm<FormValues>({
    resolver: zodResolver(reimbursementFormSchema),
    defaultValues: {
      id: undefined, // ID is now optional in the schema
      userId: user?.id,
      formType,
      submitterEmail: submitterEmail,
      submitterName: submitterName,
      reimbursedName: "",
      reimbursedEmail: "",
      transactions: [
        {
          date: new Date(),
          accountLine: ACCOUNT_LINES[0] ?? "",
          department: DEPARTMENTS[0] ?? "",
          placeVendor: "",
          createdAt: new Date(),
          updatedAt: new Date(),
          description: "",
          amount: 1,
          receipts: [],
          newFiles: []
        }
      ]
    },
  });

  const { control, handleSubmit, formState: { isSubmitting } } = form;

  // Update the form submission handler
  async function onSubmit(data: FormValues) {
    console.log('Form submission started');
    try {
      if (!user?.id) {
        throw new Error("User ID is required");
      }

      // Process file uploads and convert to base64
      const processedData = {
        ...data,
        // Remove any id field - the server will generate it
        id: undefined,
        // Ensure userId is properly set
        userId: user.id,
        formType,
        submitterEmail,
        submitterName,
        transactions: await Promise.all(
          data.transactions.map(async (tx) => {
            // Add proper type checking before accessing .length
            if (!tx.newFiles || !Array.isArray(tx.newFiles) || tx.newFiles.length === 0) return tx;

            const base64Files = await Promise.all(
              Array.from(tx.newFiles as unknown as FileList).map(async (file, index) => ({
                // Add a temporary negative ID for new receipts
                id: -(Date.now() + index), // Use negative IDs to indicate these are new receipts
                name: file.name,
                fileType: file.type,
                base64Content: await fileToBase64(file),
                createdAt: new Date(),
                updatedAt: new Date()
              }))
            );

            return {
              ...tx,
              receipts: [...(tx.receipts ?? []), ...base64Files]
            };
          })
        )
      };

      console.log('Submitting form data with processed files');

      try {
        const result = await addForm({
          form: processedData as FormValues
        });

        if (result.success) {
          router.push('/dashboard');
        } else {
          throw new Error(result.error ?? 'Failed to submit form');
        }
      } catch (submitError) {
        console.error("Form submission failed:", submitError);
        alert(`Form submission failed: ${submitError instanceof Error ? submitError.message : 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Form preparation error:", error);
      alert(`Error preparing form data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-gray-800 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-4 text-gray-100">
        New {formType.charAt(0).toUpperCase() + formType.slice(1).toLowerCase()} Form
      </h1>
      <Form {...form}>
        <form
          onSubmit={(e) => {
            void handleSubmit(onSubmit)(e).catch(error => {
              console.error("Form submission error:", error);
              alert("There was an error submitting the form.");
            });
          }}
          className="space-y-6"
        >
          {/* Reimbursed Person Fields */}
          <FormField
            control={control}
            name="reimbursedName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-100">Reimbursed Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Reimbursed Name"
                    className="bg-gray-700 border-gray-600 text-gray-100 hover:border-gray-500 focus:border-gray-400"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-400" />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="reimbursedEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-100">Reimbursed Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Reimbursed Email"
                    type="email"
                    className="bg-gray-700 border-gray-600 text-gray-100 hover:border-gray-500 focus:border-gray-400"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-red-400" />
              </FormItem>
            )}
          />

          <hr className="border-gray-600" />

          <TransactionForm form={form} />

          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </>
            ) : (
              'Submit Form'
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}

// Main page component that wraps the form content with Suspense
export default function NewFormPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto p-6 bg-gray-800 rounded-lg shadow-lg text-gray-100">Loading form...</div>}>
      <FormContent />
    </Suspense>
  );
}

// Helper function: Convert File to a base64 string.
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
