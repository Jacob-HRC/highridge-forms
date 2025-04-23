// src/lib/pdf-generator.ts
import { PDFDocument, rgb, StandardFonts, PDFImage, PDFPage, PDFEmbeddedPage } from 'pdf-lib';

// Define the TypeScript interfaces for the form data
interface FormReceipt {
    id: number;
    name: string;
    fileType: string;
    base64Content: string;
    transactionId?: number;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
}

interface FormTransaction {
    id?: number;
    transactionId?: number;
    date: Date | string | null;
    accountLine: string;
    department: string;
    placeVendor: string;
    description: string;
    amount: number;
    receipts?: FormReceipt[];
    formId?: number;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
}

interface FormDetails {
    id: number;
    userId: string;
    formType: string;
    submitterEmail: string;
    submitterName: string;
    reimbursedName: string;
    reimbursedEmail: string;
    createdAt: Date | string | null;
    updatedAt: Date | string | null;
}

interface FormData {
    form: FormDetails;
    transactions: FormTransaction[];
}

export async function generateFormPdf(formData: FormData): Promise<Uint8Array> {
    try {
        console.log("Starting PDF generation with data:", JSON.stringify({
            formId: formData.form?.id,
            formType: formData.form?.formType,
            transactionCount: formData.transactions?.length || 0
        }));

        // Validate input data structure to catch issues early
        if (!formData?.form || !formData?.transactions) {
            throw new Error("Invalid form data structure. Missing 'form' or 'transactions'.");
        }

        // Create a new PDF document
        const pdfDoc = await PDFDocument.create();

        // Embed the standard font
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Add the first page
        let page = pdfDoc.addPage([600, 800]);

        // Set some initial variables for positioning
        let currentPage = page;
        let yPos = 750;
        const margin = 50;
        const lineHeight = 15;
        const smallLineHeight = 12;

        // Function to ensure we have enough space on the page
        const ensureSpace = (requiredSpace: number): void => {
            if (yPos - requiredSpace < margin) {
                currentPage = pdfDoc.addPage([600, 800]);
                yPos = 750;
            }
        };

        // Function to add text with the specified font
        const addText = (text: string, x: number, y: number, size: number, selectedFont = font): void => {
            currentPage.drawText(text, {
                x,
                y,
                size,
                font: selectedFont,
            });
        };

        // Add title
        addText(`${formData.form.formType} Form`, 300 - (font.widthOfTextAtSize(`${formData.form.formType} Form`, 20) / 2), yPos, 20, boldFont);
        yPos -= lineHeight * 2;

        // Format date to a readable string
        const formatDate = (date: string | Date | null): string => {
            if (!date) return 'N/A';
            try {
                return new Date(date).toLocaleDateString();
            } catch (error) {
                console.error('Error formatting date:', date, error);
                return 'Invalid Date';
            }
        };

        // Calculate total amount
        const totalAmount = formData.transactions.reduce(
            (sum: number, tx: FormTransaction | undefined) => {
                if (!tx || typeof tx.amount !== 'number') return sum;
                return sum + tx.amount;
            },
            0
        );

        // Form Details section
        ensureSpace(100);
        addText('Form Details', margin, yPos, 16, boldFont);
        yPos -= lineHeight * 1.5;

        addText(`Form ID: ${formData.form.id}`, margin, yPos, 10);
        addText(`Created: ${formatDate(formData.form.createdAt)}`, margin + 150, yPos, 10);
        yPos -= lineHeight;

        addText(`Submitted By: ${formData.form.submitterName}`, margin, yPos, 10);
        addText(`Updated: ${formatDate(formData.form.updatedAt)}`, margin + 150, yPos, 10);
        yPos -= lineHeight;

        addText(`Submitter Email: ${formData.form.submitterEmail}`, margin, yPos, 10);
        addText(`Total Amount: $${totalAmount.toFixed(2)}`, margin + 150, yPos, 10);
        yPos -= lineHeight * 2;

        // Reimbursement Information section
        ensureSpace(80);
        addText('Reimbursement Information', margin, yPos, 16, boldFont);
        yPos -= lineHeight * 1.5;

        addText(`Reimbursed To: ${formData.form.reimbursedName}`, margin, yPos, 10);
        yPos -= lineHeight;

        addText(`Reimbursed Email: ${formData.form.reimbursedEmail}`, margin, yPos, 10);
        yPos -= lineHeight * 2;

        // Transactions section
        ensureSpace(40);
        addText('Transactions', margin, yPos, 16, boldFont);
        yPos -= lineHeight * 1.5;

        // Loop through each transaction
        for (let i = 0; i < formData.transactions.length; i++) {
            const transaction = formData.transactions[i];
            
            // Skip if transaction is undefined
            if (!transaction) {
                console.warn(`Transaction at index ${i} is undefined, skipping.`);
                continue;
            }

            ensureSpace(120); // Ensure enough space for transaction header and details

            // Transaction header
            addText(`Transaction #${i + 1}`, margin, yPos, 14, boldFont);
            yPos -= lineHeight * 1.5;

            // Transaction details
            addText(`Date: ${formatDate(transaction.date)}`, margin + 10, yPos, 10);
            yPos -= smallLineHeight;

            addText(`Account Line: ${transaction.accountLine || 'Not specified'}`, margin + 10, yPos, 10);
            yPos -= smallLineHeight;

            addText(`Department: ${transaction.department || 'Not specified'}`, margin + 10, yPos, 10);
            yPos -= smallLineHeight;

            addText(`Place/Vendor: ${transaction.placeVendor || 'Not specified'}`, margin + 10, yPos, 10);
            yPos -= smallLineHeight;

            addText(`Amount: $${(transaction.amount || 0).toFixed(2)}`, margin + 10, yPos, 10);
            yPos -= smallLineHeight;

            // Description might wrap, so we'll handle it differently
            addText('Description:', margin + 10, yPos, 10, boldFont);
            yPos -= smallLineHeight;

            const description = transaction.description || 'No description provided';
            addText(description, margin + 20, yPos, 10);
            yPos -= lineHeight * 1.5;

            // Handle receipts if they exist
            if (transaction.receipts && transaction.receipts.length > 0) {
                ensureSpace(40); // Ensure space for receipts header

                addText(`Receipts for Transaction #${i + 1}:`, margin + 10, yPos, 10, boldFont);
                yPos -= lineHeight;

                for (const receipt of transaction.receipts) {
                    // Skip if receipt is undefined
                    if (!receipt) {
                        console.warn(`Receipt in transaction ${transaction.id || i} is undefined, skipping.`);
                        continue;
                    }
                    try {
                        if (!receipt.base64Content) {
                            addText(`${receipt.name} (Content not available)`, margin + 20, yPos, 10);
                            yPos -= smallLineHeight;
                            continue;
                        }

                        // Display receipt name
                        addText(receipt.name, margin + 20, yPos, 10);
                        yPos -= lineHeight;

                        // Add image if it's an image type
                        if (receipt.fileType?.startsWith('image/')) {
                            ensureSpace(220); // Ensure space for image

                            // Extract the base64 content from the data URL
                            let base64Data = receipt.base64Content;
                            if (base64Data.startsWith('data:')) {
                                const commaIndex = base64Data.indexOf(',');
                                if (commaIndex !== -1) {
                                    base64Data = base64Data.substring(commaIndex + 1);
                                }
                            }

                            // Embed the image
                            let image: PDFImage | undefined;
                            if (receipt.fileType.includes('png')) {
                                image = await pdfDoc.embedPng(base64Data);
                            } else if (receipt.fileType.includes('jpg') || receipt.fileType.includes('jpeg')) {
                                image = await pdfDoc.embedJpg(base64Data);
                            }

                            if (image) {
                                // Calculate dimensions to fit within page width while maintaining aspect ratio
                                const maxWidth = 400;
                                const imgWidth = Math.min(image.width, maxWidth);
                                const imgHeight = image.height * (imgWidth / image.width);

                                // Check if the image fits on the current page
                                ensureSpace(imgHeight + 20);

                                // Draw the image
                                currentPage.drawImage(image, {
                                    x: margin + 20,
                                    y: yPos - imgHeight,
                                    width: imgWidth,
                                    height: imgHeight,
                                });

                                yPos -= (imgHeight + lineHeight);
                            }
                        } else if (receipt.fileType === 'application/pdf') {
                            // For PDF files, try to embed them
                            try {
                                // Extract base64 content
                                let base64Data = receipt.base64Content;
                                if (base64Data.startsWith('data:')) {
                                    const commaIndex = base64Data.indexOf(',');
                                    if (commaIndex !== -1) {
                                        base64Data = base64Data.substring(commaIndex + 1);
                                    }
                                }

                                // Convert base64 to Uint8Array
                                const binaryString = atob(base64Data);
                                const bytes = new Uint8Array(binaryString.length);
                                for (let i = 0; i < binaryString.length; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }

                                // Load the PDF
                                const embedPdf = await PDFDocument.load(bytes);
                                const [firstPage]: PDFEmbeddedPage[] = await pdfDoc.embedPdf(embedPdf, [0]);

                                // Add the PDF page
                                ensureSpace(300); // Ensure space for embedded PDF
                                const pdfPage: PDFPage = pdfDoc.addPage();

                                // Add text indicating this is an embedded receipt
                                pdfPage.drawText(`Embedded PDF Receipt: ${receipt.name}`, {
                                    x: 50,
                                    y: 750,
                                    size: 14,
                                    font: boldFont,
                                });

                                // Add the PDF page
                                if (firstPage) pdfPage.drawPage(firstPage, {
                                    x: 50,
                                    y: 50,
                                    width: 500,
                                    height: 650,
                                });

                                // Continue with the original page
                                currentPage = pdfDoc.addPage([600, 800]);
                                yPos = 750;
                            } catch (pdfError) {
                                console.error('Error embedding PDF:', pdfError);
                                addText(`${receipt.name} (PDF could not be embedded)`, margin + 20, yPos, 10);
                                yPos -= smallLineHeight;
                            }
                        } else {
                            addText(`${receipt.name} (${receipt.fileType || 'Unknown type'})`, margin + 20, yPos, 10);
                            yPos -= smallLineHeight;
                        }
                    } catch (receiptError) {
                        console.error('Error processing receipt:', receiptError);
                        addText(`${receipt.name} (Error processing receipt)`, margin + 20, yPos, 10);
                        yPos -= smallLineHeight;
                    }
                }
            }

            // Add separator between transactions (except for the last one)
            if (i < formData.transactions.length - 1) {
                yPos -= lineHeight;

                // Draw a line
                currentPage.drawLine({
                    start: { x: margin, y: yPos + 5 },
                    end: { x: 550, y: yPos + 5 },
                    thickness: 1,
                    color: rgb(0.8, 0.8, 0.8),
                });

                yPos -= lineHeight;
            }
        }

        // Serialize the PDF to bytes
        const pdfBytes = await pdfDoc.save();
        console.log("PDF generated successfully, buffer size:", pdfBytes.length);

        return pdfBytes;
    } catch (error) {
        console.error('Error generating PDF:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
            console.error('Error stack:', error.stack);
        }
        throw error;
    }
}