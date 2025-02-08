import { forms, transactions, receipts } from "~/server/db/schema";
import { db } from "~/server/db";
import { Transaction, FormValues } from "~/app/forms/new/page";

export async function GET(request: Request) {
  try {
    // Fetch forms from the database
    const dbforms = await db.select().from(forms); // Replace 'forms' with your table name

    // Return the forms as a JavaScript object
    return new Response(JSON.stringify(dbforms), {
      status: 200,
    });
  } catch (error) {
    console.error('Error fetching forms:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
    });
  }
}

export async function POST(req: Request) {
  try {
    const formData: FormValues = await req.json();

    const formEntry = {
      userId: formData.userId,
      submitterEmail: formData.submitterEmail,
      submitterName: formData.submitterName,
      reimbursedName: formData.reimbursedName,
      reimbursedEmail: formData.reimbursedEmail,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies typeof forms.$inferInsert;

    // Insert form
    const result = await db.insert(forms).values(formEntry).$dynamic();
    const newFormId = result[0].insertId;

    // Insert transactions and their receipts
    for (const tx of formData.transactions) {
      // Insert transaction
      const txResult = await db.insert(transactions)
        .values({
          formId: newFormId,
          date: new Date(tx.date),
          accountLine: tx.accountLine,
          department: tx.department,
          placeVendor: tx.placeVendor,
          description: tx.description,
          amount: parseFloat(tx.amount || "0"),
        }).$dynamic();
      const newTransactionId = txResult[0].insertId;

      // Insert receipts if they exist
      if (tx.files) {
        const receiptsData = await Promise.all(
          Array.from(tx.files).map(async (file) => {
            const base64 = await fileToBase64(file);
            return {
              transactionId: newTransactionId,
              fileType: file.type,
              base64Content: base64,
            };
          })
        );
        await db.insert(receipts).values(receiptsData);
      }
    }

    return new Response(JSON.stringify({ message: 'Form submitted successfully', data: newFormId }), {
      status: 201,
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
    });
  }
}

// Helper function: Convert File to a base64 string.
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


