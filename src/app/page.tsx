
"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FileText, ArrowRight, ShieldCheck, Zap, Globe, MousePointer2 } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/firebase';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading) return null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
              <FileText className="text-white h-6 w-6" />
            </div>
            <span className="text-2xl font-black text-primary tracking-tight">InvoiceFlow</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
              Log In
            </Link>
            <Link href="/register">
              <Button className="bg-accent hover:bg-accent/90 text-white font-black px-6 rounded-xl h-11">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative py-24 lg:py-40 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-5">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent rounded-full blur-[120px]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary rounded-full blur-[120px]" />
          </div>
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center space-y-10">
              <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-4 duration-1000">
                <MousePointer2 className="h-4 w-4" />
                Trusted by 5,000+ Businesses
              </div>
              <h1 className="text-6xl lg:text-8xl font-black tracking-tighter text-primary leading-[1.05] animate-in fade-in slide-in-from-bottom-8 duration-700">
                Invoicing for the <span className="text-accent">Modern</span> Professional.
              </h1>
              <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-in fade-in duration-1000 delay-300">
                Streamline your billing, automate collection, and delight your clients with beautiful, professional invoices.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
                <Link href="/register">
                  <Button size="lg" className="h-16 px-10 text-lg font-black bg-primary hover:bg-primary/90 rounded-2xl shadow-2xl shadow-primary/20">
                    Get Started Free
                    <ArrowRight className="ml-2 h-6 w-6" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="ghost" className="h-16 px-10 text-lg font-bold text-primary hover:bg-primary/5 rounded-2xl">
                    Explore Demo
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="py-32 bg-white">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
              <h2 className="text-4xl font-black text-primary tracking-tight">Everything you need to get paid.</h2>
              <p className="text-muted-foreground font-medium">Built for freelancers, agencies, and small businesses looking for an edge.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-10">
              {[
                { 
                  icon: Zap, 
                  title: "AI Descriptions", 
                  desc: "Generate professional service descriptions in seconds with our integrated Gemini AI engine.",
                  color: "bg-amber-100 text-amber-600"
                },
                { 
                  icon: ShieldCheck, 
                  title: "Instant Payments", 
                  desc: "Direct Razorpay integration allows your clients to pay you instantly via UPI, Cards, or Netbanking.",
                  color: "bg-blue-100 text-blue-600"
                },
                { 
                  icon: Globe, 
                  title: "Global Export", 
                  desc: "Download high-quality PDFs or send them directly to your clients with automated email delivery.",
                  color: "bg-emerald-100 text-emerald-600"
                }
              ].map((feature, i) => (
                <div key={i} className="group p-10 rounded-3xl bg-background border border-border/50 hover:border-accent hover:shadow-2xl hover:shadow-accent/5 transition-all duration-500">
                  <div className={`${feature.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-black mb-4 text-primary">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed font-medium">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-20 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-xl">
                <FileText className="text-primary h-6 w-6" />
              </div>
              <span className="text-xl font-black text-primary tracking-tight">InvoiceFlow</span>
            </div>
            <div className="text-sm font-bold text-muted-foreground">
              © 2024 InvoiceFlow Inc. Crafted for professionals.
            </div>
            <div className="flex gap-8">
              <Link href="#" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">Privacy</Link>
              <Link href="#" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">Terms</Link>
              <Link href="#" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">Support</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
