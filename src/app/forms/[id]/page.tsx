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
import { Button } from "~/components/ui/button";
import { getFormById } from '~/app/serveractions/forms/reimburesementformactions';
import type { FormValues } from '~/lib/schema';
import FormPdfButton from "~/components/form-pdf-button";
import { deleteReceipt } from "~/app/serveractions/forms/reimburesementformactions";
import { TransactionForm } from "~/components/TransactionForm";



export default function EditFormPage() {
    const params = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const formId = Number(params.id); // Get the form ID from the URL params, assuming it's a number

    const form = useForm<FormValues>();
    const { control, reset } = form;

    const { fields, remove } = useFieldArray({
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



    const handleRemoveTransaction = (index: number) => {
        const tx = fields[index] as FormValues['transactions'][number];
        console.log('Removing transaction:', tx);
        // Check if it's an existing transaction from the database
        const txId = Number(tx.id);
        if (!isNaN(txId) && txId > 0) {  // Make sure it's a valid positive number
            console.log('Adding to deletedTransactions:', txId);
        }
        remove(index);
    };

    async function handleDeleteReceipt(receiptId: number) {
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
                        createdAt: tx.createdAt ?? undefined,
                        updatedAt: tx.updatedAt ?? undefined,
                        accountLine: tx.accountLine,
                        department: tx.department,
                        placeVendor: tx.placeVendor,
                        description: tx.description || "",
                        amount: tx.amount,
                        receipts: tx.receipts?.map(receipt => ({
                            ...receipt,
                            createdAt: receipt.createdAt ?? undefined,
                            updatedAt: receipt.updatedAt ?? undefined,
                        })) ?? [],
                        newFiles: [],
                    })),
                };
                reset({
                    ...refreshedFormData,
                    createdAt: refreshedFormData.createdAt ?? new Date(),
                    updatedAt: refreshedFormData.updatedAt ?? new Date(),
                    transactions: refreshedFormData.transactions.map(tx => ({
                        ...tx,
                        createdAt: tx.createdAt ?? new Date(),
                        updatedAt: tx.updatedAt ?? new Date()
                    }))
                } as FormValues);
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
                                // If you pass transactions as props, ensure each tx.date is a Date object
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