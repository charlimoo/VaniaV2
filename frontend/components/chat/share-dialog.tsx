"use client";

import { useState } from "react";
import { 
  Share2, 
  Copy, 
  Check, 
  Globe, 
  Loader2, 
  ExternalLink,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

interface ShareDialogProps {
  threadId: string;
  trigger?: React.ReactNode;
}

export function ShareDialog({ threadId, trigger }: ShareDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // [FIX] Removed client-side "local-" check. 
  // The backend will validate if the session exists.

  const handleCreateLink = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/agent/share/${threadId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error("گفتگو یافت نشد. لطفاً ابتدا پیامی ارسال کنید.");
        throw new Error("خطا در ایجاد لینک اشتراک.");
      }

      const data = await res.json();
      const fullUrl = `${window.location.origin}${data.url}`;
      setShareUrl(fullUrl);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "مشکلی پیش آمده است.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("لینک در حافظه کپی شد");
    setTimeout(() => setCopied(false), 2000);
  };

  const resetState = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setError(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={resetState}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Share2 className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md font-sans" dir="rtl">
        <DialogHeader className="text-right space-y-3">
          <div className="mx-auto bg-blue-50 dark:bg-blue-900/20 w-12 h-12 rounded-full flex items-center justify-center mb-2">
            <Globe className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <DialogTitle className="text-center text-xl">اشتراک‌گذاری گفتگو</DialogTitle>
          <DialogDescription className="text-center">
            یک لینک عمومی برای این گفتگو ایجاد کنید. هر کسی با داشتن این لینک می‌تواند تاریخچه پیام‌ها را مشاهده کند.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {error && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!shareUrl ? (
            <div className="flex flex-col items-center justify-center py-4">
              <Button 
                onClick={handleCreateLink} 
                disabled={loading} 
                className="w-full sm:w-auto min-w-[200px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" /> در حال ساخت لینک...
                  </>
                ) : (
                  "ایجاد لینک عمومی"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="grid gap-2">
                <Label htmlFor="link" className="text-xs text-muted-foreground">لینک اختصاصی شما</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="link" 
                    value={shareUrl} 
                    readOnly 
                    className="text-left font-mono text-xs h-10 bg-muted/50"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button 
                    size="icon" 
                    variant="outline" 
                    onClick={copyToClipboard}
                    className="shrink-0 h-10 w-10"
                    title="کپی لینک"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1 text-xs" asChild>
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    باز کردن لینک
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}