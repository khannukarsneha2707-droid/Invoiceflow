
"use client"

import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { InstallPrompt } from '@/components/InstallPrompt';
import { NotionImportDialog } from '@/components/invoices/notion-import-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Plus,
  Download,
  Mail,
  Loader2,
  Users,
  BarChart3,
  BellRing,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { useCollection, useDoc, useUser, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { sendInvoiceEmail } from '@/app/lib/actions/send-email';
import { useToast } from '@/hooks/use-toast';
import { 
  format, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval, 
  isPast, 
  subWeeks, 
  startOfWeek, 
  endOfWeek 
} from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSending, setIsSending] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'monthly' | 'weekly'>('monthly');

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'invoices'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user]);

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: invoices, isLoading } = useCollection(invoicesQuery);
  const { data: profile } = useDoc(profileRef);

  const stats = useMemo(() => {
    if (!invoices) return null;
    const total = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const paid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const pending = invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const overdue = invoices.filter(inv => inv.status === 'overdue').length;

    return { total, paid, pending, overdue };
  }, [invoices]);

  const needsAttention = useMemo(() => {
    if (!invoices) return [];
    return invoices
      .filter(inv => inv.status !== 'paid' && inv.dueDate && isPast(new Date(inv.dueDate)))
      .slice(0, 5);
  }, [invoices]);

  const chartData = useMemo(() => {
    if (!invoices) return [];

    if (viewType === 'monthly') {
      const months = Array.from({ length: 6 }).map((_, i) => {
        const date = subMonths(new Date(), i);
        return {
          label: format(date, 'MMM'),
          fullName: format(date, 'MMMM yyyy'),
          start: startOfMonth(date),
          end: endOfMonth(date),
          revenue: 0
        };
      }).reverse();

      invoices.forEach(inv => {
        if (!inv.createdAt) return;
        const invDate = new Date(inv.createdAt);
        months.forEach(m => {
          if (isWithinInterval(invDate, { start: m.start, end: m.end })) {
            m.revenue += inv.totalAmount || 0;
          }
        });
      });
      return months;
    } else {
      const weeks = Array.from({ length: 8 }).map((_, i) => {
        const date = subWeeks(new Date(), i);
        return {
          label: format(startOfWeek(date), 'MMM dd'),
          fullName: `Week of ${format(startOfWeek(date), 'MMM dd, yyyy')}`,
          start: startOfWeek(date),
          end: endOfWeek(date),
          revenue: 0
        };
      }).reverse();

      invoices.forEach(inv => {
        if (!inv.createdAt) return;
        const invDate = new Date(inv.createdAt);
        weeks.forEach(w => {
          if (isWithinInterval(invDate, { start: w.start, end: w.end })) {
            w.revenue += inv.totalAmount || 0;
          }
        });
      });
      return weeks;
    }
  }, [invoices, viewType]);

  const topClients = useMemo(() => {
    if (!invoices) return [];
    const clientMap = new Map();
    invoices.forEach(inv => {
      const current = clientMap.get(inv.clientName) || 0;
      clientMap.set(inv.clientName, current + (inv.totalAmount || 0));
    });
    return Array.from(clientMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [invoices]);

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

      const invRef = doc(firestore, 'users', user.uid, 'invoices', invoice.id);
      updateDocumentNonBlocking(invRef, {
        lastReminderSentAt: new Date().toISOString()
      });

      toast({ 
        title: "Reminder Sent!", 
        description: `Payment reminder with PDF has been sent to ${invoice.clientEmail}` 
      });
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Email Failed", 
        description: error.message || "Could not send the reminder." 
      });
    } finally {
      setIsSending(null);
    }
  };

  const dashboardStats = [
    { name: 'Total Revenue', value: stats ? `₹${stats.total.toLocaleString()}` : '₹0', icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10', desc: 'Lifetime invoiced' },
    { name: 'Paid Revenue', value: stats ? `₹${stats.paid.toLocaleString()}` : '₹0', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', desc: 'Successfully collected' },
    { name: 'Pending', value: stats ? `₹${stats.pending.toLocaleString()}` : '₹0', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Waiting for payment' },
    { name: 'Overdue', value: stats?.overdue || 0, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', desc: 'Action required' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
          <div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-primary">Financial Overview</h1>
            <p className="text-muted-foreground text-sm md:text-lg mt-1">Track growth and collection health.</p>
            <div className="mt-4">
              <InstallPrompt />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotionImportDialog />
            <Link href="/invoices/new" className="w-full md:w-auto">
              <Button className="w-full bg-accent hover:bg-accent/90 text-white font-black h-11 md:h-12 px-6 rounded-xl shadow-lg shadow-accent/20">
                <Plus className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                New Invoice
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {dashboardStats.map((stat) => (
            <Card key={stat.name} className="border-none shadow-sm premium-card-hover">
              <CardContent className="p-4 md:p-6">
                <div className={`${stat.bg} ${stat.color} w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4`}>
                  <stat.icon className="h-4 w-4 md:h-6 md:w-6" />
                </div>
                <p className="text-[9px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest">{stat.name}</p>
                <h3 className="text-lg md:text-3xl font-black text-primary mt-0.5 md:mt-1 truncate">{stat.value}</h3>
                <p className="hidden md:block text-[10px] text-muted-foreground mt-1 font-medium">{stat.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <Card className="lg:col-span-2 border-none shadow-sm rounded-2xl md:rounded-3xl overflow-hidden premium-shadow">
            <CardHeader className="bg-white border-b py-4 md:py-8 px-4 md:px-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg md:text-2xl font-bold">Revenue Growth</CardTitle>
                  <CardDescription className="text-[10px] md:text-sm">Billing volume trend</CardDescription>
                </div>
                <Tabs value={viewType} onValueChange={(v: any) => setViewType(v)} className="w-full sm:w-auto">
                  <TabsList className="bg-muted/50 rounded-lg md:rounded-xl p-1 h-8 md:h-10 w-full sm:w-auto">
                    <TabsTrigger value="monthly" className="flex-1 sm:flex-none rounded-md md:rounded-lg px-3 md:px-4 font-bold text-[10px] md:text-sm">Monthly</TabsTrigger>
                    <TabsTrigger value="weekly" className="flex-1 sm:flex-none rounded-md md:rounded-lg px-3 md:px-4 font-bold text-[10px] md:text-sm">Weekly</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="pt-4 md:pt-8 px-2 md:px-4">
              <div className="h-[220px] md:h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="label" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#888', fontWeight: 600 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#888' }}
                      tickFormatter={(value) => `₹${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                      formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Revenue']}
                      labelFormatter={(label, payload) => payload[0]?.payload.fullName || label}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--accent))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-2xl md:rounded-3xl overflow-hidden premium-shadow bg-rose-50/30">
            <CardHeader className="bg-white/50 border-b py-4 md:py-8 px-4 md:px-8">
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4 md:h-5 md:w-5 text-rose-500" />
                <CardTitle className="text-lg md:text-2xl font-bold text-rose-700">Attention</CardTitle>
              </div>
              <CardDescription className="text-[10px] md:text-sm">Overdue invoices</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 md:pt-8 space-y-3 md:space-y-4">
              {needsAttention.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto opacity-20 mb-3" />
                  <p className="text-[10px] font-bold text-muted-foreground">All caught up!</p>
                </div>
              ) : (
                needsAttention.map((inv) => (
                  <div key={inv.id} className="bg-white p-3 rounded-xl md:rounded-2xl shadow-sm border border-rose-100 flex items-center justify-between group">
                    <div className="min-w-0 pr-2">
                      <p className="font-black text-primary text-xs md:text-sm truncate">{inv.clientName}</p>
                      <p className="text-[8px] md:text-[9px] font-bold text-rose-600 uppercase tracking-widest mt-0.5">
                        Due {format(new Date(inv.dueDate), 'MMM dd')} • ₹{inv.totalAmount.toLocaleString()}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-xl hover:bg-rose-100 text-rose-600 shrink-0"
                      onClick={() => sendReminderWithPDF(inv)}
                      disabled={isSending === inv.id}
                    >
                      {isSending === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3 md:h-4 md:w-4" />}
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <Card className="lg:col-span-1 border-none shadow-sm rounded-2xl md:rounded-3xl overflow-hidden premium-shadow">
            <CardHeader className="bg-white border-b py-4 md:py-8 px-4 md:px-8">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                <CardTitle className="text-base md:text-xl font-bold">Top Clients</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6">
              <div className="space-y-2 md:space-y-4">
                {topClients.map((client, i) => (
                  <div key={client.name} className="flex items-center justify-between p-2 md:p-4 hover:bg-muted/30 rounded-xl md:rounded-2xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 md:h-10 md:w-10 rounded-lg md:rounded-xl bg-primary/5 text-primary flex items-center justify-center font-black text-[10px] md:text-sm">
                        {i + 1}
                      </div>
                      <span className="font-bold text-primary truncate max-w-[80px] md:max-w-[120px] text-xs md:text-sm">{client.name}</span>
                    </div>
                    <span className="font-black text-accent text-xs md:text-sm">₹{client.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-none shadow-sm rounded-2xl md:rounded-3xl overflow-hidden premium-shadow">
            <CardHeader className="bg-white border-b py-4 md:py-8 px-4 md:px-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  <CardTitle className="text-base md:text-xl font-bold">Recent Invoices</CardTitle>
                </div>
                <Link href="/invoices">
                  <Button variant="ghost" size="sm" className="text-accent font-bold text-[10px] md:text-sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6">
              <div className="space-y-2 md:space-y-4">
                {invoices?.slice(0, 5).map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 md:p-5 bg-muted/20 rounded-xl md:rounded-[24px] group hover:bg-white hover:shadow-xl transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 md:h-12 md:w-12 rounded-lg md:rounded-2xl flex items-center justify-center ${invoice.status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                        <FileText className="h-4 w-4 md:h-6 md:w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-primary text-xs md:text-base leading-none mb-1 truncate max-w-[100px] md:max-w-none">{invoice.clientName}</p>
                        <p className="text-[8px] md:text-[10px] font-black uppercase text-accent tracking-widest">{invoice.status}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-6">
                      <div className="text-right">
                        <p className="font-black text-primary text-sm md:text-lg leading-none">₹{(invoice.totalAmount || 0).toLocaleString()}</p>
                      </div>
                      <div className="hidden sm:flex gap-1 md:gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10" onClick={() => generateInvoicePDF(invoice, profile)}>
                          <Download className="h-3.5 w-3.5 md:h-5 md:w-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
