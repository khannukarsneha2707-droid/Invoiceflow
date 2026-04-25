'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2 } from 'lucide-react';
import { createRazorpayOrder, verifyRazorpayPayment } from '@/app/lib/actions/razorpay';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, updateDocumentNonBlocking } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface PayButtonProps {
  invoice: any;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  showIcon?: boolean;
}

export function PayButton({ invoice, variant = "default", className, size = "sm", showIcon = true }: PayButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    // Load Razorpay Script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existingScript) document.body.removeChild(existingScript);
    };
  }, []);

  const handlePay = async () => {
    if (invoice.status === 'paid' || !firestore) return;
    
    // Check if Razorpay script is loaded
    if (!(window as any).Razorpay) {
      alert("Payment system loading. Try again.");
      return;
    }

    // Check for Razorpay Key ID
    const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    if (!key) {
      alert("Razorpay key missing");
      return;
    }
    
    setLoading(true);
    try {
      const integrationRef = doc(firestore, 'users', invoice.userId, 'integrations', 'razorpay');
      const integrationSnap = await getDoc(integrationRef);
      const keyId = integrationSnap.exists() ? integrationSnap.data()?.keyId : key;
      if (!keyId) {
        throw new Error("Razorpay not connected");
      }

      console.log("Calling create-order...");
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: invoice.totalAmount,
        }),
      });

      const order = await res.json();
      console.log("ORDER RESPONSE:", order);

      if (!order || !order.id) {
        alert("Order creation failed");
        return;
      }

      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'InvoiceFlow',
        description: `Payment for Invoice #${invoice.id.slice(-6).toUpperCase()}`,
        order_id: order.id,
        handler: async function (response: any) {
          // Verification
          const verification = await verifyRazorpayPayment({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
            userId: invoice.userId,
          });

          if (verification.success) {
            // Updated to handle public page where user is null
            // We use invoice.userId to reconstruct the path
            const ownerId = user?.uid || invoice.userId;
            if (!ownerId) throw new Error("Could not find invoice owner.");

            const docRef = doc(firestore, 'users', ownerId, 'invoices', invoice.id);
            updateDocumentNonBlocking(docRef, {
              status: 'paid',
              paymentId: response.razorpay_payment_id,
              updatedAt: new Date().toISOString(),
            });

            toast({
              title: "Payment Successful",
              description: "The invoice has been updated to Paid status.",
            });

            // If we are on public page, we might want to refresh state
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          } else {
            toast({
              variant: "destructive",
              title: "Verification Failed",
              description: "Payment verification failed. Please contact support.",
            });
          }
          setLoading(false);
        },
        prefill: {
          name: invoice.clientName,
          email: invoice.clientEmail,
        },
        theme: {
          color: '#3960AC',
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Payment Error",
        description: error.message || "Could not initialize Razorpay.",
      });
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handlePay}
      disabled={loading || invoice.status === 'paid'}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {showIcon && <CreditCard className="h-4 w-4 mr-2" />}
          Pay Now
        </>
      )}
    </Button>
  );
}