
'use server';

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { db } from '@/lib/firebaseAdmin';

interface CreateOrderParams {
  amount: number;
  invoiceId: string;
  userId: string;
}

export async function createRazorpayOrder({ amount, invoiceId, userId }: CreateOrderParams) {
  const integrationDoc = await db.collection('users').doc(userId).collection('settings').doc('payment').get();
  
  if (!integrationDoc.exists) {
    throw new Error('Razorpay not connected');
  }

  const { razorpayKeyId, razorpaySecret } = integrationDoc.data()!;
  const razorpay = new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpaySecret,
  });

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
  userId: string;
}

export async function verifyRazorpayPayment({
  orderId,
  paymentId,
  signature,
  userId,
}: VerifyPaymentParams) {
  const integrationDoc = await db.collection('users').doc(userId).collection('settings').doc('payment').get();
  
  if (!integrationDoc.exists) {
    throw new Error('Razorpay not connected');
  }

  const { razorpaySecret } = integrationDoc.data()!;

  const body = orderId + '|' + paymentId;

  const expectedSignature = crypto
    .createHmac('sha256', razorpaySecret)
    .update(body.toString())
    .digest('hex');

  const isAuthentic = expectedSignature === signature;
  
  return { success: isAuthentic };
}
