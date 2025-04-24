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
        // Validate the form data
        const validatedForm = reimbursementFormSchema.parse(form);
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
            throw new Error('Failed to insert form');
        }
        console.log('Form insert result:', result);

        if (!result?.[0]?.insertId) {
            throw new Error('No form ID returned from insert');
        }

        const newFormId = result[0].insertId;

        // Log each transaction insert
        for (const tx of validatedForm.transactions) {
            console.log('Inserting transaction:', tx);
            try {
                const txResult = await db.insert(transactions)
                    .values({
                        formId: newFormId,
                        date: tx.date,
                        createdAt: tx.createdAt,
                        updatedAt: tx.updatedAt,
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
                throw new Error('Failed to insert transaction');
            }
        }

        return { success: true, formId: newFormId };
    } catch (error) {
        console.error('Detailed error:', error);
        throw error;
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

export async function getFormById(formId: number, skipReceipts: boolean = false) {
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
                console.log(`Transaction ${txId} has ${receiptsByTransactionId[Number(txId)].length} receipts`);
            });
            
            // Map transactions with their receipts
            transactionsWithReceipts = transactionsResult.map(transaction => {
                const { id, ...rest } = transaction;
                const txReceipts = receiptsByTransactionId[id] || [];
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
                // Ensure all date fields are stored as UTC ISO strings
                const normalizeDate = (d: Date | string | undefined) =>
                    d instanceof Date ? d.toISOString() : typeof d === "string" ? d : undefined;

                // Prepare transaction data with normalized dates
                const txData = {
                    ...tx,
                    date: normalizeDate(tx.date),
                    createdAt: normalizeDate(tx.createdAt),
                    updatedAt: normalizeDate(tx.updatedAt),
                };

                // Check if this is an existing transaction (has a positive numeric ID)
                if (tx.id && typeof tx.id === 'number' && tx.id > 0) {
                    // --- 3.1. Update existing transaction ---
                    const { receipts: _, newFiles, ...txUpdateData } = txData as {
                        receipts?: unknown;
                        newFiles?: ReceiptFile[];
                        [key: string]: unknown;
                    };

                    const updatedTransactionResult = await db.update(transactions)
                        .set({
                            ...txUpdateData,
                            date: txUpdateData.date ? new Date(txUpdateData.date as string) : new Date(),
                            createdAt: txUpdateData.createdAt ? new Date(txUpdateData.createdAt as string) : new Date(),
                            updatedAt: txUpdateData.updatedAt ? new Date(txUpdateData.updatedAt as string) : new Date(),
                            amount: parseFloat(String(txUpdateData.amount)),
                        })
                        .where(eq(transactions.id, tx.id));
                    console.log(`Updated transaction ${tx.id} result:`, updatedTransactionResult);

                    // --- 3.2. Process new receipts for existing transaction ---
                    if (newFiles && newFiles.length > 0) {
                        console.log(`Inserting new receipts for transaction ${tx.id}:`, newFiles);
                        const receiptInsertResult = await db.insert(receipts).values(
                            newFiles.map((file) => ({
                                transactionId: tx.id!,
                                name: file.name,
                                fileType: file.type,
                                base64Content: file.base64Content,
                                createdAt: file.createdAt,
                                updatedAt: file.updatedAt
                            }))
                        );
                        console.log('Receipt insert result:', receiptInsertResult);
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

                    const transactionInsertResult = await db.insert(transactions)
                        .values({
                            formId,
                            date: new Date(String(txInsertData.date)),
                            description: String(txInsertData.description),
                            accountLine: String(txInsertData.accountLine),
                            department: String(txInsertData.department),
                            placeVendor: String(txInsertData.placeVendor),
                            // formId is already included in the spread object above
                            ...txInsertData,
                            amount: parseFloat(String(txInsertData.amount)),
                        });
                    console.log('Transaction insert result:', transactionInsertResult);

                    // Fix: Use type assertion with a more specific type
                    const newTransactionId = transactionInsertResult?.[0]?.insertId;
                    console.log('New transaction ID:', newTransactionId);

                    // --- 3.4. Process receipts for new transaction ---
                    if (newFiles && newFiles.length > 0 && newTransactionId) {
                        console.log(`Inserting receipts for new transaction ${newTransactionId}:`, newFiles);
                        const receiptInsertResult = await db.insert(receipts).values(
                            newFiles.map((file) => ({
                                transactionId: newTransactionId,
                                name: file.name,
                                fileType: file.type,
                                base64Content: file.base64Content,
                                createdAt: file.createdAt,
                                updatedAt: file.updatedAt
                            }))
                        );
                        console.log('Receipt insert result (for new transaction):', receiptInsertResult);
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
        return { success: false, error: 'Failed to update form', details: error };
    }
}

// Remove the duplicate interface definitions at the end of the file