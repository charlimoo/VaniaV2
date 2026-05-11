"use client";

import { Loader2, Zap, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillingProduct } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { useConfig } from "@/components/providers/config-provider";

interface QuickChargeCardProps {
    topUps: BillingProduct[];
    onTopUp: (product: BillingProduct) => void;
    processingId: number | null;
}

export function QuickChargeCard({ topUps, onTopUp, processingId }: QuickChargeCardProps) {
  const { config } = useConfig();

  return (
    <>
        {topUps.map((pack) => (
            <Card 
                key={pack.id} 
                className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 border-transparent hover:border-primary/10"
            >
                {/* Subtle Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-card via-card to-muted/20 pointer-events-none transition-opacity group-hover:opacity-100 opacity-50" />
                
                <div className="p-6 relative z-10 flex flex-col h-full justify-between gap-6">
                    <div>
                        <div className="flex justify-between items-start">
                            <h3 className="text-xl font-black text-foreground tracking-tight">
                                {pack.name}
                            </h3>
                            <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg">
                                <Zap className="w-4 h-4 fill-current" />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mt-3 text-muted-foreground">
                            <Badge variant="secondary" className="font-mono bg-background shadow-sm border px-2 py-1 text-sm">
                                {parseInt(pack.credit_amount).toLocaleString()} {config.currency_symbol}
                            </Badge>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-3 line-clamp-2 leading-relaxed opacity-80">
                            {pack.description || "اعتبار دائمی، قابل استفاده برای تمامی سرویس‌ها."}
                        </p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-dashed border-border/50">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground">قیمت بسته</span>
                            <span className="text-lg font-bold text-primary">
                                {formatCurrency(pack.price)}
                            </span>
                        </div>
                        <Button 
                            size="sm" 
                            onClick={() => onTopUp(pack)}
                            disabled={processingId === pack.id}
                            className="gap-2 shadow-md px-4"
                        >
                            {processingId === pack.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <ShoppingCart className="w-4 h-4" />
                            )}
                            خرید آنی
                        </Button>
                    </div>
                </div>
            </Card>
        ))}
    </>
  );
}
