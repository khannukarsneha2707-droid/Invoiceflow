import { NextResponse, NextRequest } from 'next/server';
import { fetchNotionInvoices } from '@/app/lib/actions/notion';
import { db } from '@/lib/firebaseAdmin';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    const integrationDoc = await db.collection('users').doc(userId).collection('integrations').doc('notion').get();
    const databaseId = integrationDoc.data()?.databaseId;

    if (!databaseId) {
      return NextResponse.json({ error: 'Database not linked. Please reconnect Notion.' }, { status: 404 });
    }

    console.log("DATABASE ID:", databaseId);
    console.log("FETCHING FROM QUERY API");
    const invoices = await fetchNotionInvoices(userId, databaseId);
    return NextResponse.json({ invoices });
  } catch (error: any) {
    console.error('API Notion Query Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
