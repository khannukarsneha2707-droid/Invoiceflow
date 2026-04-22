
"use client"

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, UserPlus } from 'lucide-react';

const clientSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  address: z.string().optional(),
  phoneNumber: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
}

export function ClientFormDialog({ open, onOpenChange, initialData }: ClientFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: initialData?.name || '',
      email: initialData?.email || '',
      address: initialData?.address || '',
      phoneNumber: initialData?.phoneNumber || '',
    },
  });

  const onSubmit = async (values: ClientFormValues) => {
    if (!user || !firestore) return;
    setLoading(true);
    try {
      if (initialData?.id) {
        const docRef = doc(firestore, 'users', user.uid, 'clients', initialData.id);
        updateDocumentNonBlocking(docRef, {
          ...values,
          updatedAt: new Date().toISOString(),
        });
        toast({ title: "Success", description: "Client updated successfully." });
      } else {
        const colRef = collection(firestore, 'users', user.uid, 'clients');
        const clientData = {
          ...values,
          id: doc(colRef).id,
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addDocumentNonBlocking(colRef, clientData);
        toast({ title: "Success", description: "Client added successfully." });
      }
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save client.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="bg-primary p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <UserPlus className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl font-black">{initialData ? 'Edit Client' : 'Add New Client'}</DialogTitle>
          </div>
          <DialogDescription className="text-white/80 font-medium">
            Store contact details for faster invoicing.
          </DialogDescription>
        </DialogHeader>
        <div className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Full Name / Company</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} className="h-12 bg-muted/30 border-none rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Billing Email</FormLabel>
                    <FormControl>
                      <Input placeholder="billing@acme.com" {...field} className="h-12 bg-muted/30 border-none rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+91..." {...field} className="h-12 bg-muted/30 border-none rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Mumbai, India" {...field} className="h-12 bg-muted/30 border-none rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" className="w-full h-14 bg-accent hover:bg-accent/90 text-white font-black rounded-xl text-lg" disabled={loading}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                {initialData ? 'Update Record' : 'Save Client'}
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
