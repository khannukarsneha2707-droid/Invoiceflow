import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { NextResponse } from "next/server";

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
    const { userId, subject, body } = await req.json();

    if (!userId || !subject || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getFirestore();

    await db
      .collection("users")
      .doc(userId)
      .collection("settings")
      .doc("emailTemplate")
      .set({
        subject: subject.trim(),
        body: body.trim(),
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
}
