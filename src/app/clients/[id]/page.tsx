"use client"

import { use, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  MapPin, 
  FileText, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Plus,
  Loader2,
  Calendar,
  Download
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { generateInvoicePDF } from '@/lib/pdf-generator';

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useUser();
  const firestore = useFirestore();

  const clientRef = useMemoFirebase(() => {
    if (!firestore || !user || !id) return null;
    return doc(firestore, 'users', user.uid, 'clients', id);
  }, [firestore, user, id]);

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !id) return null;
    // Filtering by clientId and sorting by date
    return query(
      collection(firestore, 'users', user.uid, 'invoices'),
      where('clientId', '==', id),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user, id]);

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: client, isLoading: isClientLoading } = useDoc(clientRef);
  const { data: invoices, isLoading: isInvoicesLoading } = useCollection(invoicesQuery);
  const { data: profile } = useDoc(profileRef);

  // Stats Calculations
  const totalInvoiced = invoices?.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0) || 0;
  const paidAmount = invoices?.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.totalAmount || 0), 0) || 0;
  const pendingAmount = totalInvoiced - paidAmount;
  const totalCount = invoices?.length || 0;

  if (isClientLoading) {
    return (
      <DashboardLayout>
        <div className="h-[60vh] flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-accent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout>
        <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
          <p className="text-muted-foreground font-bold">Client not found.</p>
          <Link href="/clients">
            <Button variant="outline">Back to Clients</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-4">
            <Link href="/clients" className="inline-flex items-center text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Clients
            </Link>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <FileText className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight text-primary">{client.name}</h1>
                <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4" /> {client.email}
                </p>
              </div>
            </div>
          </div>
          <Link href={`/invoices/new?clientId=${client.id}`}>
            <Button className="bg-accent hover:bg-accent/90 text-white font-black h-12 px-6 rounded-xl shadow-lg shadow-accent/20">
              <Plus className="mr-2 h-5 w-5" />
              New Invoice for {client.name.split(' ')[0]}
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Invoiced', value: `₹${totalInvoiced.toLocaleString()}`, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/5' },
            { label: 'Paid Revenue', value: `₹${paidAmount.toLocaleString()}`, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Outstanding', value: `₹${pendingAmount.toLocaleString()}`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Total Invoices', value: totalCount, icon: FileText, color: 'text-accent', bg: 'bg-accent/5' },
          ].map((stat, i) => (
            <Card key={i} className="border-none shadow-sm premium-card-hover">
              <CardContent className="p-6">
                <div className={`${stat.bg} ${stat.color} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                <h3 className="text-2xl font-black text-primary mt-1">{stat.value}</h3>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Invoice List */}
          <Card className="lg:col-span-2 border-none shadow-sm rounded-2xl overflow-hidden premium-shadow">
            <CardHeader className="bg-muted/30 border-b pb-6 px-8">
              <CardTitle className="text-2xl font-bold">Billing History</CardTitle>
              <CardDescription>Track all invoices and payment statuses for this client.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isInvoicesLoading ? (
                <div className="py-20 flex justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-accent" />
                </div>
              ) : !invoices || invoices.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto opacity-10 mb-4" />
                  <p className="font-bold">No invoices found for this client.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow className="border-none hover:bg-transparent">
                        <TableHead className="font-black text-xs uppercase tracking-widest px-8">Invoice</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-widest">Date</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-widest text-right">Amount</TableHead>
                        <TableHead className="font-black text-xs uppercase tracking-widest text-center">Status</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => (
                        <TableRow key={inv.id} className="border-border/50 group hover:bg-muted/20">
                          <TableCell className="px-8 py-6">
                            <Link href={`/invoices/${inv.id}`} className="font-bold text-primary group-hover:text-accent transition-colors">
                              #{inv.id?.slice(-6).toUpperCase()}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-primary/60">
                            {inv.createdAt ? format(new Date(inv.createdAt), 'MMM dd, yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-black text-primary">₹{(inv.totalAmount || 0).toLocaleString()}</span>
                          </TableCell>
                          <TableCell className="text-center">
                             <Badge className={`border-none font-black px-3 py-1 ${
                               inv.status === 'paid' ? 'bg-green-100 text-green-700' : 
                               inv.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                             }`}>
                               {inv.status?.toUpperCase()}
                             </Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="rounded-full hover:bg-accent/10 text-primary"
                              onClick={() => generateInvoicePDF(inv, profile)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client Details Sidebar */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden premium-shadow">
              <CardHeader className="bg-muted/30 border-b pb-6">
                <CardTitle className="text-xl font-bold">Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Phone</p>
                      <p className="font-bold text-primary">{client.phoneNumber || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Address</p>
                      <p className="font-bold text-primary leading-tight">{client.address || 'No address details'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Client Since</p>
                      <p className="font-bold text-primary">{client.createdAt ? format(new Date(client.createdAt), 'MMMM yyyy') : 'Recently'}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t">
                   <div className="p-4 bg-accent/5 rounded-2xl text-center">
                     <p className="text-xs font-bold text-accent-foreground">Client Reliability</p>
                     <div className="mt-2 h-2 w-full bg-accent/10 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-accent transition-all duration-1000" 
                         style={{ width: `${totalCount > 0 && totalInvoiced > 0 ? (paidAmount / totalInvoiced) * 100 : 0}%` }}
                       />
                     </div>
                     <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-widest">
                       {totalCount > 0 && totalInvoiced > 0 ? `${Math.round((paidAmount / totalInvoiced) * 100)}% Paid Ratio` : 'No history yet'}
                     </p>
                   </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}