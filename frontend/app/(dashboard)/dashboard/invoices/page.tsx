"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Loader2, Receipt, Calendar, CheckCircle2, Clock, 
  XCircle, ArrowUpRight, AlertCircle, Hash 
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";

interface InvoiceSummary {
  id: string;
  status: string;
  total_amount: string;
  created_at: string;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const headers = getAuthHeaders();
      try {
        const res = await fetch(`${API_BASE_URL}/api/billing/history/?type=invoice`, { headers });
        if (!res.ok) throw new Error("Failed to fetch invoices");
        const data = await res.json();
        setInvoices(data.results || []);
      } catch (e) {
        console.error(e);
        setError("عدم دریافت لیست سفارشات.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PAID': return { label: 'پرداخت شده', icon: CheckCircle2, style: "bg-emerald-500/10 text-emerald-300 border-emerald-600/30" };
      case 'PENDING': return { label: 'در انتظار پرداخت', icon: Clock, style: "bg-amber-500/10 text-amber-600 border-amber-200" };
      case 'CANCELLED': return { label: 'لغو شده', icon: XCircle, style: "bg-destructive/10 text-destructive border-destructive/20" };
      case 'WAITING': return { label: 'در انتظار تایید', icon: Clock, style: "bg-blue-500/10 text-blue-300 border-blue-600/30" };
      default: return { label: status, icon: Receipt, style: "bg-muted text-muted-foreground" };
    }
  };

  return (
    <div className="flex flex-col w-full space-y-8 pb-10 max-w-6xl mx-auto pt-6" dir="rtl">
      
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">سفارشات</h1>
        <p className="text-muted-foreground">تاریخچه خریدها و فاکتورهای صادر شده.</p>
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertTitle>خطا</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

      <Card className="shadow-sm border-border">
        <CardContent className="p-0">
            {loading ? (
                <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2 opacity-60">
                    <Receipt className="h-10 w-10" />
                    <span>هیچ فاکتوری یافت نشد.</span>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-right w-[100px]">شماره</TableHead>
                            <TableHead className="text-right">تاریخ</TableHead>
                            <TableHead className="text-center">وضعیت</TableHead>
                            <TableHead className="text-left">مبلغ</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map((inv) => {
                            const config = getStatusConfig(inv.status);
                            const Icon = config.icon;
                            return (
                                <TableRow 
                                    key={inv.id} 
                                    className="cursor-pointer group" 
                                    onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                                >
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <Hash className="h-3 w-3 opacity-50" />
                                            {inv.id.slice(0, 8)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm">
                                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                            {new Date(inv.created_at).toLocaleDateString('fa-IR')}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={cn("gap-1 font-normal", config.style)}>
                                            <Icon className="h-3 w-3" /> {config.label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-left font-bold font-mono">
                                        {formatCurrency(inv.total_amount)}
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
    </div>
  );
}