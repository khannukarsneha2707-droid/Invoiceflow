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

  const handlePayment = async () => {
    try {
      console.log("Starting payment...");

      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: invoice.totalAmount })
      });

      if (!res.ok) {
        console.error("API failed:", res.status);
        alert("Failed to create order");
        return;
      }

      const order = await res.json();
      console.log("ORDER RESPONSE:", order);

      if (!order || !order.id) {
        alert("Invalid order response");
        return;
      }

      if (!(window as any).Razorpay) {
        alert("Razorpay not loaded");
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: "INR",
        order_id: order.id,
        name: "InvoiceFlow",
        description: "Invoice Payment",
        handler: function (response: any) {
          alert("Payment successful");
          window.location.reload();
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("PAYMENT ERROR:", err);
      alert("Payment failed");
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handlePayment}
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