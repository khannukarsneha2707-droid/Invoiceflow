import { NextResponse } from "next/server";
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
    const { invoiceId, paymentId } = await req.json();

    const db = getFirestore();

    const publicInvoiceRef = db.collection("publicInvoices").doc(invoiceId);
    const publicInvoiceSnap = await publicInvoiceRef.get();

    if (!publicInvoiceSnap.exists) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const { userId } = publicInvoiceSnap.data()!;

    await publicInvoiceRef.update({
      status: "paid",
      paymentId: paymentId,
      paidAt: new Date().toISOString()
    });

    const userInvoiceRef = db.collection("users").doc(userId).collection("invoices").doc(invoiceId);
    const userInvoiceSnap = await userInvoiceRef.get();

    if (userInvoiceSnap.exists) {
        await userInvoiceRef.update({
            status: "paid",
            paymentId: paymentId,
            paidAt: new Date().toISOString()
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
