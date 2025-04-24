// src/components/Receipts.tsx
"use client";

import React from "react";
import { FormField, FormItem, FormControl, FormMessage, FormLabel } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { File, Loader2 } from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import Image from "next/image";
import type { Control, FieldValues, Path } from "react-hook-form";

export interface Receipt {
    id: number;
    name: string;
    fileType?: string;
    base64Content?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

interface ReceiptsProps<T extends FieldValues = FieldValues> {
    receipts?: Receipt[];
    isEditing: boolean;
    isLoading?: boolean;
    transactionId: number;
    onDeleteReceipt: (transactionId: number, receiptId: number) => void;
    control: Control<T>;
    fileFieldName: Path<T>;
}

export default function Receipts<T extends FieldValues = FieldValues>({
    receipts = [],
    isEditing,
    isLoading = false,
    transactionId,
    onDeleteReceipt,
    control,
    fileFieldName,
}: ReceiptsProps<T>) {
    return (
        <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
                <FormLabel>Receipts</FormLabel>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
            </div>
            
            <div className="flex flex-wrap gap-4 justify-center">
                {isLoading ? (
                    // Loading skeleton for receipts
                    <>
                        <Skeleton className="h-24 w-24 rounded" />
                        <Skeleton className="h-24 w-24 rounded" />
                    </>
                ) : (
                    // Display actual receipts
                    <>
                        {receipts && receipts.length > 0 ? (
                            receipts.map((receipt) => (
                                <div key={receipt.id} className="flex flex-col items-center border border-border/40 hover:border-border/80 bg-card text-card-foreground p-2 rounded transition-colors">
                                    {receipt.fileType?.startsWith('image/') && receipt.base64Content ? (
                                        <div className="w-24 h-24 flex items-center justify-center overflow-hidden">
                                            <Image 
                                                src={receipt.base64Content.startsWith('data:') 
                                                    ? receipt.base64Content 
                                                    : `data:${receipt.fileType};base64,${receipt.base64Content}`} 
                                                alt={receipt.name}
                                                className="max-w-full max-h-full object-contain"
                                                width={96}
                                                height={96}
                                                priority
                                            />
                                        </div>
                                    ) : (
                                        <File className="h-12 w-12 text-muted-foreground" />
                                    )}
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
                            ))
                        ) : (
                            <div className="text-gray-500 italic">No receipts attached</div>
                        )}
                        
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
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    if (e.target.files) {
                                                        field.onChange(e.target.files);
                                                    }
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
