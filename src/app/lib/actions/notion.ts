'use server';

import { Client } from '@notionhq/client';
import { db } from '@/lib/firebaseAdmin';

export interface NotionDatabase {
  id: string;
  title: string;
}

export interface NotionInvoice {
  clientName: string;
  clientEmail: string;
  totalAmount: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  quantity: number;
  unitPrice: number;
  status: 'pending' | 'paid' | 'overdue';
  dueDate?: string;
  issuedOn?: string;
  notes?: string;
}

/**
 * Fetches all databases accessible by the server-side Notion token.
 */
export async function getNotionToken(userId: string): Promise<string> {
  const tokenDoc = await db.collection('users').doc(userId).collection('integrations').doc('notion').get();
  if (!tokenDoc.exists) {
    throw new Error('Notion integration not found. Please connect your Notion account.');
  }
  return tokenDoc.data()!.accessToken;
}

export async function getNotionDatabases(userId: string): Promise<NotionDatabase[]> {
  const token = await getNotionToken(userId);
  const notion = new Client({ auth: token });
  try {
    const response = await notion.search({
      filter: { property: 'object', value: 'database' },
    });

    return response.results.map((db: any) => ({
      id: db.id,
      title: db.title?.[0]?.plain_text || 'Untitled Database',
    }));
  } catch (error: any) {
    console.error('Notion Fetch Databases Error:', error);
    throw new Error(error.message || 'Failed to fetch Notion databases.');
  }
}

export async function fetchNotionInvoices(userId: string, databaseId: string): Promise<NotionInvoice[]> {
  const token = await getNotionToken(userId);
  const notion = new Client({ auth: token });
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
    });
    
    // 1. Log full Notion response
    console.log('DEBUG: Full Notion Response:', JSON.stringify(response.results, null, 2));

    // Mapping helpers
    const getTitle = (prop: any) => prop?.title?.[0]?.plain_text || "N/A";
    const getRichText = (prop: any) => prop?.rich_text?.[0]?.plain_text || "N/A";
    const getNumber = (prop: any) => prop?.number ?? 0;
    const getEmail = (prop: any) => prop?.email || "N/A";
    const getSelect = (prop: any) => prop?.select?.name || "N/A";
    const getDate = (prop: any) => prop?.date?.start || "N/A";

    return response.results.map((page: any) => {
      const p = page.properties;
      return {
        clientName: getTitle(p["Client Name"]),
        clientEmail: getEmail(p["Email"]),
        quantity: getNumber(p["No of products"]),
        unitPrice: getNumber(p["Cost per product"]),
        subtotal: getNumber(p["Subtotal"]),
        taxRate: getNumber(p["Tax Rate"]),
        taxAmount: getNumber(p["Tax Amount"]),
        totalAmount: getNumber(p["Total Amount"]),
        status: (() => {
          const s = getSelect(p["Status"])?.toLowerCase();
          if (s === 'paid') return 'paid';
          if (s === 'overdue') return 'overdue';
          return 'pending';
        })() as 'pending' | 'paid' | 'overdue',
        dueDate: getDate(p["Due Date"]),
        issuedOn: getDate(p["Date"]),
        notes: getRichText(p["Notes"]),
      };
    });
  } catch (error: any) {
    console.error('Notion Fetch Invoices Error:', error);
    throw new Error(error.message || 'Failed to sync Notion data.');
  }
}
