// src/components/form-pdf-button.tsx
"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { FileText } from "lucide-react";
import { getFormById } from "~/app/serveractions/forms/reimburesementformactions";
import { generateFormPdf } from "~/lib/pdf-generator";

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

            // Generate the PDF using our pdf-lib generator
            const pdfBytes = await generateFormPdf(formData);

            // Create a blob from the PDF bytes
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });

            // Create a URL for the blob
            const url = URL.createObjectURL(blob);

            // Create a link element and trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = `${formTitle.toLowerCase().replace(/\s+/g, "-")}-${formId}.pdf`;
            document.body.appendChild(link);
            link.click();

            // Clean up
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            console.log("PDF generated and download triggered successfully");

        } catch (error) {
            console.error("Error generating PDF:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            setErrorMessage(message);
            alert(`Failed to generate PDF: ${message}`);
        } finally {
            setIsGenerating(false);
        }
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