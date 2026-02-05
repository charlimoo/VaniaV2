"use client";

import { useState } from "react";
import { Copy, Check, CreditCard, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useConfig } from "@/components/providers/config-provider";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

interface ManualPaymentFormProps {
  invoiceId: string;
  onSuccess: () => void;
}

export function ManualPaymentForm({ invoiceId, onSuccess }: ManualPaymentFormProps) {
  const { config } = useConfig();
  const [copied, setCopied] = useState(false);
  const [refId, setRefId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const copyCard = () => {
    if (config.bank_card_number) {
      navigator.clipboard.writeText(config.bank_card_number);
      setCopied(true);
      toast.success("شماره کارت کپی شد");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async () => {
    if (!refId || refId.length < 4) {
      toast.error("لطفا کد پیگیری معتبر وارد کنید");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/pay/manual/${invoiceId}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ reference_id: refId }),
      });

      if (!res.ok) throw new Error("خطا در ثبت پرداخت");
      
      toast.success("اطلاعات پرداخت ثبت شد. منتظر تایید باشید.");
      onSuccess();
    } catch (e) {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setSubmitting(false);
    }
  };

  // Safe split for card number grouping
  const formattedCard = config.bank_card_number?.match(/.{1,4}/g)?.join("  ") || "----  ----  ----  ----";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      
      {/* --- Credit Card Visual --- */}
      <div 
        onClick={copyCard}
        className="group relative overflow-hidden bg-[#1e1e1e] text-white p-6 rounded-2xl shadow-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] select-none"
      >
        {/* Abstract Background Elements */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        
        {/* Top Row */}
        <div className="relative z-10 flex justify-between items-start mb-8">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
            >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </Button>
            <CreditCard className="w-8 h-8 text-white/80" />
        </div>
        
        {/* Card Number */}
        <div className="relative z-10 mb-6" dir="ltr">
            <p className="font-mono text-2xl font-medium tracking-wider text-center drop-shadow-md text-white">
                {formattedCard}
            </p>
        </div>

        {/* Bottom Details */}
        <div className="relative z-10 flex justify-between items-end">
            <div className="flex flex-col items-start space-y-0.5">
                <span className="text-[9px] text-white/50 uppercase tracking-wider">به نام</span>
                <span className="text-sm font-medium">{config.bank_holder_name || "---"}</span>
            </div>
        </div>
      </div>

      {/* --- Input Section --- */}
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed text px-1 text-right ">
          {config.manual_payment_tips || "لطفا مبلغ دقیق فاکتور را به کارت بالا واریز کرده و شناسه پرداخت یا کد پیگیری را در کادر زیر وارد کنید."}
        </p>

        <div className="relative">
            <div className="absolute top-0 bottom-0 right-0 pr-3 flex items-center pointer-events-none">
                <Wallet className="w-4 h-4 text-muted-foreground/50" />
            </div>
            <Input 
                placeholder="شماره پیگیری / ارجاع"
                className="pr-9 text-center font-mono tracking-widest"
                value={refId}
                onChange={(e) => setRefId(e.target.value)}
                dir="ltr"
            />
        </div>

        <Button 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" 
            onClick={handleSubmit}
            disabled={submitting}
        >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Check className="w-4 h-4 ml-2" />}
            ثبت پرداخت
        </Button>
      </div>
    </div>
  );
}