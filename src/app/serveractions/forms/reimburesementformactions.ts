// src/app/serveractions/forms/reimburesementformactions.ts
'use server';
import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import { forms, transactions, receipts } from "~/server/db/schema";
import { z } from "zod";
import { reimbursementFormSchema, type FormValues } from "~/lib/schema";
import { revalidatePath } from "next/cache";

export async function updateForm({
    id,
    form,
}: {
    id: string;
    form: any;
}) {
    console.log('Server action: updating form', id, form);
    // Insert your update logic here (e.g. update your database)
    // For demonstration, we simply return the updated form data.
    return form;
}

export async function deleteReceipt({
    formId,
    receiptId,
}: {
    formId: string;
    receiptId: number;
}) {
    console.log('Server action: deleting receipt', receiptId, 'from form', formId);
    // Insert your deletion logic here (e.g. remove the receipt from your database)
    // For demonstration, we simply log and return.
    return;
}

export async function deleteTransaction({
    formId,
    transactionId,
}: {
    formId: string;
    transactionId: number;
}) {
    console.log('Server action: deleting transaction', transactionId, 'from form', formId);
    // Insert your deletion logic here (e.g. remove the transaction from your database)
    // For demonstration, we simply log and return.
    return;
}

export async function addTransaction({
    formId,
    transaction,
}: {
    formId: string;
    transaction: any;
}) {
    console.log('Server action: adding transaction', transaction, 'to form', formId);
    // Insert your addition logic here (e.g. add the transaction to your database)
    // For demonstration, we simply log and return.
    return;
}

export async function addReceipt({
    formId,
    receipt,
}: {
    formId: string;
    receipt: any;
}) {
    console.log('Server action: adding receipt', receipt, 'to form', formId);
    // Insert your addition logic here (e.g. add the receipt to your database)
    // For demonstration, we simply log and return.
    return;
}

export async function updateTransaction({
    formId,
    transaction,
}: {
    formId: string;
    transaction: any;
}) {
    console.log('Server action: updating transaction', transaction, 'to form', formId);
    // Insert your update logic here (e.g. update the transaction in your database)
    // For demonstration, we simply log and return.
    return;
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

export async function getForms() {
    try {
        console.log('Server action: fetching forms');
        const formList = await db.select().from(forms);
        console.log('Fetched forms:', formList);
        return formList;
    } catch (error) {
        console.error('Error fetching forms:', error);
        return []; // Return an empty array in case of error, or handle error as needed
    }
}

export async function getFormById(formId: number) {
    try {
        console.log('Server action: fetching form by ID', formId);

        // Fetch the form itself
        const formResult = await db.select().from(forms).where(eq(forms.id, formId));
        const form = formResult[0]; // Assuming formId is unique, get the first result

        if (!form) {
            console.log(`Form with ID ${formId} not found`);
            return null; // Or throw an error if you prefer to handle not-found cases differently
        }

        // Fetch related transactions for this form
        const transactionsResult = await db.select().from(transactions).where(eq(transactions.formId, formId));
        const transactionsWithReceipts = await Promise.all(
            transactionsResult.map(async (transaction) => {
                const receiptsResult = await db.select().from(receipts).where(eq(receipts.transactionId, transaction.id));
                // Rename original id to transactionId
                const { id, ...rest } = transaction;
                return {
                    transactionId: id,
                    ...rest,
                    receipts: receiptsResult,
                };
            })
        );


        console.log('Fetched form:', form);
        console.log('Fetched transactions with receipts:', transactionsWithReceipts);

        return {
            form: form,
            transactions: transactionsWithReceipts,
        };

    } catch (error) {
        console.error('Error fetching form by ID:', error);
        return null; // Or handle error as needed, maybe throw error to be caught in component
    }
}

export async function updateFormWithFiles({
    id,
    form: formDataWithBase64, // Renamed parameter for clarity
}: {
    id: number;
    form: any; // Type as needed, or use 'any' for now and refine later.  This will be FormValues with newFiles
}) {
    try {
        console.log('Server action: updating form with files', id, formDataWithBase64);

        // --- 1. Update form data in 'forms' table ---
        const { transactions: submittedTransactions, deletedTransactionIds, ...formUpdateData } = formDataWithBase64;

        const updatedFormResult = await db.update(forms)
            .set({
                ...formUpdateData, // Spread the form fields to update
                updatedAt: new Date(),
            })
            .where(eq(forms.id, id));

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
                if (tx.id > 0) {
                    // --- 3.1. Update existing transaction ---
                    const { receipts: existingReceipts, newFiles, ...txUpdateData } = tx; // Separate newFiles
                    const updatedTransactionResult = await db.update(transactions)
                        .set({
                            ...txUpdateData,
                            amount: parseFloat(txUpdateData.amount), // Ensure amount is float
                        })
                        .where(eq(transactions.id, tx.id));
                    console.log(`Updated transaction ${tx.id} result:`, updatedTransactionResult);

                    // --- 3.2. Process new receipts for existing transaction ---
                    if (newFiles && newFiles.length > 0) {
                        console.log(`Inserting new receipts for transaction ${tx.id}:`, newFiles);
                        const receiptInsertResult = await db.insert(receipts).values(
                            newFiles.map((file: any) => ({ // Type 'file' as 'any' for now, refine type later
                                transactionId: tx.id,
                                name: file.name, // Or generate a name if not available
                                fileType: file.type,
                                base64Content: file.base64Content,
                            }))
                        );
                        console.log('Receipt insert result:', receiptInsertResult);
                    }

                } else if (tx.id <= 0) {
                    // --- 3.3. Insert new transaction ---
                    const { id, receipts: ignoredReceipts, newFiles, ...txInsertData } = tx; // Omit the id field
                    const transactionInsertResult = await db.insert(transactions)
                        .values({
                            formId: id,
                            ...txInsertData,
                            amount: parseFloat(txInsertData.amount), // Ensure amount is float
                        });
                    console.log('Transaction insert result:', transactionInsertResult);

                    const newTransactionId = transactionInsertResult?.[0]?.insertId; // Get new transaction ID

                    // --- 3.4. Process receipts for new transaction ---
                    if (newFiles && newFiles.length > 0 && newTransactionId) {
                        console.log(`Inserting receipts for new transaction ${newTransactionId}:`, newFiles);
                        const receiptInsertResult = await db.insert(receipts).values(
                            newFiles.map((file: any) => ({ // Type 'file' as 'any' for now, refine type later
                                transactionId: newTransactionId,
                                name: file.name, // Or generate a name if not available
                                fileType: file.type,
                                base64Content: file.base64Content,
                            }))
                        );
                        console.log('Receipt insert result (for new transaction):', receiptInsertResult);
                    }
                }
            }
        }


        // --- 4. Fetch and return updated form data ---
        const updatedFormResultForReturn = await db.select().from(forms).where(eq(forms.id, id));
        const updatedForm = updatedFormResultForReturn[0];

        const updatedTransactionsResultForReturn = await db.select().from(transactions).where(eq(transactions.formId, id));
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

        revalidatePath(`/forms/${id}`); // Revalidate the form's page cache
        revalidatePath(`/dashboard`); // Revalidate the dashboard page (if forms list is there)


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