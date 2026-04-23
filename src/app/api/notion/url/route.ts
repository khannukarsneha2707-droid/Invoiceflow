import { NextResponse } from 'next/server';

export async function GET() {
  // BACKEND USE ONLY: Sensitive variables
  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  console.log('Notion Auth Config Check:', { clientId: !!clientId, redirectUri: !!redirectUri });

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Missing Notion configuration: Client ID or Redirect URI not set.' }, { status: 500 });
  }

  // Frontend should NOT have access to NOTION_CLIENT_SECRET
  // Construct URL using Backend-only variables
  const url = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  return NextResponse.json({ url });
}
