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

export async function fetchNotionInvoices(userId: string): Promise<NotionInvoice[]> {
  const docRef = db.collection('users')
    .doc(userId)
    .collection('integrations')
    .doc('notion');

  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new Error("Notion not connected");
  }

  const { accessToken, databaseId } = docSnap.data() as { accessToken: string, databaseId: string };

  console.log("TOKEN:", accessToken);
  console.log("DATABASE ID:", databaseId);

  const response = await fetch(
    `https://api.notion.com/v1/databases/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      }
    }
  );

  const data = await response.json();

  console.log("NOTION RESPONSE:", data);

  if (!data.results) {
    throw new Error("Failed to fetch data from Notion");
  }

  // Mapping helpers
  const getTitle = (prop: any) => prop?.title?.[0]?.plain_text || "N/A";
  const getRichText = (prop: any) => prop?.rich_text?.[0]?.plain_text || "N/A";
  function getNumber(prop: any) {
    if (!prop) return 0;
    if (prop.type === "number") return prop.number ?? 0;
    if (prop.type === "formula") return prop.formula?.number ?? 0;
    if (prop.type === "rich_text") {
      const text = prop.rich_text?.[0]?.plain_text;
      return text ? Number(text) : 0;
    }
    return 0;
  }
  const getEmail = (prop: any) => prop?.email || "N/A";
  const getSelect = (prop: any) => prop?.select?.name || "N/A";
  const getDate = (prop: any) => prop?.date?.start || null;

  return data.results.map((page: any) => {
    const p = page.properties;
    
    console.log("RAW PROPERTIES:", p);
    console.log("Available properties:", Object.keys(p));

    const quantityKey = Object.keys(p).find(k =>
      k.toLowerCase().includes("quantity")
    );
    const priceKey = Object.keys(p).find(k =>
      k.toLowerCase().includes("price")
    );
    console.log("Quantity key:", quantityKey);
    console.log("Price key:", priceKey);
    
    // Correctly extract dates
    const issuedDate = p["Date"]?.date?.start || null;
    const dueDate = p["Due Date"]?.date?.start || null;

    console.log("Issued:", issuedDate);
    console.log("Due:", dueDate);

    // Safe formatting
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "N/A";
        const safeDate = new Date(dateStr);
        return isNaN(safeDate.getTime()) ? "N/A" : safeDate.toLocaleDateString();
    };

    return {
      clientName: getTitle(p["Client Name"]),
      clientEmail: getEmail(p["Email"]),
      quantity: getNumber(p[quantityKey as string]),
      unitPrice: getNumber(p[priceKey as string]),
      subtotal: getNumber(p["Subtotal"]),
      taxRate: getNumber(p["Tax Rate"]),
      taxAmount: getNumber(p["Tax Amount"]),
      totalAmount: getNumber(p["Total Amount"]),
      status: (() => {
        const prop = p["Status"];
        let s = "";
        if (prop?.type === "status") {
          s = prop.status?.name?.toLowerCase() || "";
        } else {
          s = getSelect(p["Status"])?.toLowerCase() || "";
        }
        
        if (s === 'paid') return 'paid';
        if (s === 'overdue') return 'overdue';
        return 'pending';
      })() as 'pending' | 'paid' | 'overdue',
      dueDate: formatDate(dueDate),
      issuedOn: formatDate(issuedDate),
      notes: getRichText(p["Notes"]),
    };
  });
}
