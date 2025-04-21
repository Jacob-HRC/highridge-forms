"use client";

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

export default function NewFormPage() {
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

  const { control, handleSubmit } = form;

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

      const result = await addForm({
        form: {
          ...processedData,
          userId: user.id,
          formType,
          submitterEmail,
          submitterName,
        }
      });

      if (result.success) {
        router.push('/dashboard');
      } else {
        throw new Error('Failed to submit form');
      }
    } catch (error) {
      console.error("Detailed submission error:", error);
      alert("There was an error submitting the form.");
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

          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Submit Form</Button>
        </form>
      </Form>
    </div>
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
