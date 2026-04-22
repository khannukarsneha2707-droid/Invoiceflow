
'use server';

import nodemailer from 'nodemailer';

interface SendInvoiceEmailParams {
  to: string;
  clientName: string;
  invoiceNumber: string;
  pdfBase64: string;
  paymentUrl?: string; 
  isReminder?: boolean;
}

export async function sendInvoiceEmail({ to, clientName, invoiceNumber, pdfBase64, paymentUrl, isReminder }: SendInvoiceEmailParams) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error('Email service is not configured. Please add SMTP credentials to your project settings.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(port),
    secure: port === '465',
    auth: { user, pass },
  });

  const base64Content = pdfBase64.split(';base64,').pop() || '';
  const subject = isReminder 
    ? `PAYMENT REMINDER: Invoice ${invoiceNumber} is overdue` 
    : `Invoice ${invoiceNumber} from InvoiceFlow`;

  const heading = isReminder ? 'Payment Reminder' : `New Invoice for ${clientName}`;
  const intro = isReminder 
    ? `This is a friendly reminder that your payment for invoice <strong>${invoiceNumber}</strong> is currently overdue.`
    : `Please find your invoice <strong>${invoiceNumber}</strong> attached to this email.`;

  try {
    const info = await transporter.sendMail({
      from: `"InvoiceFlow" <${user}>`,
      to,
      subject,
      text: isReminder 
        ? `Hello ${clientName},\n\nThis is a reminder that invoice ${invoiceNumber} is overdue. Please find it attached.\n\nView & Pay: ${paymentUrl}\n\nBest regards,\nInvoiceFlow Team`
        : `Hello ${clientName},\n\nPlease find your invoice ${invoiceNumber} attached.\n\n${paymentUrl ? `You can also view and pay online here: ${paymentUrl}` : ''}\n\nBest regards,\nInvoiceFlow Team`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: ${isReminder ? '#E11D48' : '#3960AC'};">${heading}</h2>
          <p>Hello <strong>${clientName}</strong>,</p>
          <p>${intro}</p>
          
          ${paymentUrl ? `
            <div style="margin: 30px 0; text-align: center;">
              <a href="${paymentUrl}" style="background-color: ${isReminder ? '#E11D48' : '#19C3D6'}; color: white; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">${isReminder ? 'Pay Overdue Invoice' : 'View & Pay Online'}</a>
              <p style="font-size: 11px; color: #999; margin-top: 10px;">Safe & Secure Payment via Razorpay</p>
            </div>
          ` : ''}

          <p>If you have already sent the payment, please disregard this message.</p>
          <br/>
          <p>Best regards,<br/><strong>InvoiceFlow Team</strong></p>
        </div>
      `,
      attachments: [
        {
          filename: `Invoice_${invoiceNumber}.pdf`,
          content: base64Content,
          encoding: 'base64',
        },
      ],
    });

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending email:', error);
    throw new Error(error.message || 'Failed to send email.');
  }
}

