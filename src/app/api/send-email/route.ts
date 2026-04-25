import nodemailer from 'nodemailer';
import { getInvoicePDFBuffer } from '@/lib/pdf-generator';
import { db } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const { clientEmail, clientName, amount, dueDate, invoice, profile } = await req.json();

    const pdfBuffer = await getInvoicePDFBuffer(invoice, profile);

    // Save to publicInvoices
    await db.collection('publicInvoices').doc(invoice.id).set({
      invoiceId: invoice.id,
      clientName,
      clientEmail,
      totalAmount: amount,
      status: 'pending',
      dueDate,
      createdAt: invoice.createdAt || new Date().toISOString(),
      issuedOn: new Date().toISOString(),
      notes: invoice.notes || '',
      items: invoice.items || [],
      subtotal: invoice.subtotal || 0,
      taxAmount: invoice.taxAmount || 0,
      taxRate: invoice.taxRate || 0,
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    const invoiceUrl = `${baseUrl || 'https://invoiceflow--studio-9039589583-c1797.asia-east1.hosted.app'}/invoice/${invoice.id}`;
    
    console.log("Invoice URL:", invoiceUrl);
    
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: clientEmail,
      subject: `Payment Reminder - ₹${amount}`,
      html: `
        <h2>Hello ${clientName},</h2>
        <p>Your payment of <b>₹${amount}</b> is due on <b>${dueDate}</b>.</p>
        <p>Please complete your payment.</p>
        <p>Pay Now: ${invoiceUrl}</p>
        <p>Click here to pay: <a href="${invoiceUrl}">Pay Now</a></p>
      `,
      attachments: [
        {
          filename: `Invoice_${invoice.id || 'export'}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ success: false, error: 'Failed to send email' });
  }
}
