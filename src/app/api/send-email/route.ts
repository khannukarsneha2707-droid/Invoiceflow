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
      userId: invoice.userId,
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
    
    // Fetch template
    const templateDoc = await db.collection("users").doc(invoice.userId).collection("settings").doc("emailTemplate").get();
    const template = templateDoc.data();

    // Default template variables
    let subject = template?.subject || "Invoice [[INVOICE_ID]] from [[SENDER_NAME]]";
    let body = template?.body || "Hi [[CUSTOMER_NAME]],\n\nYour payment of ₹[[AMOUNT]] is due.\n\nPay here:\n[[PAYMENT_LINK]]\n\nThank you,\n[[SENDER_NAME]]";

    // Replace variables
    subject = subject
      .replaceAll('[[INVOICE_ID]]', invoice.id || '')
      .replaceAll('[[SENDER_NAME]]', profile?.companyName || '');

    body = body
      .replaceAll('[[CUSTOMER_NAME]]', clientName || '')
      .replaceAll('[[INVOICE_ID]]', invoice.id || '')
      .replaceAll('[[AMOUNT]]', amount || '')
      .replaceAll('[[PAYMENT_LINK]]', invoiceUrl)
      .replaceAll('[[SENDER_NAME]]', profile?.companyName || '');

    const htmlBody = body.replace(/\n/g, '<br/>');
    
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: clientEmail,
      subject: subject,
      html: htmlBody,
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
