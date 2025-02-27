"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Shadcn form components
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "~/lib/utils";

// Sample data for dropdowns
const ACCOUNT_LINES = ["General Fund", "Missions", "Church Plant"];
const DEPARTMENTS = ["Worship", "Youth", "Children", "Admin"];

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
          accountLine: ACCOUNT_LINES[0],
          department: DEPARTMENTS[0],
          placeVendor: "",
          description: "",
          amount: 1,
          receipts: [],
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

  // Update the form submission handler
  async function onSubmit(data: FormValues) {
    console.log('Form submission started');
    try {
      if (!user?.id) {
        throw new Error("User ID is required");
      }

      console.log('Submitting form data:', {
        ...data,
        userId: user.id,
        formType,
        submitterEmail,
        submitterName,
      });

      const result = await addForm({
        form: {
          ...data,
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
                control={form.control}
                name={`transactions.${index}.date`}
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of Transaction</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-[240px] pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>

                    </FormDescription>
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
                name={`transactions.${index}.receipts`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Receipts (up to 2)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        multiple
                        onChange={async (e) => {
                          if (e.target.files?.length) {
                            const files = Array.from(e.target.files);
                            const receipts = await Promise.all(
                              files.map(async (file) => ({
                                name: file.name,
                                fileType: file.type,
                                base64Content: await fileToBase64(file)
                              }))
                            );
                            field.onChange(receipts);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    {field.value && (
                      <p className="text-sm mt-1">
                        {JSON.stringify(field.value)}  {/* TEMPORARY: Display raw field.value */}
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
                id: 0,
                date: new Date(),
                accountLine: ACCOUNT_LINES[0] ?? "",
                department: DEPARTMENTS[0] ?? "",
                placeVendor: "",
                description: "",
                amount: 1,
                receipts: [],
              })
            }
          >
            Add Another Transaction
          </Button>

          <hr className="my-6" />

          <div className="flex justify-between mt-6">
            <Button
              onClick={() => router.push("/dashboard")}
              type="submit"
              className="w-full md:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSubmit(onSubmit)()}
              type="button"
              className="w-full md:w-auto"
            >
              Submit Form
            </Button>
          </div>
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
