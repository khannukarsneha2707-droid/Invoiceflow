"use client"

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  Download,
  Mail,
  Loader2,
  Filter,
  User,
  Trash,
  Copy,
  Users,
  BellRing,
  History
} from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useCollection, useDoc, useUser, useFirestore, useMemoFirebase, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc, getDocs, writeBatch } from 'firebase/firestore';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { sendInvoiceEmail } from '@/app/lib/actions/send-email';
import { useToast } from '@/hooks/use-toast';
import { NotionImportDialog } from '@/components/invoices/notion-import-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export default function InvoicesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [isSending, setIsSending] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  
  // Dialog States
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [showClearAll, setShowClearAll] = useState(false);

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'invoices'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user]);

  const clientsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'clients'),
      orderBy('name', 'asc')
    );
  }, [firestore, user]);

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const [notionInvoices, setNotionInvoices] = useState<any[]>([]);
  const { data: invoices, isLoading } = useCollection(invoicesQuery);
  const { data: clients } = useCollection(clientsQuery);
  const { data: profile } = useDoc(profileRef);

  const notionIntegrationRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid, 'integrations', 'notion');
  }, [firestore, user]);
  const { data: notionIntegration } = useDoc(notionIntegrationRef);
  const notionConnected = !!notionIntegration;

  const fetchInvoices = async () => {
    console.log("FETCHING NOTION DATA");
    console.log("USER:", user?.uid);
    console.log("NOTION INTEGRATION:", notionIntegration);
    
    if (!user) {
      console.error("Missing user");
      return;
    }

    const res = await fetch("/api/notion/query?userId=" + user.uid);

    console.log("RESPONSE STATUS:", res.status);

    const data = await res.json();

    console.log("NOTION DATA:", data);

    setNotionInvoices(data.invoices || []);
  };

  useEffect(() => {
    if (notionConnected) {
      fetchInvoices();
    }
  }, [notionConnected]);

  const allInvoices = [...(invoices || []), ...notionInvoices.map((inv, i) => ({ ...inv, id: `notion-${i}` }))];

  const confirmDelete = () => {
    if (!firestore || !user || !idToDelete) return;
    const docRef = doc(firestore, 'users', user.uid, 'invoices', idToDelete);
    deleteDocumentNonBlocking(docRef);
    setIdToDelete(null);
    toast({
      title: "Invoice Deleted",
      description: "The record has been permanently removed.",
    });
  };

  const confirmClearAll = async () => {
    if (!firestore || !user || !invoices || invoices.length === 0) return;
    setIsClearing(true);
    setShowClearAll(false);
    try {
      const colRef = collection(firestore, 'users', user.uid, 'invoices');
      const snapshot = await getDocs(colRef);
      const batch = writeBatch(firestore);
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      toast({ title: "Invoices Cleared", description: "Your invoice list has been successfully reset." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Clear Failed", description: error.message || "Could not delete all invoices." });
    } finally {
      setIsClearing(false);
    }
  };

  const handleCopyLink = (invoiceId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/invoice/${invoiceId}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link Copied", description: "Payment link copied to clipboard." });
  };

  const sendReminderWithPDF = async (invoice: any) => {
    if (!firestore || !user) return;
    setIsSending(invoice.id);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: invoice.clientEmail,
          clientName: invoice.clientName,
          amount: invoice.totalAmount,
          dueDate: invoice.dueDate,
          invoice: invoice,
          profile: profile
        })
      });

      if (!response.ok) throw new Error('Failed to send email');

      // Update metadata
      const invRef = doc(firestore, 'users', user.uid, 'invoices', invoice.id);
      updateDocumentNonBlocking(invRef, {
        lastReminderSentAt: new Date().toISOString()
      });

      toast({ title: "Reminder Sent!", description: `Payment reminder with PDF has been sent to ${invoice.clientEmail}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Email Failed", description: error.message || "Could not send the reminder." });
    } finally {
      setIsSending(null);
    }
  };

  const formatSafeDate = (value: string | undefined | null) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "N/A";
    return format(date, "MMM dd, yyyy");
  };

  const filteredInvoices = allInvoices.filter(inv => {
    const matchesSearch = inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         inv.clientEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClient = clientFilter === 'all' || inv.clientId === clientFilter;
    return matchesSearch && matchesClient;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-green-100 text-green-700 border-none font-black px-3 py-0.5 text-[10px]">PAID</Badge>;
      case 'overdue': return <Badge className="bg-red-100 text-red-700 border-none font-black px-3 py-0.5 text-[10px]">OVERDUE</Badge>;
      default: return <Badge className="bg-blue-100 text-blue-700 border-none font-black px-3 py-0.5 text-[10px]">PENDING</Badge>;
    }
  };

  const tableHeaders = [
    "Client Name",
    "Email",
    "Quantity",
    "Price",
    "Subtotal",
    "Tax Rate",
    "Tax Amount",
    "Total Amount",
    "Date",
    "Due Date",
    "Status",
    "Notes"
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-primary">Invoices</h1>
            <p className="text-muted-foreground text-sm md:text-lg mt-1">Manage and track your entire billing cycle.</p>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3">
            {invoices && invoices.length > 0 && (
              <Button 
                variant="outline" 
                onClick={() => setShowClearAll(true)}
                disabled={isClearing}
                className="h-10 md:h-12 border-red-200 text-red-600 hover:bg-red-50 font-bold px-4 md:px-6 rounded-xl text-xs md:text-sm"
              >
                {isClearing ? <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" /> : <Trash className="mr-2 h-4 w-4 md:h-5 md:w-5" />}
                Clear All
              </Button>
            )}
            <NotionImportDialog onConnectSuccess={fetchInvoices} />
            <Link href="/invoices/new">
              <Button className="bg-accent hover:bg-accent/90 text-white font-black h-10 md:h-12 px-4 md:px-6 rounded-xl shadow-lg shadow-accent/20 text-xs md:text-sm">
                <Plus className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                Create Invoice
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center gap-4 bg-white p-2 rounded-2xl border-none shadow-sm premium-shadow">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search by name or email..." 
              className="pl-12 h-14 bg-transparent border-none focus-visible:ring-0 text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="h-8 w-[1px] bg-border hidden lg:block" />
          <div className="w-full lg:w-64">
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="h-14 bg-transparent border-none focus:ring-0 font-bold text-primary">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="All Clients" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl">
                <SelectItem value="all">All Clients</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id!}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border-none premium-shadow overflow-hidden">
          <ScrollArea className="w-full">
            <Table className="min-w-[1400px]">
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-none">
                  {tableHeaders.map((header) => (
                    <TableHead key={header} className="font-black py-6 px-4 text-primary/70 uppercase text-[10px] tracking-widest whitespace-nowrap">
                      {header}
                    </TableHead>
                  ))}
                  <TableHead className="w-[60px] pr-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-32">
                      <Loader2 className="h-10 w-10 animate-spin text-accent mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-32">
                      <p className="font-bold text-lg text-muted-foreground">No matching invoices found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-muted/20 transition-colors border-border/50 group">
                      <TableCell className="py-4 px-4 font-bold text-primary text-xs">
                        {invoice.clientName}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {invoice.clientEmail}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">
                        {invoice.items?.[0]?.quantity || 0}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-primary">
                        ₹{(invoice.items?.[0]?.unitPrice || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-primary">
                        ₹{(invoice.subtotal || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-accent">
                        {invoice.taxRate}%
                      </TableCell>
                      <TableCell className="text-xs font-bold text-primary">
                        ₹{(invoice.taxAmount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-black text-primary">
                        ₹{(invoice.totalAmount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-[11px] font-medium text-muted-foreground">
                        {formatSafeDate(invoice.createdAt)}
                      </TableCell>
                      <TableCell className="text-[11px] font-medium text-muted-foreground">
                        {formatSafeDate(invoice.dueDate)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(invoice.status)}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                        {invoice.notes || '—'}
                      </TableCell>
                      <TableCell className="pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-accent/10">
                              <MoreHorizontal className="h-4 w-4 text-primary" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-2xl p-2 border-none">
                            {invoice.status !== 'paid' && (
                              <DropdownMenuItem className="cursor-pointer font-bold text-rose-600 focus:bg-rose-50" onSelect={() => sendReminderWithPDF(invoice)} disabled={isSending === invoice.id}>
                                {isSending === invoice.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <BellRing className="mr-2 h-3 w-3" />} Send Reminder
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="cursor-pointer font-bold" onSelect={() => handleCopyLink(invoice.id!)}>
                              <Copy className="mr-2 h-3 w-3" /> Copy Link
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer font-bold" onSelect={() => generateInvoicePDF(invoice, profile)}>
                              <Download className="mr-2 h-3 w-3" /> Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <Link href={`/invoices/${invoice.id}`}>
                              <DropdownMenuItem className="cursor-pointer font-bold">
                                <Edit2 className="mr-2 h-3 w-3" /> Edit Record
                              </DropdownMenuItem>
                            </Link>
                            <DropdownMenuItem 
                              className="text-red-600 font-bold" 
                              onSelect={(e) => {
                                e.preventDefault();
                                setIdToDelete(invoice.id!);
                              }}
                            >
                              <Trash2 className="mr-2 h-3 w-3" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>

      <AlertDialog open={!!idToDelete} onOpenChange={(open) => !open && setIdToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-primary">Delete Invoice?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="rounded-xl font-bold h-12">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold h-12">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showClearAll} onOpenChange={setShowClearAll}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-red-600">Clear All Invoices?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium">
              Are you sure you want to delete ALL {invoices?.length} invoices?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="rounded-xl font-bold h-12">No, Keep Them</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearAll} className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold h-12">
              Yes, Clear Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
