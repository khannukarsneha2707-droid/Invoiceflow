import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_NOTION_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_NOTION_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Missing configuration' }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    owner: 'user',
  });

  const authUrl = `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  return NextResponse.json({ url: authUrl });
}
