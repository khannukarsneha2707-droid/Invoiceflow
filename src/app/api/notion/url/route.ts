import { NextResponse, NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  
  // Use environment variables for production security and flexibility
  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  if (!clientId || !redirectUri || !userId) {
    console.error('Notion Auth error: missing environment variables or userId');
    return NextResponse.json({ error: 'Server configuration or user error' }, { status: 500 });
  }

  console.log('Notion Auth Config Check:', { userId, clientId: !!clientId, redirectUri: !!redirectUri });

  // Construct URL using Backend-only variables
  const url = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}`;
  
  return NextResponse.json({ url });
}
