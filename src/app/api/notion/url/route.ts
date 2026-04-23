import { NextResponse } from 'next/server';

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.NOTION_CLIENT_ID!,
    redirect_uri: process.env.NOTION_REDIRECT_URI!,
    response_type: 'code',
    owner: 'user',
  });

  const authUrl = `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  return NextResponse.json({ url: authUrl });
}
