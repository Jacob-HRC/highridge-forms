'use server';

import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import { forms, transactions, receipts } from "~/server/db/schema";
import { revalidatePath } from "next/cache";

export async function deleteForm(formId: number) {
    try {
        console.log('Server action: deleting form', formId);

        // First, get all transactions for this form
        const transactionsResult = await db.select().from(transactions).where(eq(transactions.formId, formId));

        // Delete all receipts for each transaction
        for (const transaction of transactionsResult) {
            await db.delete(receipts).where(eq(receipts.transactionId, transaction.id));
        }

        // Delete all transactions
        await db.delete(transactions).where(eq(transactions.formId, formId));

        // Finally, delete the form
        await db.delete(forms).where(eq(forms.id, formId));

        // Revalidate the dashboard page
        revalidatePath('/dashboard');

        return { success: true };
    } catch (error) {
        console.error('Error deleting form:', error);
        return {
            success: false,
            error: `Failed to delete form: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}