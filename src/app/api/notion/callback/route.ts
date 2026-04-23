import { NextResponse, NextRequest } from 'next/server';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import firebaseConfig from '../../../../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  // 1. Exchange code for token
  const credentials = Buffer.from(
    `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: process.env.NOTION_REDIRECT_URI
    })
  });

  // 4. Log full response
  const data = await response.json();
  console.log("NOTION TOKEN RESPONSE:", data);

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to exchange token', details: data }, { status: 500 });
  }

  // TODO: Store token in Firestore securely
  try {
    const userId = request.nextUrl.searchParams.get('state');
    if (userId) {
      const db = getFirestore(app); // Import app and getFirestore
      await setDoc(doc(db, 'users', userId, 'integrations', 'notion'), {
        accessToken: data.access_token,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  } catch (error) {
    console.error('Failed to store token:', error);
  }

  // For now, return success page to close popup
  return new NextResponse(`
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>Authentication successful. This window should close automatically.</p>
      </body>
    </html>
  `, { headers: { 'Content-Type': 'text/html' } });
}
