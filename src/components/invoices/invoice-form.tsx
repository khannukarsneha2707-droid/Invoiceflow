"use client"

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Trash2, Plus, Calendar as CalendarIcon, Loader2, Save, Info, UserPlus, Percent } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { AIDescriptionTool } from './ai-description-tool';
import { Invoice } from '@/lib/invoice-store';
import { useCollection, useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import Link from 'next/link';

const invoiceSchema = z.object({
  clientId: z.string().min(1, 'Please select a client'),
  clientName: z.string().min(2, 'Client name is required'),
  clientEmail: z.string().email('Invalid email address'),
  status: z.enum(['pending', 'paid', 'overdue']),
  dueDate: z.date({ required_error: 'Due date is required' }),
  taxRate: z.coerce.number().min(0, 'Min 0').max(100, 'Max 100'),
  items: z.array(z.object({
    description: z.string().min(1, 'Description is required'),
    quantity: z.coerce.number().min(1, 'Min 1'),
    unitPrice: z.coerce.number().min(0, 'Min 0'),
  })).min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
  initialData?: Partial<Invoice>;
  onSubmit: (values: InvoiceFormValues) => Promise<void>;
  isSubmitting?: boolean;
}

export function InvoiceForm({ initialData, onSubmit, isSubmitting }: InvoiceFormProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  const clientsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'users', user.uid, 'clients'),
      orderBy('name', 'asc')
    );
  }, [firestore, user]);

  const { data: clients, isLoading: loadingClients } = useCollection(clientsQuery);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      clientId: initialData?.clientId || '',
      clientName: initialData?.clientName || '',
      clientEmail: initialData?.clientEmail || '',
      status: initialData?.status || 'pending',
      taxRate: initialData?.taxRate ?? 0,
      dueDate: initialData?.dueDate ? new Date(initialData.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      items: initialData?.items?.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })) || [{ description: '', quantity: 1, unitPrice: 0 }],
      notes: initialData?.notes || '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch('items');
  const watchTaxRate = form.watch('taxRate');
  
  const subtotal = watchItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const taxAmount = (subtotal * watchTaxRate) / 100;
  const totalAmount = subtotal + taxAmount;

  const handleClientChange = (clientId: string) => {
    const selectedClient = clients?.find(c => c.id === clientId);
    if (selectedClient) {
      form.setValue('clientId', clientId);
      form.setValue('clientName', selectedClient.name);
      form.setValue('clientEmail', selectedClient.email);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden premium-shadow">
              <CardHeader className="bg-muted/30 pb-6 border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl font-bold">Client Selection</CardTitle>
                    <CardDescription>Select a client from your database or create a new one.</CardDescription>
                  </div>
                  <Link href="/clients">
                    <Button type="button" variant="ghost" className="text-accent font-bold">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Manage Clients
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-8 pt-8">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem className="col-span-full">
                      <FormLabel className="font-bold text-primary/70 uppercase text-xs tracking-widest">Choose Client</FormLabel>
                      <Select 
                        onValueChange={handleClientChange} 
                        defaultValue={field.value}
                        disabled={loadingClients}
                      >
                        <FormControl>
                          <SelectTrigger className="h-14 bg-muted/30 border-none rounded-xl text-lg font-bold">
                            <SelectValue placeholder={loadingClients ? "Loading clients..." : "Select a client..."} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          {clients?.map((client) => (
                            <SelectItem key={client.id} value={client.id!} className="cursor-pointer py-3">
                              <div className="flex flex-col">
                                <span className="font-bold">{client.name}</span>
                                <span className="text-xs text-muted-foreground">{client.email}</span>
                              </div>
                            </SelectItem>
                          ))}
                          {!loadingClients && clients?.length === 0 && (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              No clients found. Please add a client first.
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="col-span-1 opacity-50 pointer-events-none">
                   <Label className="font-bold text-primary/70 uppercase text-xs tracking-widest">Name (Auto-filled)</Label>
                   <Input value={form.watch('clientName')} readOnly className="h-12 bg-muted/30 border-none rounded-xl mt-2" />
                </div>
                <div className="col-span-1 opacity-50 pointer-events-none">
                   <Label className="font-bold text-primary/70 uppercase text-xs tracking-widest">Email (Auto-filled)</Label>
                   <Input value={form.watch('clientEmail')} readOnly className="h-12 bg-muted/30 border-none rounded-xl mt-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-2xl overflow-hidden premium-shadow">
              <CardHeader className="bg-muted/30 flex flex-row items-center justify-between border-b pb-6">
                <div>
                  <CardTitle className="text-2xl font-bold">Line Items</CardTitle>
                  <CardDescription>Detail the products or services provided.</CardDescription>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="border-accent text-accent hover:bg-accent/5 font-black rounded-xl h-10 px-4"
                  onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Item
                </Button>
              </CardHeader>
              <CardContent className="space-y-6 pt-8">
                <div className="hidden md:grid grid-cols-12 gap-6 text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] pb-2 px-2">
                  <div className="col-span-6">Item Name / Description</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-3">Unit Price (₹)</div>
                  <div className="col-span-1"></div>
                </div>
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start bg-muted/20 md:bg-transparent p-6 md:p-0 rounded-2xl transition-all">
                    <div className="col-span-1 md:col-span-6 space-y-3">
                      <Label className="md:hidden font-bold">Item Description</Label>
                      <FormField
                        control={form.control}
                        name={`items.${index}.description`}
                        render={({ field }) => (
                          <div className="space-y-2">
                            <FormControl>
                              <Input placeholder="Web Design & Development..." {...field} className="h-12 bg-white border-none rounded-xl shadow-sm" />
                            </FormControl>
                            <AIDescriptionTool 
                              itemName={field.value} 
                              onSelect={(desc) => form.setValue(`items.${index}.description`, desc)} 
                            />
                            <FormMessage />
                          </div>
                        )}
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2 space-y-3">
                      <Label className="md:hidden font-bold">Qty</Label>
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="number" {...field} className="h-12 bg-white border-none rounded-xl shadow-sm md:text-center" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-1 md:col-span-3 space-y-3">
                      <Label className="md:hidden font-bold">Price (₹)</Label>
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} className="h-12 bg-white border-none rounded-xl shadow-sm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-1 md:col-span-1 flex justify-end md:justify-center pt-2 md:pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
              <CardFooter className="bg-primary/5 border-t flex flex-col md:flex-row justify-between items-start p-8 gap-8">
                <div className="w-full md:flex-1 space-y-6">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className="font-bold text-primary/70 uppercase text-xs tracking-widest">Additional Notes</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Please include Project ID in payment reference" {...field} className="h-12 bg-white border-none rounded-xl shadow-sm" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="taxRate"
                    render={({ field }) => (
                      <FormItem className="w-full md:max-w-[200px]">
                        <FormLabel className="font-bold text-primary/70 uppercase text-xs tracking-widest flex items-center gap-2">
                          Tax Percentage (%)
                          <Percent className="h-3 w-3 text-muted-foreground" />
                        </FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="18" {...field} className="h-12 bg-white border-none rounded-xl shadow-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="w-full md:w-auto space-y-3 pt-6">
                  <div className="flex justify-between items-center text-muted-foreground gap-12">
                    <span className="text-xs font-black uppercase tracking-widest">Subtotal</span>
                    <span className="font-bold">₹{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground gap-12">
                    <span className="text-xs font-black uppercase tracking-widest">Tax ({watchTaxRate}%)</span>
                    <span className="font-bold">₹{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="h-[1px] bg-border w-full my-4" />
                  <div className="flex justify-between items-center text-primary gap-12">
                    <span className="text-xs font-black uppercase tracking-widest">Total Amount</span>
                    <span className="text-3xl font-black">₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </CardFooter>
            </Card>
          </div>

          <div className="space-y-8">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden premium-shadow">
              <CardHeader className="bg-muted/30 border-b pb-6">
                <CardTitle className="text-2xl font-bold">Status & Dates</CardTitle>
                <CardDescription>Control visibility and deadlines.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8 pt-8">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-primary/70 uppercase text-xs tracking-widest">Invoice Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 bg-muted/30 border-none rounded-xl">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          <SelectItem value="pending">Pending Review</SelectItem>
                          <SelectItem value="paid">Mark as Paid</SelectItem>
                          <SelectItem value="overdue">Mark as Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="font-bold text-primary/70 uppercase text-xs tracking-widest">Payment Deadline</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "h-12 pl-3 text-left font-semibold bg-muted/30 border-none rounded-xl",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Select a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-5 w-5 text-muted-foreground" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="p-4 bg-accent/5 rounded-2xl flex gap-3">
                  <Info className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <p className="text-xs text-accent-foreground leading-relaxed font-medium">
                    This invoice will be sent to the client's email upon creation.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="pt-4 pb-8">
                <Button 
                  type="submit" 
                  className="w-full bg-accent hover:bg-accent/90 text-white font-black h-14 rounded-xl shadow-lg shadow-accent/20 transition-all text-lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                  {initialData?.id ? "Update Record" : "Confirm & Save"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
