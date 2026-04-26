"use client"

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarFooter, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger
} from '@/components/ui/sidebar';
import { 
  LayoutDashboard, 
  FileText, 
  Settings, 
  LogOut, 
  PlusCircle,
  Loader2,
  Bell,
  Search,
  Users,
  Download
} from 'lucide-react';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { doc } from 'firebase/firestore';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = () => {
      if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choiceResult: any) => {
              if (choiceResult.outcome === 'accepted') {
                  console.log('User accepted the install prompt');
              }
              setDeferredPrompt(null);
          });
      } else {
        alert("The app is already installed or your browser does not support automatic installation. You can usually install it via your browser's menu (e.g., 'Add to Home Screen' or 'Install App').");
      }
  };

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: profile } = useDoc(profileRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Clients', href: '/clients', icon: Users },
    { name: 'All Invoices', href: '/invoices', icon: FileText },
    { name: 'New Invoice', href: '/invoices/new', icon: PlusCircle },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background w-full">
        <Sidebar className="border-r border-sidebar-border" variant="sidebar" collapsible="icon">
          <SidebarHeader className="p-4 md:p-6">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="bg-accent p-2 rounded-lg shadow-lg">
                <FileText className="text-white h-5 w-5" />
              </div>
              <span className="text-lg md:text-xl font-extrabold text-white tracking-tight group-data-[collapsible=icon]:hidden">
                {profile?.companyName || "InvoiceFlow"}
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent className="px-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.name} className="my-0.5 md:my-1">
                  <SidebarMenuButton 
                    asChild
                    isActive={pathname === item.href}
                    className={`transition-all duration-200 py-5 md:py-6 rounded-xl ${pathname === item.href ? 'bg-accent/20 text-accent' : 'hover:bg-white/5'}`}
                    tooltip={item.name}
                  >
                    <Link href={item.href}>
                      <item.icon className={`h-4 w-4 md:h-5 md:w-5 mr-3 ${pathname === item.href ? 'text-accent' : 'text-white/60'}`} />
                      <span className="font-semibold text-xs md:text-sm">{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem className="my-0.5 md:my-1">
                  <SidebarMenuButton 
                    onClick={handleInstall}
                    className="transition-all duration-200 py-5 md:py-6 rounded-xl hover:bg-white/5"
                    tooltip="Install App"
                  >
                    <Download className="h-4 w-4 md:h-5 md:w-5 mr-3 text-white/60" />
                    <span className="font-semibold text-xs md:text-sm">Install App</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-3 md:p-4 mt-auto">
            <div className="bg-white/5 rounded-2xl p-3 md:p-4 border border-white/10 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:border-0">
              <div className="flex items-center gap-3 mb-4 group-data-[collapsible=icon]:hidden">
                <Avatar className="h-8 w-8 md:h-10 md:w-10 ring-2 ring-accent/30 ring-offset-2 ring-offset-sidebar-background overflow-hidden rounded-xl">
                  <AvatarImage src={profile?.avatarUrl || user.photoURL || undefined} className="object-cover" />
                  <AvatarFallback className="bg-primary text-white font-bold text-xs">
                    {profile?.companyName?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                  <p className="text-xs md:text-sm font-bold text-white truncate">{profile?.companyName || user.email?.split('@')[0]}</p>
                  <p className="text-[9px] md:text-[10px] text-accent uppercase font-bold tracking-widest">Business</p>
                </div>
              </div>
              <SidebarMenuButton 
                onClick={handleLogout}
                className="w-full justify-center bg-white/5 hover:bg-destructive/90 hover:text-white transition-all rounded-xl h-9 md:h-10"
              >
                <LogOut className="h-3.5 w-3.5 md:h-4 md:w-4 mr-2" />
                <span className="text-xs md:text-sm group-data-[collapsible=icon]:hidden">Logout</span>
              </SidebarMenuButton>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex-1 flex flex-col min-w-0 bg-background">
          <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b">
            <div className="flex items-center gap-4 md:gap-6 flex-1">
              <SidebarTrigger className="h-9 w-9 md:h-10 md:w-10" />
              <div className="relative max-w-xs md:max-w-md w-full hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search transactions..." 
                  className="pl-10 h-9 md:h-10 bg-muted/50 border-none rounded-xl focus-visible:ring-accent/50 text-xs md:text-sm" 
                />
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <Button variant="ghost" size="icon" className="text-muted-foreground rounded-full h-9 w-9 md:h-10 md:w-10">
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
              <div className="h-6 md:h-8 w-[1px] bg-border mx-1 md:mx-2" />
              <Avatar className="h-8 w-8 md:h-10 md:w-10 ring-2 ring-accent ring-offset-2 overflow-hidden rounded-xl">
                <AvatarImage src={profile?.avatarUrl || user.photoURL || undefined} className="object-cover" />
                <AvatarFallback className="bg-primary text-white text-xs md:text-sm">
                  {profile?.companyName?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
