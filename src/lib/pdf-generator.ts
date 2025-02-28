// src/lib/pdf-generator.ts
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

// Configure pdfMake with the virtual file system for fonts
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

// Define default fonts
pdfMake.fonts = {
    Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
    }
};

export function generateFormPdf(formData: any): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
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

            // Calculate total amount - with fallback values for safety
            const totalAmount = formData.transactions.reduce(
                (sum: number, tx: any) => sum + (typeof tx.amount === 'number' ? tx.amount : 0),
                0
            );

            // Format date to a readable string
            const formatDate = (date: Date | null) => {
                if (!date) return 'N/A';
                return new Date(date).toLocaleDateString();
            };

            // Create document definition with explicit font settings
            const docDefinition: TDocumentDefinitions = {
                // Explicitly set the default font
                defaultStyle: {
                    font: 'Roboto'
                },
                content: [
                    // Header
                    {
                        text: `${formData.form.formType} Form`,
                        style: 'header',
                        alignment: 'center',
                        margin: [0, 0, 0, 20],
                    },

                    // Form details
                    {
                        text: 'Form Details',
                        style: 'subheader',
                        margin: [0, 20, 0, 10],
                    },
                    {
                        columns: [
                            {
                                width: '50%',
                                text: [
                                    { text: 'Form ID: ', bold: true },
                                    `${formData.form.id}\n`,
                                    { text: 'Created: ', bold: true },
                                    `${formatDate(formData.form.createdAt)}\n`,
                                    { text: 'Updated: ', bold: true },
                                    `${formatDate(formData.form.updatedAt)}\n`,
                                ],
                            },
                            {
                                width: '50%',
                                text: [
                                    { text: 'Submitted By: ', bold: true },
                                    `${formData.form.submitterName}\n`,
                                    { text: 'Submitter Email: ', bold: true },
                                    `${formData.form.submitterEmail}\n`,
                                    { text: 'Total Amount: ', bold: true },
                                    `$${totalAmount.toFixed(2)}\n`,
                                ],
                            },
                        ],
                    },

                    // Reimbursement details
                    {
                        text: 'Reimbursement Information',
                        style: 'subheader',
                        margin: [0, 20, 0, 10],
                    },
                    {
                        columns: [
                            {
                                width: '50%',
                                text: [
                                    { text: 'Reimbursed To: ', bold: true },
                                    `${formData.form.reimbursedName}\n`,
                                ],
                            },
                            {
                                width: '50%',
                                text: [
                                    { text: 'Reimbursed Email: ', bold: true },
                                    `${formData.form.reimbursedEmail}\n`,
                                ],
                            },
                        ],
                    },

                    // Transactions
                    {
                        text: 'Transactions',
                        style: 'subheader',
                        margin: [0, 20, 0, 10],
                    },
                ],
                styles: {
                    header: {
                        fontSize: 24,
                        bold: true,
                        font: 'Roboto' // Explicitly set font for this style
                    },
                    subheader: {
                        fontSize: 16,
                        bold: true,
                        font: 'Roboto' // Explicitly set font for this style
                    },
                    tableHeader: {
                        bold: true,
                        fontSize: 12,
                        color: 'black',
                        fillColor: '#eeeeee',
                        font: 'Roboto' // Explicitly set font for this style
                    },
                },
            };

            // Add each transaction with its receipts
            formData.transactions.forEach((transaction: any, index: number) => {
                const transactionContent = {
                    stack: [
                        {
                            text: `Transaction #${index + 1}`,
                            style: 'subheader',
                            margin: [0, 10, 0, 5],
                        },
                        {
                            table: {
                                headerRows: 1,
                                widths: ['*', '*', '*', '*', '*'],
                                body: [
                                    [
                                        { text: 'Date', style: 'tableHeader' },
                                        { text: 'Account Line', style: 'tableHeader' },
                                        { text: 'Department', style: 'tableHeader' },
                                        { text: 'Place/Vendor', style: 'tableHeader' },
                                        { text: 'Amount', style: 'tableHeader' },
                                    ],
                                    [
                                        formatDate(new Date(transaction.date)),
                                        transaction.accountLine,
                                        transaction.department,
                                        transaction.placeVendor,
                                        `$${transaction.amount.toFixed(2)}`,
                                    ],
                                ],
                            },
                            margin: [0, 5, 0, 10],
                        },
                        {
                            text: 'Description:',
                            bold: true,
                            margin: [0, 5, 0, 2],
                        },
                        {
                            text: transaction.description,
                            margin: [0, 0, 0, 10],
                        },
                    ],
                };

                (docDefinition.content as any[]).push(transactionContent);

                // Add receipts if they exist
                if (transaction.receipts && transaction.receipts.length > 0) {
                    (docDefinition.content as any[]).push({
                        text: `Receipts for Transaction #${index + 1}:`,
                        bold: true,
                        margin: [0, 10, 0, 5],
                    });

                    transaction.receipts.forEach((receipt: any) => {
                        try {
                            // Check if the receipt has valid content
                            if (!receipt.base64Content) {
                                console.warn(`Receipt ${receipt.id} has no base64Content, skipping image render`);
                                (docDefinition.content as any[]).push({
                                    text: `${receipt.name} (Content not available)`,
                                    margin: [0, 5, 0, 10],
                                });
                                return;
                            }

                            // Only add images, not other file types
                            if (receipt.fileType?.startsWith('image/')) {
                                try {
                                    // Try to parse the base64 content
                                    let imageData = receipt.base64Content;

                                    // Ensure we have a valid data URL format
                                    if (!imageData.startsWith('data:')) {
                                        imageData = `data:${receipt.fileType};base64,${imageData}`;
                                    }

                                    (docDefinition.content as any[]).push({
                                        text: receipt.name,
                                        margin: [0, 5, 0, 2],
                                    });
                                    (docDefinition.content as any[]).push({
                                        image: imageData,
                                        width: 400,
                                        margin: [0, 5, 0, 20],
                                    });
                                } catch (imageError) {
                                    console.error(`Error processing image receipt ${receipt.id}:`, imageError);
                                    (docDefinition.content as any[]).push({
                                        text: `${receipt.name} (Error processing image)`,
                                        margin: [0, 5, 0, 10],
                                    });
                                }
                            } else {
                                // For non-image receipts (like PDFs), just show the filename
                                (docDefinition.content as any[]).push({
                                    text: `Receipt (${receipt.fileType || 'Unknown type'}): ${receipt.name}`,
                                    margin: [0, 5, 0, 10],
                                });
                            }
                        } catch (receiptError) {
                            console.error(`Error processing receipt:`, receiptError);
                            (docDefinition.content as any[]).push({
                                text: `Receipt (processing error): ${receipt.name || 'Unknown receipt'}`,
                                margin: [0, 5, 0, 10],
                            });
                        }
                    });
                }

                // Add a separator between transactions (except for the last one)
                if (index < formData.transactions.length - 1) {
                    (docDefinition.content as any[]).push({
                        canvas: [
                            {
                                type: 'line',
                                x1: 0,
                                y1: 5,
                                x2: 515,
                                y2: 5,
                                lineWidth: 1,
                                lineColor: '#CCCCCC',
                            },
                        ],
                        margin: [0, 10, 0, 10],
                    });
                }
            });

            // Create PDF and return as Uint8Array
            console.log("Creating PDF document...");
            const pdfDocGenerator = pdfMake.createPdf(docDefinition);
            pdfDocGenerator.getBuffer((buffer) => {
                console.log("PDF generated successfully, buffer size:", buffer.length);
                resolve(buffer);
            });
        } catch (error) {
            console.error('Error generating PDF:', error);
            if (error instanceof Error) {
                console.error('Error details:', error.message);
                console.error('Error stack:', error.stack);
            }
            reject(error);
        }
    });
}