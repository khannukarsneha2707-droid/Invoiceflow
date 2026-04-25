import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

/**
 * Helper to convert a remote image URL to a base64 data URI.
 */
const imageUrlToBase64 = async (url: string): Promise<string | null> => {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (e) {
    return null;
  }
};

/**
 * Shared logic to create a professional jsPDF document for an invoice.
 */
const createInvoiceDoc = async (invoice: any, profile?: any) => {
  const doc = new jsPDF();
  
  // 1. Header & Branding
  if (profile?.avatarUrl) {
    const dataUri = await imageUrlToBase64(profile.avatarUrl);
    if (dataUri) {
      doc.addImage(dataUri, 'PNG', 14, 15, 30, 30, undefined, 'FAST');
    }
  }

  doc.setFontSize(20);
  doc.setTextColor(57, 96, 172);
  doc.setFont("helvetica", "bold");
  const bizName = profile?.companyName || "InvoiceFlow Seller";
  doc.text(bizName, 196 - doc.getTextWidth(bizName), 25);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  
  let currentY = 32;
  if (profile?.companyAddress) {
    doc.text(profile.companyAddress, 196 - doc.getTextWidth(profile.companyAddress), currentY);
    currentY += 5;
  }
  if (profile?.contactPhone) {
    doc.text(`Ph: ${profile.contactPhone}`, 196 - doc.getTextWidth(`Ph: ${profile.contactPhone}`), currentY);
    currentY += 5;
  }
  if (profile?.website) {
    doc.text(profile.website, 196 - doc.getTextWidth(profile.website), currentY);
  }

  doc.setDrawColor(230);
  doc.line(14, 50, 196, 50);

  doc.setFontSize(24);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 14, 65);
  
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.setFont("helvetica", "normal");
  const createdDate = invoice.createdAt ? format(new Date(invoice.createdAt), 'MMM dd, yyyy') : 'N/A';
  const dueDate = invoice.dueDate ? format(new Date(invoice.dueDate), 'MMM dd, yyyy') : 'N/A';
  
  doc.text(`Invoice #: ${invoice.id?.slice(-8).toUpperCase() || 'N/A'}`, 14, 73);
  doc.text(`Issued Date: ${createdDate}`, 14, 78);
  doc.text(`Due Date: ${dueDate}`, 14, 83);

  doc.setFontSize(12);
  doc.setTextColor(57, 96, 172);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO:", 14, 100);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(invoice.clientName || 'Valued Client', 14, 107);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(invoice.clientEmail || '', 14, 112);

  // 4. Items Table
  const items = invoice.items || [];
  const tableRows = items.map((item: any) => [
    item.description || 'Service/Product',
    item.quantity ? item.quantity.toString() : '1',
    `Rs. ${(item.unitPrice || 0).toFixed(2)}`,
    `Rs. ${(item.lineTotal || 0).toFixed(2)}`
  ]);

  autoTable(doc, {
    startY: 120,
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: tableRows,
    theme: 'grid',
    headStyles: { 
      fillColor: [57, 96, 172],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    styles: {
      fontSize: 10,
      cellPadding: 6
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35 }
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 120;
  
  // Financial Summary
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  
  const subtotalText = `Subtotal: Rs. ${(invoice.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  doc.text(subtotalText, 196 - doc.getTextWidth(subtotalText), finalY + 10);
  
  const taxText = `Tax (${invoice.taxRate || 0}%): Rs. ${(invoice.taxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  doc.text(taxText, 196 - doc.getTextWidth(taxText), finalY + 17);

  doc.setFontSize(16);
  doc.setTextColor(57, 96, 172);
  doc.setFont("helvetica", "bold");
  const totalText = `GRAND TOTAL: Rs. ${(invoice.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  doc.text(totalText, 196 - doc.getTextWidth(totalText), finalY + 28);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Payment Status: ${(invoice.status || 'pending').toUpperCase()}`, 14, finalY + 10);

  if (invoice.notes) {
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("NOTES:", 14, finalY + 25);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.notes, 14, finalY + 32, { maxWidth: 120 });
  }

  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text("Computer generated invoice. No signature required.", 105, 285, { align: 'center' });
  
  return doc;
}

export const generateInvoicePDF = async (invoice: any, profile?: any) => {
  const doc = await createInvoiceDoc(invoice, profile);
  const fileName = `Invoice_${(invoice.clientName || 'Export').replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};

export const getInvoicePDFBuffer = async (invoice: any, profile?: any) => {
  const doc = await createInvoiceDoc(invoice, profile);
  return Buffer.from(doc.output('arraybuffer'));
};
