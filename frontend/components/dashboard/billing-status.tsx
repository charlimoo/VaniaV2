"use client"

import { useState } from "react"
import Link from "next/link"
import { 
  Wallet, Zap, ChevronDown, ChevronUp, Loader2, Coins
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useUser } from "@/hooks/use-user"
import { useConfig } from "@/components/providers/config-provider"
import { APP_CONFIG } from "@/lib/config"

export function BillingStatus() {
  const { user, loading } = useUser()
  const { config } = useConfig()
  const [isOpen, setIsOpen] = useState(false)
  
  if (loading || !user) {
    return (
      <Card className="h-full flex items-center justify-center min-h-[180px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    )
  }

  const wallet = user.wallet
  const balancePlan = parseFloat(wallet?.balance_plan || "0")
  const balancePaid = parseFloat(wallet?.balance_paid || "0")
  const totalBalance = balancePlan + balancePaid
  
  // Format with Locale
  const fmt = (n: number) => n.toLocaleString(APP_CONFIG.ECONOMY.LOCALE, { maximumFractionDigits: 0 })

  return (
    <Card className="flex flex-col h-full shadow-sm bg-card border-border" dir="rtl">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <span>وضعیت حساب</span>
          <Coins className="h-4 w-4 opacity-50" />
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-4">
        
        {/* --- BIG TOTAL DISPLAY --- */}
        <div>
          <div className="text-3xl font-bold flex items-baseline gap-1 text-foreground">
            {fmt(totalBalance)}
            <span className="text-sm font-normal text-muted-foreground">
                {config.currency_symbol}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">موجودی فعلی شما</p>
        </div>

        <Separator />

        {/* --- BREAKDOWN --- */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
          
          <div className="flex items-center justify-between">
             <span className="text-xs font-semibold">جزئیات</span>
             <CollapsibleTrigger asChild>
               <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted">
                 {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
               </Button>
             </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="space-y-2 pt-1 text-xs text-muted-foreground">
             <div className="flex justify-between items-center bg-muted/30 p-2 rounded">
                <span className="flex items-center gap-1.5"><Wallet className="w-3 h-3"/> اعتبار دائمی</span>
                <span className="font-mono text-foreground">{fmt(balancePaid)}</span>
             </div>
             <div className="flex justify-between items-center bg-muted/30 p-2 rounded">
                <span className="flex items-center gap-1.5"><Zap className="w-3 h-3"/> اعتبار هدیه/طرح</span>
                <span className="font-mono text-foreground">{fmt(balancePlan)}</span>
             </div>
          </CollapsibleContent>
        </Collapsible>

        {/* --- FOOTER ACTIONS --- */}
        <div className="mt-auto pt-2">
          <Button size="sm" className="w-full gap-2 text-xs h-9 shadow-sm" asChild>
            <Link href="/dashboard/billing">
              <Zap className="h-3 w-3 fill-current" /> افزایش اعتبار
            </Link>
          </Button>
        </div>

      </CardContent>
    </Card>
  )
}