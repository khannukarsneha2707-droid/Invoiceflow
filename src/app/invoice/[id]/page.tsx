"use client"

import { use, useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Loader2, 
  CreditCard 
} from 'lucide-react';
import { format } from 'date-fns';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { PayButton } from '@/components/invoices/pay-button';
import Link from 'next/link';

export default function PublicInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const firestore = useFirestore();
  const [invoice, setInvoice] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoice() {
      if (!firestore || !id) return;
      try {
        const q = query(collectionGroup(firestore, 'invoices'), where('id', '==', id));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          setError("Invoice not found.");
          setLoading(false);
          return;
        }

        const invData = snapshot.docs[0].data();
        const invId = snapshot.docs[0].id;
        const fullInv = { ...invData, id: invId };
        setInvoice(fullInv);

        if (invData.userId) {
          const profileRef = doc(firestore, 'users', invData.userId);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            setProfile(profileSnap.data());
          }
        }
      } catch (err: any) {
        console.error("Fetch Error:", err);
        setError("Could not load invoice details.");
      } finally {
        setLoading(false);
      }
    }

    fetchInvoice();
  }, [firestore, id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  if (error || !invoice) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <div className="bg-white p-8 rounded-3xl shadow-xl text-center space-y-4 max-w-md">
        <div className="bg-red-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-black text-primary">Access Denied</h1>
        <p className="text-muted-foreground font-medium">{error || "This invoice is no longer available."}</p>
        <Link href="/">
          <Button variant="outline" className="w-full h-12 rounded-xl">Go to Homepage</Button>
        </Link>
      </div>
    </div>
  );

  const isPaid = invoice.status === 'paid';

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4 md:py-20">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Logo" className="h-12 w-12 object-contain rounded-xl" />
            ) : (
              <div className="bg-primary p-2 rounded-xl">
                <FileText className="text-white h-6 w-6" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-black text-primary leading-none">{profile?.companyName || "InvoiceFlow"}</h2>
              {profile?.website && <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{profile.website}</p>}
            </div>
          </div>
          {isPaid && (
            <Badge className="bg-green-100 text-green-700 border-none font-black px-4 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              PAID IN FULL
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 border-none shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="bg-white border-b pb-10 pt-10 px-10">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-4xl font-black tracking-tight text-primary">Invoice</CardTitle>
                  <p className="text-muted-foreground mt-2 font-medium">#{invoice.id?.slice(-8).toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-primary/40 uppercase tracking-widest mb-1">Total Due</p>
                  <p className="text-4xl font-black text-primary">₹{(invoice.totalAmount || 0).toLocaleString()}</p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-10 bg-white space-y-10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Issued</p>
                  <p className="font-bold text-primary">{invoice.createdAt ? format(new Date(invoice.createdAt), 'MMM dd, yyyy') : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Due Date</p>
                  <p className="font-bold text-primary">{invoice.dueDate ? format(new Date(invoice.dueDate), 'MMM dd, yyyy') : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Client</p>
                  <p className="font-bold text-primary truncate">{invoice.clientName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Status</p>
                  <div className="flex items-center gap-1.5">
                    {isPaid ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Clock className="h-3 w-3 text-amber-600" />}
                    <span className={`text-xs font-black uppercase tracking-widest ${isPaid ? 'text-green-600' : 'text-amber-600'}`}>{invoice.status}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest border-b pb-4">Line Items</p>
                {invoice.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-muted last:border-0">
                    <div>
                      <p className="font-bold text-primary">{item.description}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ₹{item.unitPrice.toLocaleString()}</p>
                    </div>
                    <p className="font-black text-primary">₹{(item.lineTotal || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-end space-y-2 pt-6 border-t">
                <div className="flex justify-between w-full max-w-[200px] text-sm text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-bold text-primary">₹{(invoice.subtotal || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between w-full max-w-[200px] text-sm text-muted-foreground">
                  <span>Tax ({invoice.taxRate || 0}%):</span>
                  <span className="font-bold text-primary">₹{(invoice.taxAmount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between w-full max-w-[200px] text-lg font-black text-primary pt-2 border-t">
                  <span>Total:</span>
                  <span>₹{(invoice.totalAmount || 0).toLocaleString()}</span>
                </div>
              </div>

              {invoice.notes && (
                <div className="bg-muted/30 p-6 rounded-2xl mt-8">
                  <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest mb-2">Additional Notes</p>
                  <p className="text-sm text-primary/70 leading-relaxed font-medium">{invoice.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-primary text-white">
              <CardContent className="p-8 space-y-6">
                <div className="flex justify-between items-end border-b border-white/10 pb-6">
                  <span className="text-sm font-medium text-white/60">Total Payable</span>
                  <span className="text-3xl font-black">₹{(invoice.totalAmount || 0).toLocaleString()}</span>
                </div>
                {!isPaid ? (
                  <div className="space-y-3">
                    <PayButton 
                      invoice={invoice} 
                      className="w-full h-14 bg-accent hover:bg-accent/90 text-white font-black rounded-2xl text-lg shadow-xl shadow-accent/20" 
                      size="lg"
                    />
                    <p className="text-[10px] text-center text-white/40 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                      <CreditCard className="h-3 w-3" />
                      Secure SSL Encrypted Payment
                    </p>
                  </div>
                ) : (
                  <div className="bg-white/10 p-6 rounded-2xl flex flex-col items-center gap-3 text-center">
                    <CheckCircle2 className="h-10 w-10 text-white" />
                    <p className="font-bold">Paid. Thank you!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button 
              variant="outline" 
              className="w-full h-14 rounded-2xl font-bold bg-white shadow-lg border-none hover:bg-muted/50 text-primary"
              onClick={() => generateInvoicePDF(invoice, profile)}
            >
              <Download className="mr-2 h-5 w-5" />
              Download PDF Copy
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
