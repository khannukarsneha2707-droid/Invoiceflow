'use server';

import { Client } from '@notionhq/client';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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
  const db = getFirestore();
  const tokenDoc = await getDoc(doc(db, 'users', userId, 'integrations', 'notion'));
  if (!tokenDoc.exists()) {
    throw new Error('Notion integration not found. Please connect your Notion account.');
  }
  return tokenDoc.data().accessToken;
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

    return response.results.map((page: any) => {
      const props = page.properties;
      console.log('DEBUG NOTION PROPS:', Object.keys(props));

      /**
       * Helper to find a property by name with specific column priority.
       */
      const findProp = (keys: string[]) => {
        const foundKey = Object.keys(props).find(k => 
          keys.some(key => k.toLowerCase() === key.toLowerCase())
        );
        return foundKey ? props[foundKey] : null;
      };

      /**
       * Extracts value from various Notion property types and cleans number strings.
       */
      const getValue = (prop: any): string => {
        if (!prop) return '';
        switch (prop.type) {
          case 'title': return prop.title?.[0]?.plain_text || '';
          case 'rich_text': return prop.rich_text?.[0]?.plain_text || '';
          case 'email': return prop.email || '';
          case 'number': return prop.number?.toString() || '0';
          case 'select': return prop.select?.name || '';
          case 'status': return prop.status?.name || '';
          case 'date': return prop.date?.start || '';
          case 'created_time': return prop.created_time || '';
          case 'formula': 
            if (prop.formula.type === 'number') return prop.formula.number?.toString() || '0';
            if (prop.formula.type === 'string') return prop.formula.string || '';
            return '';
          default: return '';
        }
      };

      const parseNumber = (val: string | number) => {
        if (val === null || val === undefined) return 0;
        const str = val.toString();
        // Strip everything except numbers, decimal points, and minus signs
        const cleaned = str.replace(/[^\d.-]/g, '');
        return parseFloat(cleaned) || 0;
      };

      // 1. Client Name (Title)
      const clientName = getValue(findProp(['Client Name', 'Name', 'Title', 'Client'])) || 'Unknown Client';

      // 2. Email
      const clientEmail = getValue(findProp(['Email', 'Mail', 'E-mail'])) || 'no-email@example.com';

      // 3. No of products (Quantity)
      const quantity = parseNumber(getValue(findProp(['No of products', 'No of p', 'Quantity', 'Qty', '# Quantity']))) || 1;

      // 4. Cost per product (Unit Price)
      const unitPrice = parseNumber(getValue(findProp(['Cost per product', 'Cost per p', 'Unit Price', 'Price', 'Cost', '# Price'])));

      // 5. Subtotal
      const subtotal = parseNumber(getValue(findProp(['Subtotal', 'Σ Subtotal']))) || (quantity * unitPrice);

      // 6. Tax Rate (%)
      const taxRate = parseNumber(getValue(findProp(['Tax Rate', 'Tax%', 'Tax %', '# Tax Rate'])));

      // 7. Tax Amount
      const taxAmount = parseNumber(getValue(findProp(['Tax Amount', 'Σ Tax Amount']))) || (subtotal * taxRate / 100);

      // 8. Total Amount
      const totalAmount = parseNumber(getValue(findProp(['Total Amount', 'Total', 'Total A', 'Σ Total Amount']))) || (subtotal + taxAmount);

      // 9. Status
      const statusRaw = getValue(findProp(['Status', 'Payment Status', 'Payment status'])).toLowerCase();
      let status: 'pending' | 'paid' | 'overdue' = 'pending';
      if (statusRaw.includes('paid')) status = 'paid';
      else if (statusRaw.includes('overdue')) status = 'overdue';

      // 10. Dates
      const issuedOn = getValue(findProp(['Issued Date', 'Issued', 'Created Date', 'Date']));
      const dueDate = getValue(findProp(['Due Date', 'Deadline']));

      // 11. Notes
      const notes = getValue(findProp(['Notes', 'Description', 'Note']));

      return {
        clientName,
        clientEmail,
        totalAmount,
        subtotal,
        taxRate,
        taxAmount,
        quantity,
        unitPrice,
        status,
        dueDate,
        issuedOn,
        notes,
      };
    });
  } catch (error: any) {
    console.error('Notion Fetch Invoices Error:', error);
    throw new Error(error.message || 'Failed to sync Notion data.');
  }
}
