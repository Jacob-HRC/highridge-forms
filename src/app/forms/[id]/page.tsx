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
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "~/components/ui/select";

// Reuse the constants from the new form page
const ACCOUNT_LINES = ["General Fund", "Missions", "Church Plant"];
const DEPARTMENTS = ["Worship", "Youth", "Children", "Admin"];

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

type FormData = {
    id: number;
    submitterEmail: string;
    submitterName: string;
    reimbursedName: string;
    reimbursedEmail: string;
    transactions: {
        id: number;
        date: string;
        accountLine: string;
        department: string;
        placeVendor: string;
        description: string;
        amount: number;
        receipts: {
            id: number;
            fileType: string;
            base64Content: string;
        }[];
        newFiles?: FileList | null;
    }[];
};

export default function EditFormPage() {
    const params = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const form = useForm<FormData>();
    const { control, reset, handleSubmit } = form;

    const { fields } = useFieldArray({
        control,
        name: "transactions",
    });

    useEffect(() => {
        async function fetchForm() {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/forms/${params.id}`);
                if (!res.ok) {
                    throw new Error(`Failed to fetch form: ${res.status}`);
                }
                const data = await res.json();
                reset(data); // Populate the form with fetched data
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load form');
            } finally {
                setLoading(false);
            }
        }

        fetchForm();
    }, [params.id, reset]);

    // Add save handler
    async function onSubmit(data: FormData) {
        try {
            // Convert any new files to base64 before sending
            const formDataWithBase64 = {
                ...data,
                transactions: await Promise.all(
                    data.transactions.map(async (tx) => {
                        if (!tx.newFiles?.length) return tx;

                        const base64Files = await Promise.all(
                            Array.from(tx.newFiles).map(async (file) => ({
                                type: file.type,
                                base64Content: await fileToBase64(file)
                            }))
                        );

                        return {
                            ...tx,
                            newFiles: base64Files
                        };
                    })
                )
            };

            const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/forms/${params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formDataWithBase64),
            });

            if (!res.ok) throw new Error('Failed to update form');
            setIsEditing(false);
            // Refresh the form data
            const updatedData = await res.json();
            reset(updatedData);
        } catch (e) {
            console.error('Error updating form:', e);
            alert('Failed to update form');
        }
    }

    async function handleDeleteReceipt(transactionId: number, receiptId: number) {
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/forms/${params.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receiptId }),
            });

            if (!res.ok) throw new Error('Failed to delete receipt');

            // Refresh the form data
            const formRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/forms/${params.id}`);
            const updatedData = await formRes.json();
            reset(updatedData);
        } catch (e) {
            console.error('Error deleting receipt:', e);
            alert('Failed to delete receipt');
        }
    }

    if (loading) return <div className="p-6">Loading...</div>;
    if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

    return (
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">
                    {isEditing ? 'Edit Form' : 'View Form'}
                </h1>
                <div className="space-x-2">
                    {isEditing ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsEditing(false);
                                    reset();
                                }}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" form="form">
                                Save Changes
                            </Button>
                        </>
                    ) : (
                        <Button type="button" onClick={() => setIsEditing(true)}>
                            Edit Form
                        </Button>
                    )}
                </div>
            </div>

            <Form {...form}>
                <form id="form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Update form fields to be editable based on isEditing */}
                    <FormField
                        control={control}
                        name="reimbursedName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reimbursed Name</FormLabel>
                                <FormControl>
                                    <Input {...field} readOnly={!isEditing} />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={control}
                        name="reimbursedEmail"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reimbursed Email</FormLabel>
                                <FormControl>
                                    <Input {...field} type="email" readOnly={!isEditing} />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <hr className="my-6" />

                    <h2 className="text-xl font-semibold mb-4">Transactions</h2>

                    {fields.map((field, index) => (
                        <div key={field.id} className="border rounded p-4 mb-6 space-y-4">
                            <FormField
                                control={control}
                                name={`transactions.${index}.date`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date</FormLabel>
                                        <FormControl>
                                            <Input {...field} readOnly={!isEditing} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name={`transactions.${index}.accountLine`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Account Line</FormLabel>
                                        <FormControl>
                                            {isEditing ? (
                                                <Select
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {ACCOUNT_LINES.map((line) => (
                                                            <SelectItem key={line} value={line}>
                                                                {line}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <Input {...field} readOnly />
                                            )}
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name={`transactions.${index}.department`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Department</FormLabel>
                                        <FormControl>
                                            <Input {...field} readOnly={!isEditing} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name={`transactions.${index}.placeVendor`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Place/Vendor</FormLabel>
                                        <FormControl>
                                            <Input {...field} readOnly={!isEditing} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name={`transactions.${index}.description`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} readOnly={!isEditing} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name={`transactions.${index}.amount`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount (USD)</FormLabel>
                                        <FormControl>
                                            <Input {...field} type="number" readOnly={!isEditing} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            {/* Receipts section */}
                            <div className="mt-4">
                                <FormLabel>Receipts</FormLabel>
                                <div className="space-y-2">
                                    {field.receipts?.map((receipt, receiptIndex) => (
                                        <div key={receipt.id} className="border p-2 rounded">
                                            <img
                                                src={receipt.base64Content}
                                                alt={`Receipt ${receiptIndex + 1}`}
                                                className="max-w-full h-auto"
                                            />
                                            {isEditing && (
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="sm"
                                                    className="mt-2"
                                                    onClick={() => handleDeleteReceipt(field.id, receipt.id)}
                                                >
                                                    Delete Receipt
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    {isEditing && (
                                        <FormField
                                            control={control}
                                            name={`transactions.${index}.newFiles`}
                                            render={({ field: fileField }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input
                                                            type="file"
                                                            multiple
                                                            accept="image/*,.pdf"
                                                            onChange={(e) => {
                                                                fileField.onChange(e.target.files);
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div className="flex justify-between mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push('/dashboard')}
                        >
                            Back to Dashboard
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
} 