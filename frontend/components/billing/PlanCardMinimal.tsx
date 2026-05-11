"use client";

import { ArrowLeft, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn, formatCurrency } from "@/lib/utils";
import { APP_CONFIG } from "@/lib/config";

interface PlanProps {
  plan: any;
  isActive: boolean;
  isProcessing: boolean;
  onSelect: (plan: any) => void;
}

export function PlanCardMinimal({ plan, isActive, isProcessing, onSelect }: PlanProps) {
  // Parse numeric values safely
  const totalCredits = (parseInt(plan.monthly_credit_allowance) * plan.duration_months).toLocaleString(APP_CONFIG.ECONOMY.LOCALE);

  const priceValue = parseFloat(plan.price);

  return (
    <Card 
      className={cn(
        "flex flex-col justify-between transition-all duration-300 relative overflow-hidden group hover:shadow-lg border-muted",
        isActive 
          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-md" 
          : "bg-card hover:-translate-y-1"
      )}
      dir="rtl"
    >
      {/* Active Indicator Strip */}
      {isActive && (
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-primary animate-in fade-in slide-in-from-top-1" />
      )}

      <CardHeader className="pb-3 pt-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1.5">
            <h3 className="font-bold text-lg leading-tight tracking-tight text-foreground">
              {plan.name}
            </h3>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded w-fit">
              <Badge variant="secondary" className=" font-mono text-xs px-2.5 h-6 bg-background border-border/50 shadow-sm">
                {totalCredits} {APP_CONFIG.CREDITS.SYMBOL}
              </Badge>
              <Zap className="w-3 h-3 text-amber-500" />
              <span>اعتبار قابل استفاده</span>
            </div>
          </div>
          

        </div>
      </CardHeader>

      <CardContent className="py-0 flex-1">
        {/* Price Section */}
        <div className="mb-0">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground tracking-tight">
              {formatCurrency(priceValue).replace(APP_CONFIG.ECONOMY.CURRENCY_SYMBOL, "").trim()}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {APP_CONFIG.ECONOMY.CURRENCY_SYMBOL}
            </span>
          </div>
        </div>


      </CardContent>

      <div className="px-6">
        <Separator className="bg-border/50" />
      </div>

      <CardFooter className="pt-2 pb-0">
        <Button 
          className="w-full h- text-xs font-bold shadow-sm transition-all"
          variant={isActive ? "outline" : "default"}
          disabled={isActive || isProcessing}
          onClick={() => onSelect(plan)}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin ml-2" />
              در حال پردازش...
            </>
          ) : isActive ? (
            <span className="text-muted-foreground">طرح فعلی شما</span>
          ) : (
            <span className="flex items-center gap-2">
              انتخاب و خرید 
              {/* RTL: Arrow should point Left for "Next/Go" */}
              <ArrowLeft className="w-3.5 h-3.5" />
            </span>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
