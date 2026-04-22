
'use server';

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27-acacia',
});

interface CreateCheckoutSessionParams {
  invoiceId: string;
  amount: number;
  clientName: string;
  clientEmail: string;
  origin: string;
}

export async function createCheckoutSession({
  invoiceId,
  amount,
  clientName,
  clientEmail,
  origin,
}: CreateCheckoutSessionParams) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe Secret Key is not configured.');
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Invoice for ${clientName}`,
              description: `Payment for Invoice #${invoiceId.slice(-6).toUpperCase()}`,
            },
            unit_amount: Math.round(amount * 100), // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: clientEmail,
      success_url: `${origin}/dashboard?payment_success=true&invoiceId=${invoiceId}`,
      cancel_url: `${origin}/dashboard`,
      metadata: {
        invoiceId: invoiceId,
      },
    });

    return { url: session.url };
  } catch (error: any) {
    console.error('Stripe Session Error:', error);
    throw new Error(error.message || 'Could not create payment session.');
  }
}
