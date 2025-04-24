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
import { Skeleton } from "~/components/ui/skeleton";

export default function EditFormPage() {
    const params = useParams();
    const router = useRouter();
    const [formMetaLoading, setFormMetaLoading] = useState(true);
    const [receiptsLoading, setReceiptsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const formId = Number(params.id); // Get the form ID from the URL params, assuming it's a number

    const form = useForm<FormValues>();
    const { control, reset } = form;

    const { fields, remove } = useFieldArray({
        control,
        name: "transactions",
    });

    // Step 1: First load just the form data and transactions without receipts (faster)
    useEffect(() => {
        async function loadFormMetadata() {
            setFormMetaLoading(true);
            setError(null);

            if (!formId) {
                setError("Invalid form ID in URL.");
                setFormMetaLoading(false);
                return;
            }

            try {
                console.log("Loading form metadata for ID:", formId);
                // Load form with transactions but skip loading receipts for initial render
                const fetchedData = await getFormById(formId, true);
                if (fetchedData) {
                    console.log("Received form data:", {
                        formId: fetchedData.form.id,
                        transactionCount: fetchedData.transactions.length
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
                        transactions: fetchedData.transactions.map(tx => {
                            // Ensure date is properly converted to Date object
                            let txDate;
                            try {
                                txDate = tx.date ? new Date(tx.date) : new Date();
                            } catch (dateError) {
                                console.error('Error parsing date:', tx.date, dateError);
                                txDate = new Date();
                            }
                            
                            return {
                                ...tx,
                                createdAt: tx.createdAt ? new Date(tx.createdAt) : new Date(),
                                updatedAt: tx.updatedAt ? new Date(tx.updatedAt) : new Date(),
                                receipts: [], // Empty array as we don't have receipts yet
                                id: tx.transactionId,
                                date: txDate,
                                accountLine: tx.accountLine,
                                department: tx.department,
                                placeVendor: tx.placeVendor,
                                description: tx.description || "",
                                amount: tx.amount,
                                newFiles: [],
                            };
                        }),
                    };
                    
                    console.log("Resetting form with initial data");
                    reset(initialFormData);
                } else {
                    setError(`Form with ID ${formId} not found.`);
                }
            } catch (e) {
                console.error('Error fetching form metadata:', e);
                setError(`Error loading form: ${e instanceof Error ? e.message : 'Unknown error'}`);
            } finally {
                setFormMetaLoading(false);
            }
        }

        void loadFormMetadata();
    }, [formId, reset]);

    // Step 2: After initial form data loads, fetch receipts in a separate request
    useEffect(() => {
        async function loadReceipts() {
            if (formMetaLoading || error) return; // Skip if we're still loading form data or if there was an error
            
            setReceiptsLoading(true);
            console.log('Loading receipts for form:', formId);
            
            try {
                // Now load the complete form data with receipts
                const fullFormData = await getFormById(formId, false);
                if (fullFormData) {
                    console.log('Received form data with receipts:', 
                        fullFormData.transactions.map(tx => ({
                            txId: tx.transactionId,
                            receiptCount: tx.receipts?.length || 0
                        }))
                    );
                    
                    // Update only the receipts in the form
                    const currentValues = form.getValues();
                    const transactionsWithReceipts = currentValues.transactions.map((tx) => {
                        // Find the matching transaction from the full data
                        const matchingTx = fullFormData.transactions.find(t => t.transactionId === tx.id);
                        if (matchingTx?.receipts?.length > 0) {
                            console.log(`Found ${matchingTx.receipts.length} receipts for transaction ${tx.id}`);
                            return {
                                ...tx,
                                receipts: matchingTx.receipts.map((receipt: {
                                    id: number;
                                    name: string;
                                    fileType: string;
                                    base64Content: string;
                                    createdAt?: Date | string | null;
                                    updatedAt?: Date | string | null;
                                }) => ({
                                    id: receipt.id,
                                    createdAt: receipt.createdAt ? new Date(receipt.createdAt) : new Date(),
                                    updatedAt: receipt.updatedAt ? new Date(receipt.updatedAt) : new Date(),
                                    name: receipt.name,
                                    fileType: receipt.fileType,
                                    base64Content: receipt.base64Content
                                }))
                            };
                        }
                        return tx;
                    });
                    
                    console.log('Setting form transactions with receipts');
                    // Only update the transactions field to avoid re-rendering the entire form
                    form.setValue('transactions', transactionsWithReceipts);
                } else {
                    console.error('Failed to load receipts: No form data returned');
                }
            } catch (e) {
                console.error('Error fetching receipts:', e);
                // Don't set an error here, as we already have the basic form data
            } finally {
                setReceiptsLoading(false);
            }
        }
        
        void loadReceipts();
    }, [formMetaLoading, error, formId, form]);

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
                throw new Error(result.error ?? 'Failed to delete receipt');
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
                        receipts: tx.receipts?.map((receipt: {
                            id: number;
                            name: string;
                            fileType: string;
                            base64Content: string;
                            createdAt?: Date | string | null;
                            updatedAt?: Date | string | null;
                        }) => ({
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

    // Create a reusable skeleton component for form fields
    const FormFieldSkeleton = () => (
        <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
        </div>
    );
    
    // Create a skeleton for the transaction card
    const TransactionSkeleton = () => (
        <div className="bg-gray-800 rounded-lg border border-gray-600 shadow-lg p-6 mb-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormFieldSkeleton />
                <FormFieldSkeleton />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormFieldSkeleton />
                <FormFieldSkeleton />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormFieldSkeleton />
                <FormFieldSkeleton />
            </div>
            <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-16" />
                <div className="flex flex-wrap gap-4">
                    <Skeleton className="h-24 w-24" />
                    <Skeleton className="h-24 w-24" />
                </div>
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-gray-900 text-gray-100">
            <div className="container mx-auto p-6">
                <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-8">
                    <div className="text-red-400 p-4 bg-red-900/20 rounded-lg border border-red-700">
                        <h3 className="text-xl font-semibold mb-2">Error Loading Form</h3>
                        <p>{error}</p>
                        <Button 
                            className="mt-4 bg-blue-600 hover:bg-blue-700" 
                            onClick={() => router.push('/dashboard')}
                        >
                            Return to Dashboard
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100">
            <div className="container mx-auto p-6">
                <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-8">
                    <Form {...form}>
                        <div className="space-y-6">
                            <div className="flex justify-between items-center mb-6">
                                <h1 className="text-2xl font-bold text-gray-100">
                                    {formMetaLoading ? <Skeleton className="h-8 w-32" /> : "View Form"}
                                </h1>
                                <div className="flex gap-4">
                                    {!formMetaLoading && (
                                        <>
                                            <FormPdfButton formId={formId} />
                                            <Button
                                                type="button"
                                                onClick={() => setIsEditing(!isEditing)}
                                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                            >
                                                {isEditing ? "Cancel Edit" : "Edit Form"}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Prevent default form submission behavior by adding onSubmit that just prevents default */}
                        <form id="form" onSubmit={(e) => e.preventDefault()} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                {formMetaLoading ? (
                                    <>
                                        <FormFieldSkeleton />
                                        <FormFieldSkeleton />
                                    </>
                                ) : (
                                    <>
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
                                    </>
                                )}
                            </div>
                            <hr className="my-6" />

                            {formMetaLoading ? (
                                <div className="space-y-8">
                                    <div className="flex justify-between items-center pb-4 border-b border-gray-700">
                                        <Skeleton className="h-8 w-32" />
                                    </div>
                                    <TransactionSkeleton />
                                    <TransactionSkeleton />
                                </div>
                            ) : (
                                <>
                                    <TransactionForm
                                        form={form}
                                        isEditing={isEditing}
                                        onRemoveTransaction={handleRemoveTransaction}
                                        onDeleteReceipt={handleDeleteReceipt}
                                        isLoadingReceipts={receiptsLoading}
                                    />
                                    
                                    {receiptsLoading && (
                                        <div className="mt-4 p-3 bg-gray-700/30 rounded-md text-center">
                                            <div className="animate-pulse flex items-center justify-center space-x-2">
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                                <span>Loading receipts...</span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            
                            <div className="flex justify-between mt-6">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.push('/dashboard')}
                                >
                                    Back to Dashboard
                                </Button>
                                {isEditing && !formMetaLoading && (
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
                    </Form>
                </div>
            </div>
        </div>
    );
}