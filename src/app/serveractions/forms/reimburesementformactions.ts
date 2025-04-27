// src/app/serveractions/forms/reimburesementformactions.ts
'use server';
import { db } from "~/server/db";
import { eq, or } from "drizzle-orm";
import { forms, transactions, receipts } from "~/server/db/schema";
import { reimbursementFormSchema, type FormValues } from "~/lib/schema";
import { revalidatePath } from "next/cache";

export async function deleteReceipt({
    formId,
    receiptId,
}: {
    formId: number;
    receiptId: number;
}) {
    try {
        console.log('Server action: deleting receipt', receiptId, 'from form', formId);

        // First, verify that the receipt exists
        const receiptResult = await db.select().from(receipts).where(eq(receipts.id, receiptId));

        if (!receiptResult || receiptResult.length === 0) {
            console.error(`Receipt with ID ${receiptId} not found.`);
            return { success: false, error: 'Receipt not found' };
        }

        // Get the transaction ID for this receipt to validate form ownership
        const transactionId = receiptResult[0]?.transactionId;

        // Verify the transaction belongs to the form
        const transactionResult = await db.select()
            .from(transactions)
            .where(eq(transactions.id, transactionId ?? 0));

        if (!transactionResult || transactionResult.length === 0) {
            console.error(`Transaction with ID ${transactionId} not found.`);
            return { success: false, error: 'Transaction not found' };
        }

        // Verify the transaction belongs to the specified form
        if (transactionResult[0]?.formId !== formId) {
            console.error(`Transaction ${transactionId} does not belong to form ${formId}.`);
            return { success: false, error: 'Unauthorized access' };
        }

        // Delete the receipt
        const deleteResult = await db.delete(receipts).where(eq(receipts.id, receiptId));
        console.log('Receipt delete result:', deleteResult);

        // Revalidate the form page to reflect changes
        revalidatePath(`/forms/${formId}`);

        return { success: true };
    } catch (error) {
        console.error('Error deleting receipt:', error);
        return {
            success: false,
            error: `Failed to delete receipt: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}

export async function addForm({
    form,
}: {
    form: FormValues;
}) {
    console.log('Server action: adding form', form);
    try {
        // Remove any provided ID from the form data as we're creating a new record
        const { id, ...formWithoutId } = form;

        // Validate the form data
        const validatedForm = reimbursementFormSchema.parse(formWithoutId);
        console.log('Validated form data:', validatedForm);

        const formEntry = {
            userId: validatedForm.userId,
            formType: validatedForm.formType,
            submitterEmail: validatedForm.submitterEmail,
            submitterName: validatedForm.submitterName,
            reimbursedName: validatedForm.reimbursedName,
            reimbursedEmail: validatedForm.reimbursedEmail,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        console.log('Inserting form:', formEntry);
        let result;
        try {
            result = await db.insert(forms).values(formEntry);
        } catch (dbError) {
            console.error('Form insert error:', dbError);
            return { success: false, error: `Failed to insert form: ${dbError instanceof Error ? dbError.message : 'Database error'}` };
        }
        console.log('Form insert result:', result);

        if (!result?.[0]?.insertId) {
            const error = 'No form ID returned from insert';
            console.error(error);
            return { success: false, error };
        }

        const newFormId = result[0].insertId;

        // Log each transaction insert
        for (const tx of validatedForm.transactions) {
            console.log('Inserting transaction:', tx);
            try {
                // Format the date properly for new forms too
                let txDateString: string;
                if (tx.date instanceof Date) {
                    // Use UTC methods to prevent timezone shifts
                    const year = tx.date.getUTCFullYear();
                    const month = String(tx.date.getUTCMonth() + 1).padStart(2, '0');
                    const day = String(tx.date.getUTCDate()).padStart(2, '0');
                    txDateString = `${year}-${month}-${day}`;
                } else if (typeof tx.date === 'string') {
                    txDateString = tx.date;
                } else {
                    // Default to today
                    const today = new Date();
                    const year = today.getUTCFullYear();
                    const month = String(today.getUTCMonth() + 1).padStart(2, '0');
                    const day = String(today.getUTCDate()).padStart(2, '0');
                    txDateString = `${year}-${month}-${day}`;
                }

                console.log('Initial form transaction date:', {
                    original: tx.date,
                    converted: txDateString
                });

                const txResult = await db.insert(transactions)
                    .values({
                        formId: newFormId,
                        date: txDateString, // Use the string date
                        accountLine: tx.accountLine,
                        department: tx.department,
                        placeVendor: tx.placeVendor,
                        description: tx.description,
                        amount: tx.amount,
                    });
                console.log('Transaction insert result:', txResult);

                if (tx.receipts?.length && txResult?.[0]?.insertId) {
                    const newTransactionId = txResult[0].insertId;
                    console.log('Inserting receipts:', tx.receipts);
                    const receiptResult = await db.insert(receipts).values(
                        tx.receipts.map(receipt => ({
                            transactionId: newTransactionId,
                            createdAt: receipt.createdAt,
                            updatedAt: receipt.updatedAt,
                            name: receipt.name,
                            fileType: receipt.fileType,
                            base64Content: receipt.base64Content,
                        }))
                    );
                    console.log('Receipt insert result:', receiptResult);
                }
            } catch (txError) {
                console.error('Transaction insert error:', txError);
                return {
                    success: false,
                    error: `Failed to insert transaction: ${txError instanceof Error ? txError.message : 'Unknown error'}`
                };
            }
        }

        // Revalidate the dashboard page to show the new form
        revalidatePath('/dashboard');

        return { success: true, formId: newFormId };
    } catch (error) {
        console.error('Detailed form submission error:', error);
        return {
            success: false,
            error: `Form submission failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}

export async function getForms(userId?: string) {
    try {
        console.log('Server action: fetching forms', userId ? `for user ${userId}` : 'for all users');

        // Build the query based on whether we have a userId
        let formList;
        if (userId) {
            formList = await db.select()
                .from(forms)
                .where(eq(forms.userId, userId));
        } else {
            formList = await db.select().from(forms);
        }

        console.log(`Fetched ${formList.length} forms`);
        return formList;
    } catch (error) {
        console.error('Error fetching forms:', error);
        return []; // Return an empty array in case of error, or handle error as needed
    }
}

export async function getFormById(formId: number, skipReceipts = false) {
    try {
        console.log('Server action: fetching form by ID', formId, skipReceipts ? '(skipping receipts)' : '');

        // Fetch the form itself
        const formResult = await db.select().from(forms).where(eq(forms.id, formId));
        const form = formResult[0]; // Assuming formId is unique, get the first result

        if (!form) {
            console.log(`Form with ID ${formId} not found`);
            return null; // Or throw an error if you prefer to handle not-found cases differently
        }

        // Fetch related transactions for this form
        const transactionsResult = await db.select().from(transactions).where(eq(transactions.formId, formId));
        console.log(`Found ${transactionsResult.length} transactions for form ${formId}`);

        let transactionsWithReceipts;

        if (skipReceipts) {
            // If skipReceipts is true, don't fetch the receipt content
            transactionsWithReceipts = transactionsResult.map(transaction => {
                const { id, ...rest } = transaction;
                return {
                    transactionId: id,
                    ...rest,
                    receipts: [], // Empty array instead of fetching receipts
                };
            });
        } else {
            // Fetch all receipts for this form with a single query
            const txIds = transactionsResult.map(tx => tx.id);
            console.log(`Fetching receipts for transaction IDs:`, txIds);

            // Define the receipt type to avoid implicit any
            type ReceiptResult = {
                id: number;
                transactionId: number;
                name: string;
                fileType: string;
                base64Content: string;
                createdAt: Date | null;
                updatedAt: Date | null;
            };

            // Make sure we have transaction IDs before querying
            let allReceiptsResult: ReceiptResult[] = [];
            if (txIds.length > 0) {
                try {
                    // If we have a lot of transaction IDs, we might hit performance issues with too many OR conditions
                    // So we'll batch the queries if there are more than 10 transactions
                    if (txIds.length <= 10) {
                        // For a small number of transactions, use OR conditions
                        const orConditions = txIds.map(txId => eq(receipts.transactionId, txId));

                        allReceiptsResult = await db.select()
                            .from(receipts)
                            .where(orConditions.length === 1 ? orConditions[0] : or(...orConditions));
                    } else {
                        // For many transactions, do separate queries for each batch of 10 transactions
                        // and combine the results
                        const batchSize = 10;
                        const batches = [];

                        for (let i = 0; i < txIds.length; i += batchSize) {
                            const batchIds = txIds.slice(i, i + batchSize);
                            const orConditions = batchIds.map(txId => eq(receipts.transactionId, txId));

                            batches.push(
                                db.select()
                                    .from(receipts)
                                    .where(orConditions.length === 1 ? orConditions[0] : or(...orConditions))
                            );
                        }

                        // Execute all batch queries and combine results
                        const batchResults = await Promise.all(batches);
                        allReceiptsResult = batchResults.flat() as ReceiptResult[];
                    }

                    console.log(`Found ${allReceiptsResult.length} total receipts`);
                } catch (receiptError) {
                    console.error('Error fetching receipts:', receiptError);
                    allReceiptsResult = [];
                }
            }

            // Group receipts by transactionId
            const receiptsByTransactionId = allReceiptsResult.reduce((acc, receipt) => {
                const txId = receipt.transactionId;
                if (!acc[txId]) {
                    acc[txId] = [];
                }
                acc[txId].push(receipt);
                return acc;
            }, {} as Record<number, ReceiptResult[]>);

            // Debug group results
            Object.keys(receiptsByTransactionId).forEach(txId => {
                const receiptsForTx = receiptsByTransactionId[Number(txId)];
                if (receiptsForTx) {
                    console.log(`Transaction ${txId} has ${receiptsForTx.length} receipts`);
                }
            });

            // Map transactions with their receipts
            transactionsWithReceipts = transactionsResult.map(transaction => {
                const { id, ...rest } = transaction;
                const txReceipts = receiptsByTransactionId[id] ?? [];
                console.log(`Mapping transaction ${id} with ${txReceipts.length} receipts`);
                return {
                    transactionId: id,
                    ...rest,
                    receipts: txReceipts,
                };
            });
        }

        console.log('Completed fetching form with', transactionsWithReceipts.length, 'transactions');

        return {
            form: form,
            transactions: transactionsWithReceipts,
        };

    } catch (error) {
        console.error('Error fetching form by ID:', error);
        return null; // Or handle error as needed, maybe throw error to be caught in component
    }
}

// Move the ReceiptFile interface to the top of the file, before it's used
// Add a proper type definition for file objects
interface ReceiptFile {
    name: string;
    type: string;
    base64Content: string;
    createdAt: Date;
    updatedAt: Date;
}

// Add this interface for the update form data
interface UpdateFormData extends Omit<FormValues, 'transactions'> {
    transactions: Array<FormValues['transactions'][number] & {
        newFiles?: ReceiptFile[];
    }>;
    deletedTransactionIds?: number[];
}

export async function updateFormWithFiles({
    id: formId,
    form: formDataWithBase64,
}: {
    id: number;
    form: UpdateFormData; // Using our defined interface
}) {
    try {
        console.log('Server action: updating form with files', formId, formDataWithBase64);

        // --- 1. Update form data in 'forms' table ---
        const { transactions: submittedTransactions, deletedTransactionIds, ...formUpdateData } = formDataWithBase64;

        const updatedFormResult = await db.update(forms)
            .set({
                ...formUpdateData,
                updatedAt: new Date(),
            })
            .where(eq(forms.id, formId));

        console.log('Form update result:', updatedFormResult);

        // --- 2. Handle deleted transactions ---
        if (deletedTransactionIds && deletedTransactionIds.length > 0) {
            console.log('Deleting transactions with IDs:', deletedTransactionIds);

            for (const transactionIdToDelete of deletedTransactionIds) {
                const deleteTransactionResult = await db.delete(transactions)
                    .where(eq(transactions.id, transactionIdToDelete));
                console.log(`Deleted transaction ${transactionIdToDelete} result:`, deleteTransactionResult);
            }
        }

        // --- 3. Update/Insert transactions and process new receipts ---
        if (submittedTransactions && submittedTransactions.length > 0) {
            for (const tx of submittedTransactions) {
                // Do not convert dates to strings at all - use the raw Date objects
                // This will avoid any timezone conversion issues
                const txData = {
                    ...tx,
                    // Keep the original Date objects
                    updatedAt: new Date(), // Always use current time for updatedAt
                };

                console.log('Transaction data to save:', {
                    id: tx.id,
                    date: tx.date instanceof Date
                        ? `${tx.date.getUTCFullYear()}-${tx.date.getUTCMonth() + 1}-${tx.date.getUTCDate()}`
                        : tx.date,
                    dateType: typeof tx.date
                });

                // Check if this is an existing transaction (has a positive numeric ID)
                if (tx.id && typeof tx.id === 'number' && tx.id > 0) {
                    // --- 3.1. Update existing transaction ---
                    const { receipts: _, newFiles, ...txUpdateData } = txData as {
                        receipts?: unknown;
                        newFiles?: ReceiptFile[];
                        [key: string]: unknown;
                    };

                    // Format the date as YYYY-MM-DD string for storage
                    let dateString: string;

                    if (tx.date instanceof Date) {
                        // Use UTC methods to prevent timezone shifts
                        const date = new Date(tx.date.getTime());

                        // Add 12 hours to ensure it stays on the same day regardless of timezone
                        date.setHours(12, 0, 0, 0);

                        const year = date.getUTCFullYear();
                        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                        const day = String(date.getUTCDate()).padStart(2, '0');
                        dateString = `${year}-${month}-${day}`;

                        console.log('Date conversion:', {
                            original: tx.date.toISOString(),
                            adjusted: date.toISOString(),
                            formatted: dateString
                        });
                    } else if (typeof tx.date === 'string') {
                        // If it's already a string, make sure it's in YYYY-MM-DD format
                        // Using indexOf instead of match to avoid TypeScript errors
                        const dateStr = String(tx.date);
                        if (dateStr.indexOf('-') > 0 && dateStr.length === 10) {
                            // Simple validation for YYYY-MM-DD format
                            const parts = dateStr.split('-');
                            if (parts.length === 3 && parts[0] && parts[0].length === 4) {
                                dateString = dateStr;
                            } else {
                                // Parse as date and reformat
                                const tempDate = new Date(dateStr);
                                const year = tempDate.getUTCFullYear();
                                const month = String(tempDate.getUTCMonth() + 1).padStart(2, '0');
                                const day = String(tempDate.getUTCDate()).padStart(2, '0');
                                dateString = `${year}-${month}-${day}`;
                            }
                        } else {
                            // Try to parse and reformat
                            const tempDate = new Date(tx.date);
                            const year = tempDate.getUTCFullYear();
                            const month = String(tempDate.getUTCMonth() + 1).padStart(2, '0');
                            const day = String(tempDate.getUTCDate()).padStart(2, '0');
                            dateString = `${year}-${month}-${day}`;
                        }
                    } else {
                        // Default to today
                        const today = new Date();
                        const year = today.getUTCFullYear();
                        const month = String(today.getUTCMonth() + 1).padStart(2, '0');
                        const day = String(today.getUTCDate()).padStart(2, '0');
                        dateString = `${year}-${month}-${day}`;
                    }

                    console.log('Saving transaction date as string:', dateString, 'from original:', tx.date);

                    // Update with exact schema field types
                    const updatedTransactionResult = await db.update(transactions)
                        .set({
                            date: dateString, // Store as YYYY-MM-DD string
                            accountLine: String(txUpdateData.accountLine),
                            department: String(txUpdateData.department),
                            placeVendor: String(txUpdateData.placeVendor),
                            description: String(txUpdateData.description),
                            amount: parseFloat(String(txUpdateData.amount)),
                            // Remove updatedAt and formId which may be causing type issues
                        })
                        .where(eq(transactions.id, tx.id));

                    console.log('Transaction update result:', updatedTransactionResult);
                    console.log(`Updated transaction ${tx.id} result:`, updatedTransactionResult);

                    // --- 3.2. Process new receipts for existing transaction ---
                    if (newFiles && newFiles.length > 0) {
                        console.log(`Inserting new receipts for transaction ${tx.id}:`, newFiles);

                        // Debug what we received
                        console.log(`Receipt files for transaction ${tx.id}:`, newFiles.map(f => ({
                            name: f.name,
                            type: f.type,
                            contentLength: f.base64Content ? f.base64Content.length : 0
                        })));

                        // Validate each file has required fields
                        for (const file of newFiles) {
                            if (!file.name) {
                                console.error('Receipt missing name:', file);
                                return {
                                    success: false,
                                    error: 'Receipt file name is missing'
                                };
                            }
                            if (!file.type) {
                                console.error('Receipt missing type:', file);
                                return {
                                    success: false,
                                    error: 'Receipt file type is missing'
                                };
                            }
                            if (!file.base64Content) {
                                console.error('Receipt missing base64Content for file:', file.name);
                                return {
                                    success: false,
                                    error: 'Receipt file content is missing'
                                };
                            }

                            // Check if base64Content is valid
                            if (typeof file.base64Content !== 'string' || file.base64Content.length < 100) {
                                console.error('Receipt has invalid base64Content:', file.name, typeof file.base64Content, file.base64Content?.length);
                                return {
                                    success: false,
                                    error: `Receipt file content is invalid for file: ${file.name}`
                                };
                            }
                        }

                        try {
                            const receiptValues = newFiles.map((file) => ({
                                transactionId: tx.id!,
                                name: file.name,
                                fileType: file.type,
                                base64Content: file.base64Content,
                                createdAt: file.createdAt,
                                updatedAt: file.updatedAt
                            }));

                            console.log('Receipt insert values count:', receiptValues.length);

                            const receiptInsertResult = await db.insert(receipts).values(receiptValues);
                            console.log('Receipt insert result:', receiptInsertResult);
                        } catch (receiptError) {
                            console.error('Error inserting receipts:', receiptError);
                            return {
                                success: false,
                                error: `Failed to insert receipts: ${receiptError instanceof Error ? receiptError.message : 'Unknown error'}`
                            };
                        }
                    }
                } else {
                    // --- 3.3. Insert new transaction ---
                    console.log('Inserting new transaction');

                    // Destructure safely - tx.id might not exist
                    const { id: _, receipts: __, newFiles, ...txInsertData } = tx as {
                        id?: number;
                        receipts?: unknown;
                        newFiles?: ReceiptFile[];
                        [key: string]: unknown;
                    };

                    console.log('New transaction data to insert:', {
                        formId,
                        ...txInsertData,
                        amount: parseFloat(String(txInsertData.amount))
                    });

                    // Format the date as YYYY-MM-DD string for storage (same as above)
                    let dateString: string;

                    if (tx.date instanceof Date) {
                        // Use UTC methods to prevent timezone shifts
                        const date = new Date(tx.date.getTime());

                        // Add 12 hours to ensure it stays on the same day regardless of timezone
                        date.setHours(12, 0, 0, 0);

                        const year = date.getUTCFullYear();
                        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                        const day = String(date.getUTCDate()).padStart(2, '0');
                        dateString = `${year}-${month}-${day}`;

                        console.log('Date conversion for new transaction:', {
                            original: tx.date.toISOString(),
                            adjusted: date.toISOString(),
                            formatted: dateString
                        });
                    } else if (typeof tx.date === 'string') {
                        // If it's already a string, make sure it's in YYYY-MM-DD format
                        // Using indexOf instead of match to avoid TypeScript errors
                        const dateStr = String(tx.date);
                        if (dateStr.indexOf('-') > 0 && dateStr.length === 10) {
                            // Simple validation for YYYY-MM-DD format
                            const parts = dateStr.split('-');
                            if (parts.length === 3 && parts[0] && parts[0].length === 4) {
                                dateString = dateStr;
                            } else {
                                // Parse as date and reformat
                                const tempDate = new Date(dateStr);
                                const year = tempDate.getUTCFullYear();
                                const month = String(tempDate.getUTCMonth() + 1).padStart(2, '0');
                                const day = String(tempDate.getUTCDate()).padStart(2, '0');
                                dateString = `${year}-${month}-${day}`;
                            }
                        } else {
                            // Try to parse and reformat
                            const tempDate = new Date(tx.date);
                            const year = tempDate.getUTCFullYear();
                            const month = String(tempDate.getUTCMonth() + 1).padStart(2, '0');
                            const day = String(tempDate.getUTCDate()).padStart(2, '0');
                            dateString = `${year}-${month}-${day}`;
                        }
                    } else {
                        // Default to today
                        const today = new Date();
                        const year = today.getUTCFullYear();
                        const month = String(today.getUTCMonth() + 1).padStart(2, '0');
                        const day = String(today.getUTCDate()).padStart(2, '0');
                        dateString = `${year}-${month}-${day}`;
                    }

                    console.log('Inserting new transaction with date string:', dateString, 'from original:', tx.date);

                    // Insert with exact schema field order and types
                    const transactionInsertResult = await db.insert(transactions)
                        .values({
                            // The date field is a varchar in the schema
                            date: dateString, // Store as YYYY-MM-DD string 
                            accountLine: String(txInsertData.accountLine),
                            department: String(txInsertData.department),
                            placeVendor: String(txInsertData.placeVendor),
                            description: String(txInsertData.description),
                            amount: parseFloat(String(txInsertData.amount)),
                            formId: formId, // FormID as number
                        });
                    console.log('Transaction insert result:', transactionInsertResult);

                    // Fix: Use type assertion with a more specific type
                    const newTransactionId = transactionInsertResult?.[0]?.insertId;
                    console.log('New transaction ID:', newTransactionId);

                    // --- 3.4. Process receipts for new transaction ---
                    if (newFiles && newFiles.length > 0 && newTransactionId) {
                        console.log(`Inserting receipts for new transaction ${newTransactionId}:`, newFiles);

                        // Debug what we received
                        console.log(`Receipt files for new transaction:`, newFiles.map(f => ({
                            name: f.name,
                            type: f.type,
                            contentLength: f.base64Content ? f.base64Content.length : 0
                        })));

                        // Validate each file has required fields
                        for (const file of newFiles) {
                            if (!file.name) {
                                console.error('Receipt missing name:', file);
                                return {
                                    success: false,
                                    error: 'Receipt file name is missing for new transaction'
                                };
                            }
                            if (!file.type) {
                                console.error('Receipt missing type:', file);
                                return {
                                    success: false,
                                    error: 'Receipt file type is missing for new transaction'
                                };
                            }
                            if (!file.base64Content) {
                                console.error('Receipt missing base64Content for file:', file.name);
                                return {
                                    success: false,
                                    error: 'Receipt file content is missing for new transaction'
                                };
                            }

                            // Check if base64Content is valid
                            if (typeof file.base64Content !== 'string' || file.base64Content.length < 100) {
                                console.error('Receipt has invalid base64Content:', file.name, typeof file.base64Content, file.base64Content?.length);
                                return {
                                    success: false,
                                    error: `Receipt file content is invalid for new transaction file: ${file.name}`
                                };
                            }
                        }

                        try {
                            const receiptValues = newFiles.map((file) => ({
                                transactionId: newTransactionId,
                                name: file.name,
                                fileType: file.type,
                                base64Content: file.base64Content,
                                createdAt: file.createdAt,
                                updatedAt: file.updatedAt
                            }));

                            console.log('Receipt insert values for new transaction count:', receiptValues.length);

                            const receiptInsertResult = await db.insert(receipts).values(receiptValues);
                            console.log('Receipt insert result (for new transaction):', receiptInsertResult);
                        } catch (receiptError) {
                            console.error('Error inserting receipts for new transaction:', receiptError);
                            return {
                                success: false,
                                error: `Failed to insert receipts for new transaction: ${receiptError instanceof Error ? receiptError.message : 'Unknown error'}`
                            };
                        }
                    }
                }
            }
        }

        // --- 4. Fetch and return updated form data ---
        const updatedFormResultForReturn = await db.select().from(forms).where(eq(forms.id, formId));
        const updatedForm = updatedFormResultForReturn[0];

        const updatedTransactionsResultForReturn = await db.select().from(transactions).where(eq(transactions.formId, formId));
        const updatedTransactionsWithReceipts = await Promise.all(
            updatedTransactionsResultForReturn.map(async (transaction) => {
                const receiptsResult = await db.select().from(receipts).where(eq(receipts.transactionId, transaction.id));
                return {
                    ...transaction,
                    receipts: receiptsResult,
                };
            })
        );

        console.log('Successfully updated form and related data.');

        revalidatePath(`/forms/${formId}`);
        revalidatePath('/dashboard');

        return {
            success: true,
            form: updatedForm,
            transactions: updatedTransactionsWithReceipts,
        };

    } catch (error) {
        console.error('Error updating form with files (server action):', error);

        // Create a structured error response
        const errorResponse: {
            success: false;
            error: string;
            details?: unknown;
            code?: string;
            sqlMessage?: string;
        } = {
            success: false,
            error: 'Failed to update form'
        };

        // Add detailed error information if available
        if (error instanceof Error) {
            errorResponse.error = `Failed to update form: ${error.message}`;
            errorResponse.details = error;

            // Extract database error information if available
            const dbError = error as unknown as {
                code?: string;
                sqlMessage?: string;
            };

            if (dbError.code) {
                errorResponse.code = dbError.code;
            }

            if (dbError.sqlMessage) {
                errorResponse.sqlMessage = dbError.sqlMessage;
                // Update the main error message with the SQL error
                errorResponse.error = `Database error: ${dbError.sqlMessage}`;
            }
        }

        return errorResponse;
    }
}

// Remove the duplicate interface definitions at the end of the file