// src/components/Receipts.tsx
"use client";

import React, { useState } from "react";
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
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);
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
                                                multiple={receipts.length < 1} // Allow multiple only if there are no receipts yet
                                                accept="image/*,.pdf"
                                                disabled={receipts.length >= 2} // Disable if already have 2 receipts
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    setUploadStatus(null);
                                                    if (e.target.files) {
                                                        try {
                                                            // Log the files
                                                            console.log('Files selected:', e.target.files.length);
                                                            
                                                            // Validate file count
                                                            const totalFiles = receipts.length + e.target.files.length;
                                                            if (totalFiles > 2) {
                                                                setUploadStatus("Too many files: maximum 2 receipts allowed");
                                                                e.target.value = ''; // Clear selection
                                                                return;
                                                            }
                                                            
                                                            // Create a real array from the FileList for validation and more reliable handling
                                                            const fileArray = Array.from(e.target.files);
                                                            
                                                            // Validate file size - 2MB max (to avoid base64 encoding issues)
                                                            const maxSize = 2 * 1024 * 1024; // 2MB
                                                            for (const file of fileArray) {
                                                                if (file.size > maxSize) {
                                                                    setUploadStatus(`File "${file.name}" exceeds the maximum size limit of 2MB`);
                                                                    e.target.value = ''; // Clear selection
                                                                    return;
                                                                }
                                                                
                                                                // Validate file type
                                                                const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
                                                                if (!validTypes.includes(file.type)) {
                                                                    setUploadStatus(`File "${file.name}" has an unsupported format. Please upload images (JPEG, PNG, GIF, WebP) or PDF files.`);
                                                                    e.target.value = ''; // Clear selection
                                                                    return;
                                                                }
                                                            }
                                                            
                                                            // All validation passed - set files to form
                                                            setUploadStatus(`Selected ${fileArray.length} file(s) successfully`);
                                                            field.onChange(fileArray); // Pass the array instead of FileList
                                                        } catch (error) {
                                                            console.error('Error handling file selection:', error);
                                                            setUploadStatus(`Error processing files: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                                            e.target.value = ''; // Clear selection
                                                        }
                                                    }
                                                }}
                                                className={receipts.length >= 2 ? "opacity-50 cursor-not-allowed" : ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                        {receipts.length >= 2 && (
                                            <p className="text-amber-400 text-sm mt-1">
                                                Maximum number of receipts (2) reached. Delete an existing receipt to upload a new one.
                                            </p>
                                        )}
                                        {uploadStatus && (
                                            <p className={`text-sm mt-1 ${uploadStatus.includes('Error') || uploadStatus.includes('Too many') ? 'text-red-400' : 'text-green-400'}`}>
                                                {uploadStatus}
                                            </p>
                                        )}
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
