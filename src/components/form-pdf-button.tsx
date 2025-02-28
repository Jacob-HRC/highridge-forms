// src/components/form-pdf-button.tsx
"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { FileText } from "lucide-react";
import { getFormById } from "~/app/serveractions/forms/reimburesementformactions";
import { jsPDF } from "jspdf";

interface FormPdfButtonProps {
    formId: number;
    formTitle?: string;
}

export default function FormPdfButton({ formId, formTitle = "form" }: FormPdfButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleGeneratePdf = async () => {
        try {
            setIsGenerating(true);
            setErrorMessage(null);

            console.log("Starting PDF generation for form ID:", formId);

            // Get the form data using the server action
            const formData = await getFormById(formId);

            if (!formData) {
                throw new Error(`Form with ID ${formId} not found.`);
            }

            // Create a new PDF document
            const doc = new jsPDF();

            // Add title
            doc.setFontSize(18);
            doc.text(`${formData.form.formType} Form`, 105, 15, { align: 'center' });

            // Form Details
            doc.setFontSize(14);
            doc.text('Form Details', 14, 30);

            doc.setFontSize(10);
            doc.text(`Form ID: ${formData.form.id}`, 14, 40);
            doc.text(`Created: ${formatDate(formData.form.createdAt)}`, 14, 45);
            doc.text(`Updated: ${formatDate(formData.form.updatedAt)}`, 14, 50);
            doc.text(`Submitted By: ${formData.form.submitterName}`, 14, 55);
            doc.text(`Submitter Email: ${formData.form.submitterEmail}`, 14, 60);

            // Calculate total amount
            const totalAmount = formData.transactions.reduce((sum, tx) => sum + tx.amount, 0);
            doc.text(`Total Amount: $${totalAmount.toFixed(2)}`, 14, 65);

            // Reimbursement Information
            doc.setFontSize(14);
            doc.text('Reimbursement Information', 14, 75);

            doc.setFontSize(10);
            doc.text(`Reimbursed To: ${formData.form.reimbursedName}`, 14, 85);
            doc.text(`Reimbursed Email: ${formData.form.reimbursedEmail}`, 14, 90);

            // Transactions
            doc.setFontSize(14);
            doc.text('Transactions', 14, 100);

            let yPos = 110;

            // Loop through transactions
            formData.transactions.forEach((transaction, index) => {
                // Check if we need a new page
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.setFontSize(12);
                doc.text(`Transaction #${index + 1}`, 14, yPos);
                yPos += 10;

                doc.setFontSize(10);
                doc.text(`Date: ${formatDate(new Date(transaction.date))}`, 20, yPos);
                yPos += 5;
                doc.text(`Account Line: ${transaction.accountLine}`, 20, yPos);
                yPos += 5;
                doc.text(`Department: ${transaction.department}`, 20, yPos);
                yPos += 5;
                doc.text(`Place/Vendor: ${transaction.placeVendor}`, 20, yPos);
                yPos += 5;
                doc.text(`Amount: $${transaction.amount.toFixed(2)}`, 20, yPos);
                yPos += 5;
                doc.text(`Description: ${transaction.description}`, 20, yPos);
                yPos += 10;

                // Add receipts information
                if (transaction.receipts && transaction.receipts.length > 0) {
                    doc.text(`Receipts for Transaction #${index + 1}:`, 20, yPos);
                    yPos += 5;

                    transaction.receipts.forEach(receipt => {
                        doc.text(`- ${receipt.name} (${receipt.fileType || 'Unknown type'})`, 25, yPos);
                        yPos += 5;

                        // Note: We're not embedding images here as it requires additional processing
                        // and can be complex to handle in client-side code
                    });
                }

                yPos += 10;
            });

            // Save the PDF
            doc.save(`${formTitle.toLowerCase().replace(/\s+/g, "-")}-${formId}.pdf`);

            console.log("PDF generated successfully");

        } catch (error) {
            console.error("Error generating PDF:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            setErrorMessage(message);
            alert(`Failed to generate PDF: ${message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    // Helper function to format dates
    const formatDate = (date: Date | null) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString();
    };

    return (
        <div className="flex flex-col">
            <Button
                onClick={handleGeneratePdf}
                disabled={isGenerating}
                className="flex items-center gap-2"
            >
                <FileText className="h-4 w-4" />
                {isGenerating ? "Generating..." : "Download PDF"}
            </Button>

            {errorMessage && (
                <div className="mt-2 flex items-center gap-2 text-red-500 text-sm">
                    <span>{errorMessage}</span>
                </div>
            )}
        </div>
    );
}