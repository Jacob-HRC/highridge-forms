import { db } from "~/server/db";
import { forms, transactions, receipts } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const { id } = await params;
    try {
        const [form] = await db
            .select()
            .from(forms)
            .where(eq(forms.id, parseInt(id)))
            .limit(1);

        if (!form) {
            return new Response(JSON.stringify({ error: "Form not found" }), {
                status: 404,
            });
        }

        // Get transactions for this form
        const formTransactions = await db
            .select()
            .from(transactions)
            .where(eq(transactions.formId, form.id));

        // Get receipts for each transaction
        const transactionsWithReceipts = await Promise.all(
            formTransactions.map(async (tx) => {
                const txReceipts = await db
                    .select()
                    .from(receipts)
                    .where(eq(receipts.transactionId, tx.id));
                return { ...tx, receipts: txReceipts };
            })
        );

        return new Response(
            JSON.stringify({
                ...form,
                transactions: transactionsWithReceipts
            }),
            { status: 200 }
        );
    } catch (error) {
        console.error("Error fetching form:", error);
        return new Response(
            JSON.stringify({ error: "Internal Server Error" }),
            { status: 500 }
        );
    }
}

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    const { id } = await params;
    try {
        const data = await request.json();

        // Update form
        await db
            .update(forms)
            .set({
                reimbursedName: data.reimbursedName,
                reimbursedEmail: data.reimbursedEmail,
                updatedAt: new Date(),
            })
            .where(eq(forms.id, parseInt(id)));

        // Update transactions and handle receipts
        for (const tx of data.transactions) {
            if (tx.id < 0) { // If ID is negative, it's a new transaction
                // Insert new transaction
                await db
                    .insert(transactions)
                    .values({
                        formId: parseInt(id),
                        date: new Date(tx.date),
                        accountLine: tx.accountLine,
                        department: tx.department,
                        placeVendor: tx.placeVendor,
                        description: tx.description,
                        amount: tx.amount,
                    });

                // Get the newly inserted transaction
                const [newTx] = await db
                    .select()
                    .from(transactions)
                    .where(eq(transactions.formId, parseInt(id)))
                    .orderBy(sql`id desc`)
                    .limit(1);

                if (!newTx) {
                    throw new Error("Failed to create new transaction");
                }

                // Handle new receipts if any
                if (tx.newFiles?.length) {
                    const receiptsData = tx.newFiles.map((file: any) => ({
                        transactionId: newTx.id,
                        fileType: file.type,
                        base64Content: file.base64Content,
                    }));
                    await db.insert(receipts).values(receiptsData);
                }
            } else {
                // Update existing transaction
                await db
                    .update(transactions)
                    .set({
                        date: new Date(tx.date),
                        accountLine: tx.accountLine,
                        department: tx.department,
                        placeVendor: tx.placeVendor,
                        description: tx.description,
                        amount: tx.amount,
                    })
                    .where(eq(transactions.id, tx.id));

                // Handle new receipts if any
                if (tx.newFiles?.length) {
                    const receiptsData = tx.newFiles.map((file: any) => ({
                        transactionId: tx.id,
                        fileType: file.type,
                        base64Content: file.base64Content,
                    }));
                    await db.insert(receipts).values(receiptsData);
                }
            }
        }

        // Fetch and return updated form with transactions and receipts
        const [updatedForm] = await db
            .select()
            .from(forms)
            .where(eq(forms.id, parseInt(id)))
            .limit(1);

        if (!updatedForm) {
            return new Response(JSON.stringify({ error: "Form not found" }), {
                status: 404
            });
        }

        const formTransactions = await db
            .select()
            .from(transactions)
            .where(eq(transactions.formId, updatedForm.id));

        const transactionsWithReceipts = await Promise.all(
            formTransactions.map(async (tx) => {
                const txReceipts = await db
                    .select()
                    .from(receipts)
                    .where(eq(receipts.transactionId, tx.id));
                return { ...tx, receipts: txReceipts };
            })
        );

        return new Response(
            JSON.stringify({
                ...updatedForm,
                transactions: transactionsWithReceipts,
            }),
            { status: 200 }
        );
    } catch (error) {
        console.error("Error updating form:", error);
        return new Response(
            JSON.stringify({ error: "Internal Server Error" }),
            { status: 500 }
        );
    }
}

// Add DELETE endpoint for receipts
export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    const { id } = await params;
    try {
        const { receiptId } = await request.json();
        await db
            .delete(receipts)
            .where(eq(receipts.id, receiptId));

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) {
        console.error("Error deleting receipt:", error);
        return new Response(
            JSON.stringify({ error: "Internal Server Error" }),
            { status: 500 }
        );
    }
} 