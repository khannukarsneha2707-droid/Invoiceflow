import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps, cert } from "firebase-admin/app";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(req: Request) {
  try {
    const { amount, invoiceId } = await req.json();

    const db = getFirestore();
    const invoiceDoc = await db.collection("publicInvoices").doc(invoiceId).get();
    
    if (!invoiceDoc.exists) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    const userId = invoiceDoc.data()!.userId;

    const paymentSettingsDoc = await db.collection("users").doc(userId).collection("settings").doc("payment").get();

    if (!paymentSettingsDoc.exists) {
        return NextResponse.json({ error: "Razorpay not connected" }, { status: 404 });
    }
    const { razorpayKeyId, razorpaySecret } = paymentSettingsDoc.data()!;

    console.log("USING RAZORPAY KEY:", razorpayKeyId);

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpaySecret,
    });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: "INR",
      receipt: invoiceId,
    });

    console.log("ORDER CREATED:", order);

    return NextResponse.json({
      id: order.id,
      amount: order.amount,
      key: razorpayKeyId
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Order creation failed" }, { status: 500 });
  }
}
