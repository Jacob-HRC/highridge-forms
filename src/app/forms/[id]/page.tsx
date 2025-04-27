// src/app/forms/[id]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { reimbursementFormSchema } from "~/lib/schema";
import { updateFormWithFiles } from "~/app/serveractions/forms/reimburesementformactions";
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

// Helper function to convert File to base64 string
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            if (!result) {
                reject(new Error(`Failed to read file: ${file.name}`));
                return;
            }
            resolve(result);
        };
        reader.onerror = (error) => {
            // Properly handle the error object to avoid @typescript-eslint/no-base-to-string error
            // by explicitly checking the type and extracting the message
            const errorMessage = error instanceof Error ? error.message :
                typeof error === 'object' ? JSON.stringify(error) : String(error);
            console.error('FileReader error:', errorMessage);
            reject(new Error(`FileReader error: ${errorMessage}`));
        };
        reader.readAsDataURL(file);
    });
}

export default function EditFormPage() {
    const params = useParams();
    const router = useRouter();
    const [formMetaLoading, setFormMetaLoading] = useState(true);
    const [receiptsLoading, setReceiptsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false); // Default to viewing mode, not editing
    const formId = Number(params.id); // Get the form ID from the URL params, assuming it's a number

    // Use deletedTransactionIds to track transactions to be deleted on save
    const [deletedTransactionIds, setDeletedTransactionIds] = useState<number[]>([]);

    const form = useForm<FormValues>({
        resolver: zodResolver(reimbursementFormSchema),
    });
    const { control, reset } = form;

    // Set up useFieldArray hook
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
                            // Parse the string date from the database
                            let txDate;
                            try {
                                if (tx.date) {
                                    // If it's already a string in YYYY-MM-DD format, create a Date object
                                    if (typeof tx.date === 'string' && typeof tx.date === 'string' && tx.date.indexOf('-') > 0) {
                                        // Safer check that doesn't rely on match method
                                        const parts = tx.date.split('-');
                                        if (parts.length === 3) {
                                            const [year, month, day] = parts.map(Number);
                                            // Check if all values are valid numbers (not NaN and not undefined)
                                            if (typeof year === 'number' && typeof month === 'number' && typeof day === 'number' && !isNaN(year) && !isNaN(month) && !isNaN(day)) {
                                                // Create a date object in UTC
                                                txDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
                                                console.log('Parsed date from string:', tx.date, 'to UTC Date:', txDate.toISOString());
                                            } else {
                                                // Fallback if parts aren't valid numbers
                                                const tempDate = new Date(tx.date);
                                                txDate = new Date(Date.UTC(
                                                    tempDate.getUTCFullYear(),
                                                    tempDate.getUTCMonth(),
                                                    tempDate.getUTCDate(),
                                                    12, 0, 0
                                                ));
                                                console.log('Parsed date with UTC fallback:', tx.date, 'to Date:', txDate.toISOString());
                                            }
                                        } else {
                                            // Not in expected format, use regular date parsing with UTC
                                            const tempDate = new Date(tx.date);
                                            txDate = new Date(Date.UTC(
                                                tempDate.getUTCFullYear(),
                                                tempDate.getUTCMonth(),
                                                tempDate.getUTCDate(),
                                                12, 0, 0
                                            ));
                                            console.log('Parsed date with UTC fallback (2):', tx.date, 'to Date:', txDate.toISOString());
                                        }
                                    } else {
                                        // Otherwise handle as before but using UTC
                                        const tempDate = new Date(tx.date);
                                        const year = tempDate.getUTCFullYear();
                                        const month = tempDate.getUTCMonth();
                                        const day = tempDate.getUTCDate();
                                        txDate = new Date(Date.UTC(year, month, day, 12, 0, 0));

                                        console.log('Converted date with UTC:', tx.date, 'to Date:', txDate.toISOString());
                                    }
                                } else {
                                    // Default date
                                    txDate = new Date();
                                    console.log('Using default date:', txDate);
                                }

                                // Store the original string format for later use
                                const dateString = typeof tx.date === 'string' ? tx.date : null;

                                console.log('Date info:', {
                                    original: tx.date,
                                    dateString: dateString,
                                    dateObject: txDate,
                                    formattedForDisplay: txDate.toLocaleDateString()
                                });
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
                                description: tx.description ?? "",
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
                const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                setError(`Error loading form: ${errorMessage}`);
            } finally {
                setFormMetaLoading(false);
            }
        }

        void loadFormMetadata();
    }, [formId, reset]);

    // Step 2: After initial form data loads, fetch receipts in a separate request
    useEffect(() => {
        async function loadReceipts() {
            if (formMetaLoading ?? error) return; // Skip if we're still loading form data or if there was an error

            setReceiptsLoading(true);
            console.log('Loading receipts for form:', formId);

            try {
                // Now load the complete form data with receipts
                const fullFormData = await getFormById(formId, false);
                if (fullFormData) {
                    console.log('Received form data with receipts:',
                        fullFormData.transactions.map(tx => ({
                            txId: tx.transactionId,
                            receiptCount: tx.receipts?.length ?? 0
                        }))
                    );

                    // Update only the receipts in the form
                    const currentValues = form.getValues();
                    const transactionsWithReceipts = currentValues.transactions.map((tx) => {
                        // Find the matching transaction from the full data
                        const matchingTx = fullFormData.transactions.find(t => t.transactionId === tx.id);
                        // Make sure receipts array exists and has items
                        if (matchingTx?.receipts && matchingTx.receipts.length > 0) {
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

    // Save form changes
    const handleSaveChanges = async () => {
        try {
            setIsSubmitting(true);
            setError(null);

            // Get form data from form state
            const formData = form.getValues();
            console.log('Form data to save:', formData);

            // Debug transactions and files
            formData.transactions.forEach((tx, index) => {
                console.log(`Transaction ${index}:`, {
                    id: tx.id,
                    date: tx.date,
                    amount: tx.amount,
                    description: tx.description,
                    receiptsCount: tx.receipts?.length ?? 0,
                    hasNewFiles: tx.newFiles ? 'yes' : 'no',
                    newFilesType: tx.newFiles ? (
                        tx.newFiles instanceof FileList ? 'FileList' :
                            Array.isArray(tx.newFiles) ? 'Array' :
                                typeof tx.newFiles
                    ) : 'none',
                    newFilesCount: tx.newFiles ? (
                        tx.newFiles instanceof FileList ? tx.newFiles.length :
                            Array.isArray(tx.newFiles) ? tx.newFiles.length :
                                'unknown'
                    ) : 0
                });
            });

            // Make sure we're using Date objects consistently
            console.log('Form data date check before processing:', formData.transactions.map(tx => ({
                id: tx.id,
                date: tx.date instanceof Date
                    ? `${tx.date.getUTCFullYear()}-${tx.date.getUTCMonth() + 1}-${tx.date.getUTCDate()}`
                    : tx.date,
                dateType: typeof tx.date
            })));

            // Process file uploads and convert to base64
            const transactionsWithFiles = await Promise.all(
                formData.transactions.map(async (tx) => {
                    // Ensure we have a proper Date object for the date
                    const txDate = tx.date;

                    // Check if there are files to process
                    if (!tx.newFiles) {
                        return {
                            ...tx,
                            date: txDate // Ensure we're returning the original Date object
                        };
                    }

                    // Different handling depending on whether we have a FileList or already processed files
                    let processedFiles = [];

                    if (tx.newFiles instanceof FileList || (Array.isArray(tx.newFiles) && tx.newFiles[0] instanceof File)) {
                        // It's a FileList, needs conversion to base64
                        console.log("Processing FileList for transaction:", tx.id);
                        // Ensure proper typing for fileList
                        const fileList = Array.isArray(tx.newFiles)
                            ? tx.newFiles as File[]
                            : Array.from(tx.newFiles);

                        try {
                            processedFiles = await Promise.all(
                                fileList.map(async (file, index) => {
                                    // Type guard to ensure file is a proper File object
                                    if (!(file instanceof File)) {
                                        throw new Error('Invalid file object: not a File instance');
                                    }

                                    // Safe access to file properties with type assertions
                                    const fileName = file.name;
                                    const fileType = file.type;

                                    console.log(`Processing file ${index + 1}/${fileList.length}: ${fileName} (${fileType})`);

                                    // Get base64 content with explicit error handling
                                    try {
                                        // Ensure file is properly typed before passing to fileToBase64
                                        const base64Content = await fileToBase64(file);
                                        // Verify the base64 content is not empty
                                        if (!base64Content) {
                                            throw new Error(`Empty base64 content for file: ${fileName}`);
                                        }
                                        console.log(`Successfully converted ${fileName} to base64 (length: ${base64Content.length})`);

                                        return {
                                            name: fileName,
                                            type: fileType,
                                            base64Content: base64Content,
                                            createdAt: new Date(),
                                            updatedAt: new Date()
                                        };
                                    } catch (error) {
                                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                                        console.error(`Error converting file to base64: ${errorMessage}`);
                                        throw new Error(`Failed to process file ${file.name}: ${errorMessage}`);
                                    }
                                })
                            );
                        } catch (error) {
                            console.error(`Error processing files for transaction ${tx.id}:`, error);
                            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                            setError(`Error processing files: ${errorMessage}`);
                            throw error;
                        }
                    } else if (Array.isArray(tx.newFiles) && tx.newFiles.length > 0) {
                        // It's already processed files with base64Content, just validate
                        console.log("Validating pre-processed files for transaction:", tx.id);

                        for (const file of tx.newFiles) {
                            // Type guard for file properties
                            if (typeof file !== 'object' || file === null) {
                                throw new Error("Invalid file object: not an object");
                            }

                            // Safe property access with type checking
                            if (!('name' in file) || !('type' in file) || !('base64Content' in file)) {
                                console.error("Invalid file object:", file);
                                throw new Error("Invalid file object: missing required properties");
                            }
                        }

                        processedFiles = tx.newFiles;
                    }

                    // Return transaction with processed files
                    console.log(`Processed ${processedFiles.length} files for transaction ${tx.id}`);
                    return {
                        ...tx,
                        date: tx.date, // Explicitly preserve the Date object
                        newFiles: processedFiles
                    };
                })
            );

            // Update form data with processed files and deleted transaction IDs
            const processedFormData = {
                ...formData,
                transactions: transactionsWithFiles,
                deletedTransactionIds: deletedTransactionIds
            };

            console.log('Processed form data ready for submission:', processedFormData);

            // Call the server action to update the form
            const result = await updateFormWithFiles({
                id: formId,
                form: processedFormData
            });

            console.log('Form update result:', result);

            if (result.success) {
                // Show success message and exit edit mode
                alert('Form saved successfully!');
                setIsEditing(false);

                // Refresh the form data with the updated data
                if (result.form && result.transactions) {
                    const refreshedFormData = {
                        ...result.form,
                        transactions: result.transactions.map(tx => ({
                            id: tx.id,
                            date: tx.date ? new Date(tx.date) : new Date(),
                            createdAt: tx.createdAt ? new Date(tx.createdAt) : new Date(),
                            updatedAt: tx.updatedAt ? new Date(tx.updatedAt) : new Date(),
                            accountLine: tx.accountLine,
                            department: tx.department,
                            placeVendor: tx.placeVendor,
                            description: tx.description ?? "",
                            amount: tx.amount,
                            receipts: tx.receipts ?? [],
                            newFiles: []
                        }))
                    };

                    // Reset form with fresh data
                    reset(refreshedFormData as FormValues);

                    // Clear deleted transactions list
                    setDeletedTransactionIds([]);
                }
            } else {
                // If the server returned an error, display it
                let errorMessage = result.error ?? 'Failed to save form';

                // Check if there are more detailed error information
                if ('details' in result && result.details) {
                    console.error('Detailed server error:', result.details);
                    if (result.details instanceof Error) {
                        errorMessage += `: ${result.details.message}`;
                    } else if (typeof result.details === 'object') {
                        // Try to extract useful info from error object
                        const detailsObj = result.details as Record<string, unknown>;
                        if ('sqlMessage' in detailsObj && typeof detailsObj.sqlMessage === 'string') {
                            errorMessage += `: Database error - ${detailsObj.sqlMessage}`;
                        } else if ('message' in detailsObj && typeof detailsObj.message === 'string') {
                            errorMessage += `: ${detailsObj.message}`;
                        }
                    }
                }

                setError(errorMessage);
                console.error('Form save error:', errorMessage);
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('Error saving form:', error);
            setError(`Failed to save form: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // This function only tracks deleted IDs but doesn't remove the transaction
    // The actual removal happens in the TransactionForm component
    const handleRemoveTransaction = (index: number) => {
        try {
            // Get the current form values
            const formValues = form.getValues();
            const transactions = formValues.transactions;

            if (!transactions || index >= transactions.length) {
                console.error('Invalid transaction index or no transactions in handleRemoveTransaction');
                return;
            }

            // Get the transaction and track for deletion if it has an ID
            const tx = transactions[index];
            if (tx && tx.id && typeof tx.id === 'number' && tx.id > 0) {
                console.log('Adding transaction ID to deletedTransactionIds list:', tx.id);
                setDeletedTransactionIds(prev => [...prev, tx.id as number]);
            }
        } catch (error) {
            console.error('Error in handleRemoveTransaction:', error);
        }
    };

    async function handleDeleteReceipt(transactionId: number, receiptId: number) {
        try {
            console.log(`Deleting receipt: ${receiptId} from transaction: ${transactionId} in form: ${formId}`);
            
            // Show confirmation dialog
            if (!confirm("Are you sure you want to delete this receipt?")) {
                console.log('Deletion cancelled by user');
                return; // User cancelled the deletion
            }
            
            // Call the server action directly
            console.log('Calling server action deleteReceipt with:', { formId, receiptId });
            const result = await deleteReceipt({
                formId: formId, // Use the formId from the page parameters
                receiptId: receiptId
            });
            
            console.log('Server action result:', result);
            
            if (!result.success) {
                console.error('Server returned error:', result.error);
                throw new Error(result.error ?? 'Failed to delete receipt');
            }
            
            console.log('Receipt deleted successfully on server, refreshing form data');
            
            // Refresh the form data to show the updated state
            const updatedFormData = await getFormById(formId);
            if (updatedFormData) {
                console.log('Got updated form data:', {
                    formId: updatedFormData.form.id,
                    transactions: updatedFormData.transactions.length
                });
                
                // Format the data properly for the form
                const refreshedFormData = {
                    ...updatedFormData.form,
                    transactions: updatedFormData.transactions.map(tx => {
                        console.log(`Processing transaction ${tx.transactionId} with ${tx.receipts?.length ?? 0} receipts`);
                        return {
                            id: tx.transactionId,
                            date: tx.date ? new Date(tx.date) : new Date(),
                            createdAt: tx.createdAt ? new Date(tx.createdAt) : new Date(),
                            updatedAt: tx.updatedAt ? new Date(tx.updatedAt) : new Date(),
                            accountLine: tx.accountLine,
                            department: tx.department,
                            placeVendor: tx.placeVendor,
                            description: tx.description ?? "",
                            amount: tx.amount,
                            receipts: (tx.receipts ?? []).map((receipt: {
                                id: number;
                                name: string;
                                fileType: string;
                                base64Content: string;
                                createdAt?: Date | string | null;
                                updatedAt?: Date | string | null;
                            }) => ({
                                id: receipt.id,
                                name: receipt.name,
                                fileType: receipt.fileType,
                                base64Content: receipt.base64Content,
                                createdAt: receipt.createdAt ? new Date(receipt.createdAt) : new Date(),
                                updatedAt: receipt.updatedAt ? new Date(receipt.updatedAt) : new Date(),
                            })),
                            newFiles: [],
                        };
                    }),
                };
                
                // Reset the form with the refreshed data
                console.log('Resetting form with refreshed data');
                reset(refreshedFormData as FormValues);
            } else {
                console.warn('No updated form data returned after receipt deletion');
            }

            // Show success message
            console.log('Receipt deletion complete');
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

                        {/* Form with submission handler */}
                        <form
                            id="form"
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (isEditing && !isSubmitting) {
                                    void handleSaveChanges();
                                }
                            }}
                            className="space-y-6"
                        >
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
                                        onRemoveTransaction={isEditing ? handleRemoveTransaction : undefined}
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
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent border-white"></div>
                                                    Saving...
                                                </>
                                            ) : (
                                                'Save Changes'
                                            )}
                                        </Button>
                                    </div>
                                )}

                                {/* Show any form submission errors */}
                                {error && isEditing && (
                                    <div className="mt-4 p-3 bg-red-900/30 text-red-300 border border-red-700 rounded-md">
                                        {error}
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