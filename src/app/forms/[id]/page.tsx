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
import Receipts from "~/components/Receipts";
import { TransactionForm } from "~/components/TransactionForm";
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
                    // Sort transactions by createdAt (oldest to newest)
                    const sortedTransactions = [...fetchedData.transactions].sort((a, b) => {
                        const createdAtA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const createdAtB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return createdAtA - createdAtB;
                    });
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
                            ...tx,
                            createdAt: tx.createdAt ? new Date(tx.createdAt) : new Date(),
                            updatedAt: tx.updatedAt ? new Date(tx.updatedAt) : new Date(),
                            receipts: tx.receipts?.map(receipt => ({
                                id: receipt.id,
                                createdAt: receipt.createdAt ? new Date(receipt.createdAt) : new Date(),
                                updatedAt: receipt.updatedAt ? new Date(receipt.updatedAt) : new Date(),
                                name: receipt.name,
                                fileType: receipt.fileType,
                                base64Content: receipt.base64Content
                            })) || [],
                            id: tx.transactionId,
                            date: tx.date ? new Date(tx.date) : new Date(),
// Removed duplicate createdAt property since it was already set above
                            accountLine: tx.accountLine,
                            department: tx.department,
                            placeVendor: tx.placeVendor,
                            description: tx.description || "",
                            amount: tx.amount,
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
                                base64Content: await fileToBase64(file),
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
        <div className="min-h-screen bg-gray-900 text-gray-100">
            <div className="container mx-auto p-6">
                <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-8">
                    {loading ? (
                        <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                        </div>
                    ) : error ? (
                        <div className="text-red-400 p-4 bg-red-900/20 rounded-lg border border-red-700">{error}</div>
                    ) : (
                        <Form {...form}>
                            <div className="space-y-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h1 className="text-2xl font-bold text-gray-100">View Form</h1>
                                    <div className="flex gap-4">
                                        <FormPdfButton formId={formId} />
                                        <Button
                                            type="button"
                                            onClick={() => setIsEditing(!isEditing)}
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            {isEditing ? "Cancel Edit" : "Edit Form"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                    {/* Prevent default form submission behavior by adding onSubmit that just prevents default */}
                    <form id="form" onSubmit={(e) => e.preventDefault()} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                          <FormField
                            control={control}
                            name="reimbursedName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-gray-100">Reimbursed Name</FormLabel>
                                <FormControl>
                                  <Input
                                    className="bg-gray-700 border-gray-600 text-gray-100 hover:border-gray-500 focus:border-gray-400"
                                    {...field}
                                    disabled={!isEditing}
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
                                    className="bg-gray-700 border-gray-600 text-gray-100 hover:border-gray-500 focus:border-gray-400"
                                    type="email"
                                    {...field}
                                    disabled={!isEditing}
                                  />
                                </FormControl>
                                <FormMessage className="text-red-400" />
                              </FormItem>
                            )}
                          />
                        </div>
                        <hr className="my-6" />
                        
                        <TransactionForm
                            form={form}
                            isEditing={isEditing}
                            onRemoveTransaction={handleRemoveTransaction}
                            onDeleteReceipt={handleDeleteReceipt}
                        />
                        <div className="flex justify-between mt-6">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.push('/dashboard')}
                            >
                                Back to Dashboard
                            </Button>
                            {isEditing && (
                                <div className="mt-8 border-t border-gray-700 pt-6">
                                <Button
                                  type="submit"
                                  className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto"
                                >
                                  Save Changes
                                </Button>
                                </div>
                            )}
                        </div>
                    </form>
                </Form>)}
            </div>
            </div>
        </div>
    );
}