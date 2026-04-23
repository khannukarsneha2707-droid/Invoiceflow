import { NextResponse } from 'next/server';

export async function GET() {
  // BACKEND USE ONLY: Hardcoded for debugging
  const clientId = "34ad872b-594c-816a-8717-003738fb7447";
  const redirectUri = "https://invoiceflow--studio-9039589583-c1797.asia-east1.hosted.app/api/notion/callback";

  console.log('Notion Auth Config Check:', { clientId: !!clientId, redirectUri: !!redirectUri });

  // Frontend should NOT have access to NOTION_CLIENT_SECRET
  // Construct URL using Backend-only variables
  const url = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  return NextResponse.json({ url });
}
