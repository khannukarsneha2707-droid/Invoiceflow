
"use client"

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit2, 
  Trash2, 
  Loader2,
  Building2,
  Filter,
  Users,
  CreditCard,
  History,
  AlertCircle,
  FileText,
  Calendar,
  ChevronRight
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCollection, useUser, useFirestore, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ClientFormDialog } from '@/components/clients/client-form-dialog';
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
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function ClientsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const clientsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'clients'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user]);

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'invoices'), orderBy('createdAt', 'desc'));
  }, [firestore, user]);

  const { data: clients, isLoading: isClientsLoading } = useCollection(clientsQuery);
  const { data: invoices, isLoading: isInvoicesLoading } = useCollection(invoicesQuery);

  const confirmDelete = () => {
    if (!firestore || !user || !idToDelete) return;
    const docRef = doc(firestore, 'users', user.uid, 'clients', idToDelete);
    deleteDocumentNonBlocking(docRef);
    setIdToDelete(null);
    toast({
      title: "Client Removed",
      description: "The client record has been deleted.",
    });
  };

  const getClientStats = (client: any) => {
    const clientInvoices = invoices?.filter(inv => 
      inv.clientId === client.id || 
      (inv.clientEmail && inv.clientEmail.toLowerCase() === client.email?.toLowerCase())
    ) || [];
    
    const totalInvoiced = clientInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const paid = clientInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const overdue = clientInvoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    
    return { 
      totalInvoiced, 
      paid, 
      overdue, 
      count: clientInvoices.length,
      recentInvoices: clientInvoices.slice(0, 3)
    };
  };

  const filteredClients = clients?.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const isLoading = isClientsLoading || isInvoicesLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-4xl font-black text-primary tracking-tight">Clients</h1>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4">
          <div className="flex-1 relative">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input 
               placeholder="Search clients..." 
               className="pl-11 h-11 md:h-12 bg-white border-none rounded-xl md:rounded-2xl shadow-sm focus-visible:ring-accent/30 text-sm"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>

          <Button 
            onClick={() => setIsCreateOpen(true)}
            className="bg-accent hover:bg-accent/90 text-white font-black h-11 md:h-12 px-6 rounded-xl md:rounded-2xl shadow-lg shadow-accent/20"
          >
            <Plus className="mr-2 h-4 w-4 md:h-5 md:w-5" />
            Add New Client
          </Button>
        </div>

        {isLoading ? (
          <div className="h-[40vh] flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Calculating balances...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="h-[40vh] text-center flex flex-col items-center justify-center bg-white rounded-2xl md:rounded-3xl shadow-sm p-8 md:p-12">
            <Users className="h-8 w-8 opacity-20 mb-4" />
            <p className="font-bold text-primary">No clients found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
            {filteredClients.map((client) => {
              const stats = getClientStats(client);
              return (
                <Card key={client.id} className="border border-border/40 shadow-sm rounded-2xl md:rounded-[32px] overflow-hidden hover:shadow-lg transition-all duration-300 bg-white group flex flex-col">
                  <CardContent className="p-5 md:p-8 space-y-4 md:space-y-6 flex-1">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                          <Building2 className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground/70" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg md:text-2xl font-black text-primary truncate leading-tight">
                            {client.name}
                          </h3>
                          <p className="text-[10px] md:text-xs font-bold text-muted-foreground truncate">{client.email}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl p-2 w-44">
                          <DropdownMenuItem className="px-3 py-2 font-bold" onSelect={() => setEditingClient(client)}>
                            <Edit2 className="mr-2 h-4 w-4" /> Edit Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 px-3 py-2 font-bold" onSelect={() => setIdToDelete(client.id!)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-2 md:space-y-4 pt-4 border-t border-muted/50">
                      <div className="flex items-center justify-between text-[10px] md:text-sm">
                        <span className="font-bold text-muted-foreground/70 uppercase tracking-tighter">Invoices:</span>
                        <span className="font-black text-primary">{stats.count}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] md:text-sm">
                        <span className="font-bold text-muted-foreground/70 uppercase tracking-tighter">Invoiced:</span>
                        <span className="font-black text-amber-600">₹{stats.totalInvoiced.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] md:text-sm">
                        <span className="font-bold text-muted-foreground/70 uppercase tracking-tighter">Paid:</span>
                        <span className="font-black text-emerald-600">₹{stats.paid.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] md:text-sm">
                        <span className="font-bold text-muted-foreground/70 uppercase tracking-tighter">Overdue:</span>
                        <span className="font-black text-rose-500">₹{stats.overdue.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="pt-4 md:pt-6 space-y-2 md:space-y-3">
                      <p className="text-[8px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest">History</p>
                      {stats.recentInvoices.length > 0 && (
                        <div className="space-y-1 md:space-y-2">
                          {stats.recentInvoices.map((inv: any) => (
                            <Link href={`/invoices/${inv.id}`} key={inv.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg hover:bg-primary/5 transition-colors">
                              <span className="text-[9px] md:text-[10px] font-black text-primary">#{inv.id?.slice(-6).toUpperCase()}</span>
                              <span className="text-[9px] md:text-[10px] font-black text-primary">₹{(inv.totalAmount || 0).toLocaleString()}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <ClientFormDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <ClientFormDialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)} initialData={editingClient} />
      
      <AlertDialog open={!!idToDelete} onOpenChange={(open) => !open && setIdToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-primary">Delete Client Record?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium">
              This will permanently remove the client and their entire financial history.
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
    </DashboardLayout>
  );
}
