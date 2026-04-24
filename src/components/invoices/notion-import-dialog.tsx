'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  Loader2, 
  CheckCircle2, 
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { getNotionDatabases, fetchNotionInvoices, NotionDatabase } from '@/app/lib/actions/notion';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';

export function NotionImportDialog({ onConnectSuccess }: { onConnectSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'connect' | 'database' | 'syncing' | 'complete'>('connect');
  const [databases, setDatabases] = useState<NotionDatabase[]>([]);
  const [selectedDb, setSelectedDb] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [importCount, setImportCount] = useState(0);

  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const handleConnectNotion = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const resp = await fetch(`/api/notion/url?userId=${user.uid}`);
      const { url } = await resp.json();
      
      const authWindow = window.open(url, "notionAuth", "width=600,height=700");
      
      const interval = setInterval(async () => {
        if (authWindow?.closed) {
          clearInterval(interval);
          setIsLoading(false);
          toast({ title: "Notion connected successfully" });
          
          // Fetch databases after connection
          setIsLoading(true);
          try {
            const dbs = await getNotionDatabases(user.uid);
            setDatabases(dbs);
            setStep('database');
          } catch (e) {
            toast({ variant: "destructive", title: "Failed to fetch databases" });
          } finally {
            setIsLoading(false);
          }
        }
      }, 1000);
    } catch (error: any) {
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: error.message || "Could not connect to Notion.",
      });
    }
  };

  const handleImport = async () => {
    if (!selectedDb || !user || !firestore) return;
    setIsLoading(true);
    setStep('syncing');
    
    try {
      const notionInvoices = await fetchNotionInvoices(user.uid, selectedDb);
      const clientsRef = collection(firestore, 'users', user.uid, 'clients');
      const clientsSnapshot = await getDocs(clientsRef);
      const existingClients = clientsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      const colRef = collection(firestore, 'users', user.uid, 'invoices');
      const oldImportsQuery = query(colRef, where('source', '==', 'notion'));
      const oldImportsSnapshot = await getDocs(oldImportsQuery);
      
      const batch = writeBatch(firestore);
      oldImportsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      // Store selected databaseId
      await setDocumentNonBlocking(doc(firestore, 'users', user.uid, 'integrations', 'notion'), {
        databaseId: selectedDb
      }, { merge: true });

      let count = 0;
      for (const inv of notionInvoices) {
        let targetClientId = '';
        const existingClient = existingClients.find(c => (c as any).email.toLowerCase() === inv.clientEmail.toLowerCase());
        
        if (existingClient) {
          targetClientId = existingClient.id;
        } else {
          const newClientRef = doc(collection(firestore, 'users', user.uid, 'clients'));
          const newClientData = {
            id: newClientRef.id,
            userId: user.uid,
            name: inv.clientName,
            email: inv.clientEmail,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'clients'), newClientData);
          targetClientId = newClientRef.id;
          existingClients.push(newClientData as any);
        }

        const invoiceDocRef = doc(colRef);
        const invoiceId = invoiceDocRef.id;
        const now = new Date().toISOString();

        // Create Item Data
        const itemData = {
          id: doc(collection(firestore, 'users', user.uid, 'invoices', invoiceId, 'items')).id,
          invoiceId: invoiceId,
          userId: user.uid,
          description: inv.notes || 'Imported from Notion Service',
          quantity: inv.quantity,
          unitPrice: inv.unitPrice,
          lineTotal: inv.quantity * inv.unitPrice,
          createdAt: inv.issuedOn || now,
          updatedAt: now,
        };

        // Sync individual items to sub-collection
        const itemRef = doc(firestore, 'users', user.uid, 'invoices', invoiceId, 'items', itemData.id);
        setDocumentNonBlocking(itemRef, itemData, { merge: true });

        // Create Main Invoice Data
        const invoiceData = {
          ...inv,
          id: invoiceId,
          userId: user.uid,
          clientId: targetClientId, 
          source: 'notion', 
          dueDate: inv.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: inv.issuedOn || now,
          updatedAt: now,
          serverCreatedAt: serverTimestamp(),
          items: [itemData], // Denormalized for fast access
          subtotal: inv.subtotal,
          taxRate: inv.taxRate,
          taxAmount: inv.taxAmount,
          totalAmount: inv.totalAmount,
          notes: inv.notes || 'Imported via Secure Notion Sync',
        };
        
        setDocumentNonBlocking(invoiceDocRef, invoiceData, { merge: true });
        count++;
      }
      
      setImportCount(count);
      setStep('complete');
      toast({
        title: "Sync Successful",
        description: `Synced ${count} invoices from Notion with full tax and item details.`,
      });
    } catch (error: any) {
      setStep('database');
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: error.message || "An error occurred during import.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setOpen(false);
    setTimeout(() => {
      setStep('connect');
      setDatabases([]);
      setSelectedDb('');
      setImportCount(0);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v ? reset() : setOpen(v)}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-12 border-accent text-accent hover:bg-accent/5 font-bold px-6 rounded-xl">
          <Database className="mr-2 h-5 w-5" />
          Sync Notion
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
        <div className="bg-accent p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2 rounded-lg">
              <RefreshCw className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl font-black">Notion Sync</DialogTitle>
          </div>
          <DialogDescription className="text-white/80 font-medium">
            Syncing with your updated database format.
          </DialogDescription>
        </div>

        <div className="p-8">
          {step === 'connect' && (
            <div className="space-y-6 text-center">
              <div className="bg-green-50 p-4 rounded-2xl flex items-center gap-3 text-green-700">
                <ShieldCheck className="h-6 w-6 shrink-0" />
                <p className="text-xs font-bold text-left">Sync now supports your new Client, Tax, and Product quantity columns.</p>
              </div>
              <Button 
                onClick={handleConnectNotion} 
                disabled={isLoading} 
                className="w-full h-12 bg-accent hover:bg-accent/90 text-white font-black rounded-xl"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Connect Workspace"}
              </Button>
            </div>
          )}

          {step === 'database' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Select Database</Label>
                <Select onValueChange={setSelectedDb} value={selectedDb}>
                  <SelectTrigger className="h-12 bg-muted/30 border-none rounded-xl">
                    <SelectValue placeholder="Choose a database..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {databases.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No databases found. Make sure you've shared one with your integration in Notion.
                      </div>
                    ) : (
                      databases.map((db) => (
                        <SelectItem key={db.id} value={db.id} className="cursor-pointer">
                          {db.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleImport} 
                disabled={!selectedDb || isLoading} 
                className="w-full h-12 bg-accent hover:bg-accent/90 text-white font-black rounded-xl"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Begin Refresh Sync"}
              </Button>
            </div>
          )}

          {step === 'syncing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-accent" />
              <div>
                <p className="font-black text-xl text-primary">Refreshing Data</p>
                <p className="text-sm text-muted-foreground">Mapping your new Notion columns to InvoiceFlow...</p>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-6">
              <div className="h-20 w-20 bg-green-50 rounded-full flex items-center justify-center text-green-500">
                <CheckCircle2 className="h-12 w-12" />
              </div>
              <div>
                <p className="font-black text-2xl text-primary">Sync Complete</p>
                <p className="text-sm text-muted-foreground">Successfully updated {importCount} invoices with full financial details.</p>
              </div>
              <Button 
                onClick={reset} 
                className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black rounded-xl"
              >
                Close & View
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}