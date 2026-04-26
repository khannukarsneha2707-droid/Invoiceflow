"use client"

import { useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser, useFirestore, useStorage, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Camera, Loader2, Save, Globe, Phone } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingRazorpay, setIsSavingRazorpay] = useState(false);

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const paymentSettingsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid, 'settings', 'payment');
  }, [firestore, user]);

  const { data: profile, isLoading } = useDoc(profileRef);
  const { data: paymentSettings } = useDoc(paymentSettingsRef);

  const handleSaveRazorpay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSavingRazorpay(true);
    const formData = new FormData(e.currentTarget);
    const razorpayKeyId = formData.get('razorpayKeyId') as string;
    const razorpaySecret = formData.get('razorpaySecret') as string;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/save-razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpayKeyId,
          razorpaySecret,
          userId: user.uid,
          idToken
        })
      });

      if (!response.ok) throw new Error('Failed to save Razorpay settings');

      toast({
        title: "Razorpay Saved",
        description: "Your Razorpay keys have been updated.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message || "Could not save Razorpay settings.",
      });
    } finally {
      setIsSavingRazorpay(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !storage || !profileRef) {
      if (!user) toast({ variant: "destructive", title: "Authentication Required", description: "Please sign in to upload a logo." });
      if (!storage) toast({ variant: "destructive", title: "Storage Error", description: "Storage service is not available." });
      return;
    }

    // Max 2MB check
    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Please upload an image smaller than 2MB.",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Ensure path matches rules: /users/{userId}/{allPaths=**}
      const storageRef = ref(storage, `users/${user.uid}/avatar`);
      
      console.log(`Attempting upload to: ${storageRef.fullPath} in bucket: ${storage.app.options.storageBucket}`);
      
      // Upload the file
      await uploadBytes(storageRef, file);
      
      // Get the public download URL
      const downloadUrl = await getDownloadURL(storageRef);
      
      // Update the user's profile in Firestore
      setDocumentNonBlocking(profileRef, {
        id: user.uid,
        email: user.email,
        avatarUrl: downloadUrl,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      toast({
        title: "Logo Uploaded",
        description: "Your business logo has been successfully updated.",
      });
    } catch (error: any) {
      console.error("Storage upload error detailed:", error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message || "Permission denied or network error. Check console for details.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profileRef || !user) return;
    
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const companyName = formData.get('companyName') as string;
    const companyAddress = formData.get('companyAddress') as string;
    const contactPhone = formData.get('contactPhone') as string;
    const website = formData.get('website') as string;

    try {
      setDocumentNonBlocking(profileRef, {
        id: user.uid,
        email: user.email,
        companyName,
        companyAddress,
        contactPhone,
        website,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      toast({
        title: "Settings Saved",
        description: "Your business profile has been updated.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message || "Could not save settings.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return (
    <DashboardLayout>
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">Settings</h1>
          <p className="text-muted-foreground">Manage your profile and business information for invoices.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="md:col-span-1 border-border shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/30 pb-6">
              <CardTitle className="text-xl font-bold">Business Logo</CardTitle>
              <CardDescription>This logo appears on your PDFs.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6 pt-8">
              <div 
                className="relative group cursor-pointer"
                onClick={handleAvatarClick}
              >
                <div className="h-32 w-32 rounded-2xl border-2 border-dashed border-muted-foreground/20 flex items-center justify-center bg-muted/20 group-hover:bg-muted/30 transition-colors overflow-hidden">
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="Logo" className="h-full w-full object-contain p-2" />
                  ) : (
                    <Camera className="h-10 w-10 text-muted-foreground/40" />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="text-white h-8 w-8" />
                  </div>
                </div>
                {isUploading && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-2xl">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange}
              />
              <div className="text-center space-y-1">
                <p className="text-xs font-bold text-primary uppercase tracking-widest">Recommended</p>
                <p className="text-[10px] text-muted-foreground uppercase">Square PNG, max 2MB</p>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 border-border shadow-sm rounded-2xl overflow-hidden">
            <form onSubmit={handleSaveProfile}>
              <CardHeader className="bg-muted/30 pb-6 border-b">
                <CardTitle className="text-xl font-bold">Business Information</CardTitle>
                <CardDescription>Control how your brand appears to clients.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="companyName" className="text-xs font-bold uppercase text-primary/60 tracking-widest">Company Name</Label>
                    <Input 
                      id="companyName" 
                      name="companyName"
                      defaultValue={profile?.companyName} 
                      placeholder="e.g. Acme Solutions LLC"
                      className="h-12 rounded-xl bg-muted/30 border-none focus-visible:ring-accent"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone" className="text-xs font-bold uppercase text-primary/60 tracking-widest">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="contactPhone" 
                        name="contactPhone"
                        defaultValue={profile?.contactPhone} 
                        placeholder="+91 98765 43210"
                        className="h-12 pl-10 rounded-xl bg-muted/30 border-none focus-visible:ring-accent"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website" className="text-xs font-bold uppercase text-primary/60 tracking-widest">Website URL</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="website" 
                      name="website"
                      defaultValue={profile?.website} 
                      placeholder="https://www.yourcompany.com"
                      className="h-12 pl-10 rounded-xl bg-muted/30 border-none focus-visible:ring-accent"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyAddress" className="text-xs font-bold uppercase text-primary/60 tracking-widest">Business Address</Label>
                  <Input 
                    id="companyAddress" 
                    name="companyAddress"
                    defaultValue={profile?.companyAddress} 
                    placeholder="123 Financial District, Mumbai, India"
                    className="h-12 rounded-xl bg-muted/30 border-none focus-visible:ring-accent"
                  />
                </div>

                <div className="p-4 bg-primary/5 rounded-2xl">
                  <p className="text-xs text-primary/60 font-medium leading-relaxed">
                    Note: Your login email <span className="font-bold text-primary">{user?.email}</span> is used as the default return address for invoices.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-6 pb-8 bg-muted/20">
                <Button type="submit" disabled={isSaving} className="ml-auto font-black px-8 h-12 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Business Profile
                </Button>
              </CardFooter>
            </form>
          </Card>
          
          <Card className="md:col-span-3 border-border shadow-sm rounded-2xl overflow-hidden">
            <form onSubmit={handleSaveRazorpay}>
              <CardHeader className="bg-muted/30 pb-6 border-b">
                <CardTitle className="text-xl font-bold">Razorpay Credentials</CardTitle>
                <CardDescription>Configure your payment processor.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="razorpayKeyId" className="text-xs font-bold uppercase text-primary/60 tracking-widest">Key ID</Label>
                    <Input 
                      id="razorpayKeyId" 
                      name="razorpayKeyId"
                      defaultValue={paymentSettings?.razorpayKeyId} 
                      placeholder="rzp_live_..."
                      className="h-12 rounded-xl bg-muted/30 border-none focus-visible:ring-accent"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="razorpaySecret" className="text-xs font-bold uppercase text-primary/60 tracking-widest">Secret Key</Label>
                    <Input 
                      id="razorpaySecret" 
                      name="razorpaySecret"
                      type="password"
                      placeholder="••••••••••••••••"
                      className="h-12 rounded-xl bg-muted/30 border-none focus-visible:ring-accent"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-6 pb-8 bg-muted/20">
                <Button type="submit" disabled={isSavingRazorpay} className="ml-auto font-black px-8 h-12 rounded-xl bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20">
                  {isSavingRazorpay ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Razorpay Settings
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
