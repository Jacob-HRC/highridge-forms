"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useForm, useFieldArray } from "react-hook-form";

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
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";

// Sample data for dropdowns
const ACCOUNT_LINES = ["General Fund", "Missions", "Church Plant"];
const DEPARTMENTS = ["Worship", "Youth", "Children", "Admin"];

// Define types for a single transaction and the overall form values
export type Transaction = {
  date: string; // "dd/mm/yyyy"
  accountLine: string;
  department: string;
  placeVendor: string;
  description: string;
  amount: string; // stored as a string; convert to number on submit
  files: FileList | null;
};

export type FormValues = {
  userId: string;
  submitterEmail: string;
  submitterName: string;
  reimbursedName: string;
  reimbursedEmail: string;
  transactions: Transaction[];
};

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
    defaultValues: {
      userId: user?.id,
      submitterEmail: submitterEmail,
      submitterName: submitterName,
      reimbursedName: "",
      reimbursedEmail: "",
      transactions: [
        {
          date: "",
          accountLine: ACCOUNT_LINES[0],
          department: DEPARTMENTS[0],
          placeVendor: "",
          description: "",
          amount: "",
          files: null,
        },
      ],
    },
  });

  const { control, handleSubmit } = form;

  // Use useFieldArray to handle dynamic transactions
  const { fields, append, remove } = useFieldArray({
    control,
    name: "transactions",
  });

  // Form submission handler: convert files to Base64 and submit the form data.
  async function onSubmit(data: FormValues) {
    try {
      const transactionData = await Promise.all(
        data.transactions.map(async (tx) => {
          let receipts: { fileType: string; base64Content: string }[] = [];
          if (tx.files) {
            receipts = await Promise.all(
              Array.from(tx.files)
                .slice(0, 2) // limit to 2 files
                .map(async (file) => {
                  const base64 = await fileToBase64(file);
                  return {
                    fileType: file.type,
                    base64Content: base64,
                  };
                })
            );
          }

          return {
            date: tx.date, // "dd/mm/yyyy" (parse on the server)
            accountLine: tx.accountLine,
            department: tx.department,
            placeVendor: tx.placeVendor,
            description: tx.description,
            amount: parseFloat(tx.amount || "0"),
            receipts,
          };
        })
      );

      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formType,
          userId: user?.id,
          submitterName,
          submitterEmail,
          reimbursedName: data.reimbursedName,
          reimbursedEmail: data.reimbursedEmail,
          transactions: transactionData,
        }),
      });
      console.log(res);
      if (!res.ok) throw new Error("Failed to create form");
      const newForm = await res.json();
      router.push(`/forms/${newForm.id}`);
    } catch (error) {
      console.error("Error creating form:", error);
      alert("There was an error submitting the form.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">
        New {formType} Form
      </h1>
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6"
        >
          {/* Reimbursed Person Fields */}
          <FormField
            control={control}
            name="reimbursedName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reimbursed Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Reimbursed Name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="reimbursedEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reimbursed Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Reimbursed Email"
                    type="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <hr className="my-6" />

          <h2 className="text-xl font-semibold mb-4">
            Transactions
          </h2>
          {fields.map((fieldItem, index) => (
            <div
              key={fieldItem.id}
              className="border rounded p-4 mb-6 space-y-4"
            >
              {/* Date */}
              <FormField
                control={control}
                name={`transactions.${index}.date`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Date (DD/MM/YYYY)
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="DD/MM/YYYY"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Account Line */}
              <FormField
                control={control}
                name={`transactions.${index}.accountLine`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Line</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select account line" />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_LINES.map((acct) => (
                            <SelectItem
                              key={acct}
                              value={acct}
                            >
                              {acct}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Department */}
              <FormField
                control={control}
                name={`transactions.${index}.department`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map((dept) => (
                            <SelectItem
                              key={dept}
                              value={dept}
                            >
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Place/Vendor */}
              <FormField
                control={control}
                name={`transactions.${index}.placeVendor`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Place/Vendor
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Place/Vendor"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Description */}
              <FormField
                control={control}
                name={`transactions.${index}.description`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Description
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Amount */}
              <FormField
                control={control}
                name={`transactions.${index}.amount`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Amount (USD)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Amount"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Receipts (File Input) */}
              <FormField
                control={control}
                name={`transactions.${index}.files`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Receipts (up to 2)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        multiple
                        onChange={(e) =>
                          field.onChange(e.target.files)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                    {field.value &&
                      field.value.length > 0 && (
                        <p className="text-sm mt-1">
                          {Array.from(field.value)
                            .map(
                              (file: File) => file.name
                            )
                            .join(", ")}
                        </p>
                      )}
                  </FormItem>
                )}
              />
              {fields.length > 1 && (
                <Button
                  variant="destructive"
                  onClick={() => remove(index)}
                >
                  Remove Transaction
                </Button>
              )}
            </div>
          ))}

          <Button
            variant="outline"
            onClick={() =>
              append({
                date: "",
                accountLine: ACCOUNT_LINES[0] ?? "",
                department: DEPARTMENTS[0] ?? "",
                placeVendor: "",
                description: "",
                amount: "",
                files: null,
              })
            }
          >
            Add Another Transaction
          </Button>

          <hr className="my-6" />

          <Button type="submit">Submit Form</Button>
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
