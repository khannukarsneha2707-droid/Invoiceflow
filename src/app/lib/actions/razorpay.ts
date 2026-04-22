
'use server';

import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

interface CreateOrderParams {
  amount: number;
  invoiceId: string;
}

export async function createRazorpayOrder({ amount, invoiceId }: CreateOrderParams) {
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay Key Secret is not configured.');
  }

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay expects paise (₹1 = 100 paise)
      currency: 'INR',
      receipt: invoiceId,
      notes: {
        invoiceId: invoiceId,
      },
    });

    return {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    };
  } catch (error: any) {
    console.error('Razorpay Order Error:', error);
    throw new Error(error.message || 'Could not create payment order.');
  }
}

interface VerifyPaymentParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

export async function verifyRazorpayPayment({
  orderId,
  paymentId,
  signature,
}: VerifyPaymentParams) {
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const body = orderId + '|' + paymentId;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body.toString())
    .digest('hex');

  const isAuthentic = expectedSignature === signature;
  
  return { success: isAuthentic };
}
