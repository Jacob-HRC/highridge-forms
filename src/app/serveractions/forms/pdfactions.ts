// src/app/serveractions/forms/pdfactions.ts
'use server';

import { generateFormPdf } from "~/lib/pdf-generator";
import { getFormById } from "./reimburesementformactions";

export async function generateFormPdfAction(formId: number): Promise<{
    success: boolean;
    data?: Uint8Array;
    error?: string;
}> {
    try {
        // Get form data from database
        const formData = await getFormById(formId);

        if (!formData) {
            return {
                success: false,
                error: `Form with ID ${formId} not found.`
            };
        }

        // Generate PDF from form data
        const pdfBuffer = await generateFormPdf(formData);

        return {
            success: true,
            data: pdfBuffer
        };
    } catch (error) {
        console.error('Error generating PDF:', error);
        return {
            success: false,
            error: `Error generating PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}