// src/components/Receipts.tsx
"use client";

import React from "react";
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { File } from "lucide-react";

interface Receipt {
    id: number;
    name: string;
}

interface ReceiptsProps {
    receipts?: Receipt[];
    isEditing: boolean;
    transactionId: number;
    onDeleteReceipt: (transactionId: number, receiptId: number) => void;
    control: any;
    fileFieldName: string;
}

export default function Receipts({
                                     receipts = [],
                                     isEditing,
                                     transactionId,
                                     onDeleteReceipt,
                                     control,
                                     fileFieldName,
                                 }: ReceiptsProps) {
    return (
        <div className="mt-4">
            <FormLabel>Receipts</FormLabel>
            <div className="flex flex-wrap gap-4 justify-center">
                {receipts.map((receipt) => (
                    <div key={receipt.id} className="flex flex-col items-center border p-2 rounded">
                        <File className="h-12 w-12 text-gray-500" />
                        <span className="mt-2 text-sm text-center break-all">{receipt.name}</span>
                        {isEditing && (
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="mt-2"
                                onClick={() => onDeleteReceipt(transactionId, receipt.id)}
                            >
                                Delete Receipt
                            </Button>
                        )}
                    </div>
                ))}
                {isEditing && (
                    <FormField
                        control={control}
                        name={fileFieldName}
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input
                                        type="file"
                                        multiple
                                        accept="image/*,.pdf"
                                        onChange={(e) => {
                                            field.onChange(e.target.files);
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
    );
}
