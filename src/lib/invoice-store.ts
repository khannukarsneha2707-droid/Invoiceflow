/**
 * @fileOverview Types and interfaces for Invoices.
 * Aligned with backend.json for consistency across the application.
 */

export interface Invoice {
  id?: string;
  userId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
  notes?: string;
  lastReminderSentAt?: string;
  source?: string;
}

export interface InvoiceItem {
  id?: string;
  invoiceId: string;
  userId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt?: string;
  updatedAt?: string;
}
