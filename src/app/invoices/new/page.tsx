"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { InvoiceForm } from '@/components/invoices/invoice-form';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useFirestore, useUser, setDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, doc } from 'firebase/firestore';

export default function NewInvoicePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const handleSubmit = async (values: any) => {
    if (!user || !firestore) return;
    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const invoiceColRef = collection(firestore, 'users', user.uid, 'invoices');
      const invoiceDocRef = doc(invoiceColRef);
      const invoiceId = invoiceDocRef.id;

      // Map items and calculate line totals
      const itemsWithCalculations = values.items.map((item: any) => {
        const itemColRef = collection(firestore, 'users', user.uid, 'invoices', invoiceId, 'items');
        const itemDocRef = doc(itemColRef);
        const lineTotal = item.quantity * item.unitPrice;
        
        const itemData = {
          id: itemDocRef.id,
          invoiceId: invoiceId,
          userId: user.uid,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: lineTotal,
          createdAt: now,
          updatedAt: now,
        };

        // Sync individual items to sub-collection
        setDocumentNonBlocking(itemDocRef, itemData, { merge: true });
        
        return itemData;
      });

      const subtotal = itemsWithCalculations.reduce((acc: number, item: any) => acc + item.lineTotal, 0);
      const taxAmount = (subtotal * values.taxRate) / 100;
      const totalAmount = subtotal + taxAmount;
      
      const invoiceData = {
        ...values,
        id: invoiceId,
        userId: user.uid,
        items: itemsWithCalculations, // Denormalized for fast access
        subtotal,
        taxAmount,
        totalAmount,
        dueDate: values.dueDate.toISOString(),
        createdAt: now,
        updatedAt: now,
        serverCreatedAt: serverTimestamp(),
      };
      
      setDocumentNonBlocking(invoiceDocRef, invoiceData, { merge: true });
      
      toast({
        title: "Success",
        description: "Invoice created successfully.",
      });
      router.push('/invoices');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create invoice.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary">New Invoice</h1>
            <p className="text-muted-foreground">Create a professional invoice in seconds.</p>
          </div>
        </div>

        <InvoiceForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>
    </DashboardLayout>
  );
}
