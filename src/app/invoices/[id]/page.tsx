"use client"

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { InvoiceForm } from '@/components/invoices/invoice-form';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useDoc, useUser, useFirestore, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc, collection, getDocs, writeBatch } from 'firebase/firestore';

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const docRef = useMemoFirebase(() => {
    if (!firestore || !user || !id) return null;
    return doc(firestore, 'users', user.uid, 'invoices', id);
  }, [firestore, user, id]);

  const { data: invoice, isLoading } = useDoc(docRef);

  const handleSubmit = async (values: any) => {
    if (!docRef || !user || !firestore || !id) return;
    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      
      // 1. Clear existing sub-collection items to avoid duplicates
      const itemColRef = collection(firestore, 'users', user.uid, 'invoices', id, 'items');
      const existingItems = await getDocs(itemColRef);
      const batch = writeBatch(firestore);
      existingItems.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();

      // 2. Map items and calculate line totals
      const itemsWithCalculations = values.items.map((item: any) => {
        const newItemDocRef = doc(itemColRef);
        const lineTotal = item.quantity * item.unitPrice;
        
        const itemData = {
          id: newItemDocRef.id,
          invoiceId: id,
          userId: user.uid,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: lineTotal,
          createdAt: now,
          updatedAt: now,
        };

        // Sync individual items to sub-collection
        setDocumentNonBlocking(newItemDocRef, itemData, { merge: true });
        
        return itemData;
      });

      const subtotal = itemsWithCalculations.reduce((acc: number, item: any) => acc + item.lineTotal, 0);
      const taxAmount = (subtotal * values.taxRate) / 100;
      const totalAmount = subtotal + taxAmount;

      setDocumentNonBlocking(docRef, {
        ...values,
        items: itemsWithCalculations,
        subtotal,
        taxAmount,
        totalAmount,
        dueDate: values.dueDate.toISOString(),
        updatedAt: now,
      }, { merge: true });

      toast({
        title: "Success",
        description: "Invoice updated successfully.",
      });
      router.push('/invoices');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update invoice.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return (
    <DashboardLayout>
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    </DashboardLayout>
  );

  if (!invoice && !isLoading) return (
    <DashboardLayout>
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Link href="/invoices">
          <Button variant="outline">Back to Invoices</Button>
        </Link>
      </div>
    </DashboardLayout>
  );

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
            <h1 className="text-3xl font-extrabold tracking-tight text-primary">Edit Invoice</h1>
            <p className="text-muted-foreground">Updating records for {invoice?.clientName}.</p>
          </div>
        </div>

        {invoice && (
          <InvoiceForm 
            initialData={{
              ...invoice,
              dueDate: new Date(invoice.dueDate)
            } as any} 
            onSubmit={handleSubmit} 
            isSubmitting={isSubmitting} 
          />
        )}
      </div>
    </DashboardLayout>
  );
}
