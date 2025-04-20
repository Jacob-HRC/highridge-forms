import { z } from "zod";

export const receiptSchema = z.object({
    id: z.number(),
    name: z.string(),
    fileType: z.string(),
    base64Content: z.string(),
    createdAt: z.date().default(new Date()),
    updatedAt: z.date().default(new Date()),
});

export const transactionSchema = z.object({
    id: z.number().optional(),
    date: z.date(),
    createdAt: z.date().default(new Date()),
    updatedAt: z.date().default(new Date()),
    accountLine: z.string().min(1, "Account line is required"),
    department: z.string().min(1, "Department is required"),
    placeVendor: z.string().min(1, "Place/Vendor is required"),
    description: z.string().min(1, "Description is required"),
    amount: z.coerce.number().min(1, "Amount is required"),
    receipts: z.array(receiptSchema).optional(),
    newFiles: z.any().optional().nullable(),
});

export const reimbursementFormSchema = z.object({
    id: z.number(),
    userId: z.string(),
    formType: z.string(),
    submitterEmail: z.string().email("Invalid email"),
    submitterName: z.string().min(1, "Name is required"),
    reimbursedName: z.string().min(1, "Reimbursed name is required"),
    reimbursedEmail: z.string().email("Invalid email"),
    createdAt: z.date().default(new Date()),
    updatedAt: z.date().default(new Date()),
    transactions: z.array(transactionSchema).min(1, "At least one transaction is required"),
});

export type FormValues = z.infer<typeof reimbursementFormSchema>; 