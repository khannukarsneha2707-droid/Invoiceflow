import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';
import { Client } from '@notionhq/client';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  // 1. Exchange code for token
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const redirectUri = process.env.NOTION_REDIRECT_URI;
  
  console.log("NOTION_DEBUG: --- Token Exchange Request Data ---");
  console.log("NOTION_DEBUG: ClientID (truncated):", clientId?.substring(0, 5) + "...");
  console.log("NOTION_DEBUG: Redirect URI (exact):", redirectUri);
  console.log("NOTION_DEBUG: ----------------------------------");

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: 'Missing Notion credentials in environment variables.' }, { status: 500 });
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
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
      redirect_uri: redirectUri
    })
  });

  // 4. Log full response
  const data = await response.json();
  console.log("NOTION TOKEN RESPONSE:", data);

  if (!response.ok) {
    const errorDetails = {
      message: 'Failed to exchange token',
      rawError: data,
      debug: {
        sentClientId: clientId?.substring(0, 5) + "...",
        sentRedirectUri: redirectUri,
      }
    };
    return NextResponse.json({ error: errorDetails }, { status: 500 });
  }

  // Store token and find/store databaseId in Firestore
  try {
    const userId = request.nextUrl.searchParams.get('state');
    
    if (!userId) {
      throw new Error("Missing userId (state)");
    }

    console.log("USER ID:", userId);
    console.log("TOKEN:", data.access_token);
    console.log("SAVING TO FIRESTORE...");
    
    // 1. Save Token
    await db.collection('users').doc(userId).collection('integrations').doc('notion').set({
      accessToken: data.access_token,
      workspaceId: data.workspace_id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // 2. Search for Invoices database
    const notion = new Client({ auth: data.access_token });
    const response = await notion.search({
      filter: { property: 'object', value: 'database' },
    });

    const dbMatch = response.results.find((nDb: any) => 
      nDb.title?.[0]?.plain_text?.toLowerCase()?.includes('invoices')
    );

    if (dbMatch) {
      console.log("DATABASE ID FOUND:", dbMatch.id);
      await db.collection('users').doc(userId).collection('integrations').doc('notion').set({
        databaseId: dbMatch.id,
      }, { merge: true });
    } else {
      console.warn("No Invoices database found in Notion.");
    }
  } catch (error) {
    console.error('Failed to store token or find database:', error);
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
