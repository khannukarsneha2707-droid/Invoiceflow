import { db } from '@/lib/firebaseAdmin';
import { auth } from 'firebase-admin';

export async function POST(req: Request) {
    try {
      const { razorpayKeyId, razorpaySecret, userId, idToken } = await req.json();

      // Verify the ID token to ensure it's authentic
      const decodedToken = await auth().verifyIdToken(idToken);
      if (decodedToken.uid !== userId) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      await db.collection('users').doc(userId).collection('integrations').doc('razorpay').set({
        keyId: razorpayKeyId,
        keySecret: razorpaySecret,
      }, { merge: true });

      return Response.json({ success: true, message: 'Razorpay settings saved successfully' });
    } catch (error) {
      console.error('Error saving Razorpay settings:', error);
      return Response.json({ error: 'Failed to save settings' }, { status: 500 });
    }
}
