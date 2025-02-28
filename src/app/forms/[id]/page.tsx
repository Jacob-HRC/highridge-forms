// src/app/forms/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { getFormById } from '~/app/serveractions/forms/reimburesementformactions';
import { FormValues, reimbursementFormSchema } from '~/lib/schema';
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "~/lib/utils";
import { CalendarIcon, File } from "lucide-react";
import { FormDescription } from "~/components/ui/form";
import { updateFormWithFiles } from "~/app/serveractions/forms/reimburesementformactions";
import FormPdfButton from "~/components/form-pdf-button";
import { deleteReceipt } from "~/app/serveractions/forms/reimburesementformactions";
// Reuse the constants from the new form page
const ACCOUNT_LINES = ["General Fund", "Missions", "Church Plant"];
const DEPARTMENTS = ["Worship", "Youth", "Children", "Admin"];

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


export default function EditFormPage() {
    const params = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [deletedTransactions, setDeletedTransactions] = useState<number[]>([]);
    const formId = Number(params.id); // Get the form ID from the URL params, assuming it's a number
    const [formData, setFormData] = useState<FormValues | null>(null);

    const form = useForm<FormValues>();
    const { control, reset, handleSubmit } = form;

    const { fields, append, remove } = useFieldArray({
        control,
        name: "transactions",
    });

    useEffect(() => {
        async function loadForm() {
            setLoading(true);
            setError(null);

            if (!formId) { // Move the formId check inside loadForm
                setError("Invalid form ID in URL.");
                setLoading(false);
                return; // Early return if formId is invalid
            }

            try {
                const fetchedData = await getFormById(formId);
                if (fetchedData) {
                    const initialFormData: FormValues = {
                        id: fetchedData.form.id,
                        userId: fetchedData.form.userId,
                        formType: fetchedData.form.formType,
                        submitterEmail: fetchedData.form.submitterEmail,
                        submitterName: fetchedData.form.submitterName,
                        reimbursedName: fetchedData.form.reimbursedName,
                        reimbursedEmail: fetchedData.form.reimbursedEmail,
                        createdAt: fetchedData.form.createdAt ? new Date(fetchedData.form.createdAt) : new Date(),
                        updatedAt: fetchedData.form.updatedAt ? new Date(fetchedData.form.updatedAt) : new Date(),
                        transactions: fetchedData.transactions.map(tx => ({
                            id: tx.transactionId,
                            date: tx.date ? new Date(tx.date) : new Date(),
                            accountLine: tx.accountLine,
                            department: tx.department,
                            placeVendor: tx.placeVendor,
                            description: tx.description || "",
                            amount: tx.amount,
                            receipts: tx.receipts || [],
                            newFiles: [],
                        })),
                    };
                    setFormData(initialFormData);
                    reset(initialFormData);
                } else {
                    setError(`Form with ID ${formId} not found.`);
                }
            } catch (e) {
                console.error('Error fetching form:', e);
                setError(`Error loading form: ${e instanceof Error ? e.message : 'Unknown error'}`);
            } finally {
                setLoading(false);
            }
        }

        loadForm(); // Always call loadForm unconditionally inside useEffect

    }, [formId, reset]); // Dependency array remains the same

    useEffect(() => {
        if (!isEditing) {
            setDeletedTransactions([]);
        }
    }, [isEditing]);

    const handleRemoveTransaction = (index: number) => {
        const tx = fields[index] as FormValues['transactions'][number];
        console.log('Removing transaction:', tx);
        // Check if it's an existing transaction from the database
        const txId = Number(tx.id);
        if (!isNaN(txId) && txId > 0) {  // Make sure it's a valid positive number
            console.log('Adding to deletedTransactions:', txId);
            setDeletedTransactions(prev => [...prev, txId]);
        }
        remove(index);
    };

    async function onSubmit(data: FormValues) {
        // Add debug log to track when onSubmit is called
        console.log("onSubmit called - form submission initiated");

        try {
            // Only proceed with submission if actually in edit mode
            if (!isEditing) {
                console.log("Form submission attempted while not in edit mode - ignoring");
                return;
            }

            console.log("Processing form submission data...");

            const formDataWithBase64 = {
                ...data,
                deletedTransactionIds: [...deletedTransactions],
                transactions: await Promise.all(
                    data.transactions.map(async (tx) => {
                        if (!tx.newFiles?.length) return tx;

                        const base64Files = await Promise.all(
                            Array.from(tx.newFiles as FileList).map(async (file: File) => ({
                                name: file.name,
                                type: file.type,
                                base64Content: await fileToBase64(file)
                            }))
                        );

                        return {
                            ...tx,
                            newFiles: base64Files
                        };
                    })
                )
            };

            console.log('Final form data for server action:', formDataWithBase64);

            const result = await updateFormWithFiles({ // Call the server action
                id: formId,
                form: formDataWithBase64,
            });

            if (result.success) {
                console.log("Form updated successfully");
                setDeletedTransactions([]);
                setIsEditing(false);
                reset({
                    ...result.form,
                    transactions: result.transactions,
                });
            } else {
                throw new Error(result.error || 'Failed to update form');
            }


        } catch (e: any) { // Type 'e' as 'any' or 'Error'
            console.error('Error updating form:', e);
            alert(`Failed to update form: ${e.message}`); // Display error message to user
        }
    }

    async function handleDeleteReceipt(transactionId: number, receiptId: number) {
        try {
            // Show confirmation dialog
            if (!confirm("Are you sure you want to delete this receipt?")) {
                return; // User cancelled the deletion
            }

            // Call the server action directly
            const result = await deleteReceipt({
                formId: formId, // Use the formId from the page parameters
                receiptId: receiptId
            });

            if (!result.success) {
                throw new Error(result.error || 'Failed to delete receipt');
            }

            // Refresh the form data to show the updated state
            const updatedFormData = await getFormById(formId);
            if (updatedFormData) {
                const refreshedFormData = {
                    ...updatedFormData.form,
                    transactions: updatedFormData.transactions.map(tx => ({
                        id: tx.transactionId,
                        date: tx.date ? new Date(tx.date) : new Date(),
                        accountLine: tx.accountLine,
                        department: tx.department,
                        placeVendor: tx.placeVendor,
                        description: tx.description || "",
                        amount: tx.amount,
                        receipts: tx.receipts || [],
                        newFiles: [],
                    })),
                };
                reset(refreshedFormData);
            }

            // Show success message
            alert('Receipt deleted successfully');
        } catch (e) {
            console.error('Error deleting receipt:', e);
            alert(`Failed to delete receipt: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    }

    if (loading) return <div className="p-6">Loading...</div>;
    if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

    return (
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">
                    {isEditing ? 'Edit Form' : 'View Form'}
                </h1>
                <div className="space-x-2">
                    {isEditing ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsEditing(false);
                                    // Reset form to original data
                                    if (formData) {
                                        reset(formData);
                                    }
                                }}
                            >
                                Cancel
                            </Button>
                            {/* Important: Use type="button" and call handleSubmit with onSubmit manually */}
                            <Button
                                type="button"
                                onClick={() => handleSubmit(onSubmit)()}
                            >
                                Save Changes
                            </Button>
                        </>
                    ) : (
                        <>
                            <FormPdfButton formId={formId} formTitle={`Reimbursement-${formId}`} />
                            <Button className="mt-4" type="button" onClick={() => setIsEditing(true)}>
                                Edit Form
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <Form {...form}>
                {/* Prevent default form submission behavior by adding onSubmit that just prevents default */}
                <form id="form" onSubmit={(e) => e.preventDefault()} className="space-y-6">
                    <FormField
                        control={control}
                        name="reimbursedName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reimbursed Name</FormLabel>
                                <FormControl>
                                    <Input {...field} readOnly={!isEditing} />
                                </FormControl>
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
                                    <Input {...field} type="email" readOnly={!isEditing} />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <hr className="my-6" />

                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Transactions</h2>
                        {isEditing && (
                            <Button
                                type="button"
                                onClick={() => {
                                    append({
                                        date: new Date(),
                                        accountLine: ACCOUNT_LINES[0]!,
                                        department: DEPARTMENTS[0]!,
                                        placeVendor: '',
                                        description: '',
                                        amount: 0,
                                        receipts: [],
                                    })
                                }}
                            >
                                Add Transaction
                            </Button>
                        )}
                    </div>

                    {fields.map((field, index) => (
                        <div key={field.id} className="border rounded p-4 mb-6 space-y-4">

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

                            <FormField
                                control={control}
                                name={`transactions.${index}.accountLine`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Account Line</FormLabel>
                                        <FormControl>
                                            {isEditing ? (
                                                <Select
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {ACCOUNT_LINES.map((line) => (
                                                            <SelectItem key={line} value={line}>
                                                                {line}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Input {...field} readOnly />
                                            )}
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name={`transactions.${index}.department`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Department</FormLabel>
                                        <FormControl>
                                            <Input {...field} readOnly={!isEditing} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name={`transactions.${index}.placeVendor`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Place/Vendor</FormLabel>
                                        <FormControl>
                                            <Input {...field} readOnly={!isEditing} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name={`transactions.${index}.description`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} readOnly={!isEditing} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name={`transactions.${index}.amount`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount (USD)</FormLabel>
                                        <FormControl>
                                            <Input {...field} type="number" readOnly={!isEditing} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <div className="mt-4">
                                <FormLabel>Receipts</FormLabel>
                                <div className="flex flex-wrap gap-4 justify-center">
                                    {field.receipts?.map((receipt) => (
                                        <div key={receipt.id} className="flex flex-col items-center border p-2 rounded">
                                            <File className="h-12 w-12 text-gray-500" />
                                            <span className="mt-2 text-sm text-center break-all">{receipt.name}</span>
                                            {isEditing && (
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="sm"
                                                    className="mt-2"
                                                    onClick={() => handleDeleteReceipt(
                                                        // Make sure we're using the correct transaction ID
                                                        form.getValues(`transactions.${index}.id`) as number,
                                                        receipt.id ?? 0
                                                    )}
                                                >
                                                    Delete Receipt
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    {isEditing && (
                                        <FormField
                                            control={control}
                                            name={`transactions.${index}.newFiles`}
                                            render={({ field: fileField }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input
                                                            type="file"
                                                            multiple
                                                            accept="image/*,.pdf"
                                                            onChange={(e) => {
                                                                fileField.onChange(e.target.files);
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>
                            </div>

                            {isEditing && (
                                <div className="flex justify-end mt-4 pt-4 border-t">
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleRemoveTransaction(index)}
                                    >
                                        Delete Transaction
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                    <div className="flex justify-between mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push('/dashboard')}
                        >
                            Back to Dashboard
                        </Button>
                        {isEditing && (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        append({
                                            date: new Date(),
                                            accountLine: ACCOUNT_LINES[0]!,
                                            department: DEPARTMENTS[0]!,
                                            placeVendor: '',
                                            description: '',
                                            amount: 0,
                                            receipts: [],
                                            newFiles: [],
                                        })
                                    }}
                                >
                                    Add Transaction
                                </Button>
                                {/* Changed to type="button" and using handleSubmit directly */}
                                <Button
                                    type="button"
                                    onClick={() => handleSubmit(onSubmit)()}
                                >
                                    Save Changes
                                </Button>
                            </>
                        )}
                    </div>
                </form>
            </Form>
        </div>
    );
}