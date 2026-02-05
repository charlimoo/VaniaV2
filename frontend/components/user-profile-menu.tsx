// frontend/components/user-profile-menu.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  LogOut, Wallet, Crown, Zap, Coins, Settings, User, ChevronsUpDown
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { UserData } from "@/lib/types";
import { APP_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button"

interface UserProfileMenuProps {
  user: UserData | null;
  onLogout: () => void;
}

export function UserProfileMenu({ user, onLogout }: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { open } = useSidebar();

  if (!user) return null;

  // --- Wallet Data Logic ---
  const wallet = user.wallet;
  const displayName = user.full_name || user.phone_number;
  
  // Balance calculations
  const balancePaid = parseFloat(wallet?.balance_paid || "0");
  const balancePlan = parseFloat(wallet?.balance_plan || "0");
  const freeUsed = parseFloat(wallet?.daily_free_used || "0");
  const dailyLimit = APP_CONFIG.CREDITS.DEFAULT_DAILY_FREE_AMOUNT;
  
  // Calculate remaining free credits
  const freeRemaining = Math.max(0, dailyLimit - freeUsed);
  
  // Check Plan Status
  const planName = wallet?.active_plan_name;
  const hasPlan = !!planName;

  // Calculate Display Total based on status
  // If Plan: Plan + Paid. If Free: Free only.
  const displayTotal = hasPlan ? (balancePlan + balancePaid) : freeRemaining;

  // Number formatter
  const fmt = (n: number) => n.toLocaleString(APP_CONFIG.ECONOMY.LOCALE, { maximumFractionDigits: 0 });

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        {open ? (
          <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent transition-colors mx-2 mb-2 w-[calc(100%-16px)]">
            <Avatar className="h-8 w-8 rounded-lg border border-border/50 shrink-0">
              <AvatarImage src="" alt={displayName} />
              <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><User className="size-4" /></AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-start text-sm leading-tight">
              <span className="truncate font-semibold">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">{hasPlan ? planName : "نسخه رایگان"}</span>
            </div>
            <ChevronsUpDown className="ms-auto size-4 text-muted-foreground" />
          </SidebarMenuButton>
        ) : (
          <div className="w-full flex justify-center py-2">
            <button className="flex items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors aspect-square size-10">
              <Avatar className="h-8 w-8 rounded-lg border border-border/50 shrink-0">
                <AvatarImage src="" alt={displayName} />
                <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><User className="size-4" /></AvatarFallback>
              </Avatar>
            </button>
          </div>
        )}
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-72 rounded-xl p-0 shadow-lg mr-2 mb-2" side="bottom" align="end" sideOffset={8} {...({ dir: "rtl" } as any)}>
         {/* Header */}
         <div className="flex items-center gap-3 p-4 bg-muted/30">
           <Avatar className="h-10 w-10 border border-background shadow-sm">
             <AvatarFallback><User /></AvatarFallback>
           </Avatar>
           <div className="grid flex-1 gap-0.5">
             <span className="truncate text-sm font-semibold">{displayName}</span>
             <span className="truncate text-xs text-muted-foreground font-mono text-right" dir="ltr">{user.phone_number}</span>
           </div>
           <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild>
             <Link href="/dashboard/settings"><Settings className="size-4" /></Link>
           </Button>
         </div>
         <DropdownMenuSeparator className="m-0" />
         
         {/* Wallet Snapshot */}
         <div className="p-3 space-y-3">
             <div className="relative rounded-lg border border-border/50 bg-card/50 overflow-hidden">
                 <div className="p-3 space-y-2.5">
                     
                     {/* SCENARIO A: HAS PLAN */}
                     {hasPlan ? (
                        <>
                            <div className="flex justify-between items-center text-xs">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <Crown className="size-3.5 text-amber-500" /> 
                                    {planName}
                                </span>
                                <span className="font-medium text-amber-600">{fmt(balancePlan)}</span>
                            </div>
                            
                            {/* Only show paid top-up if > 0 */}
                            {balancePaid > 0 && (
                                <div className="flex justify-between items-center text-xs">
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <Wallet className="size-3.5 text-emerald-500" /> شارژ اضافه
                                    </span>
                                    <span className="font-medium">{fmt(balancePaid)}</span>
                                </div>
                            )}
                        </>
                     ) : (
                        /* SCENARIO B: FREE USER */
                        <div className="flex justify-between items-center text-xs">
                            <span className="flex items-center gap-2 text-muted-foreground">
                                <Zap className="size-3.5 text-blue-500" /> هدیه روزانه
                            </span>
                            <span className="font-medium text-blue-600">{fmt(freeRemaining)}</span>
                        </div>
                     )}

                 </div>
                 <div className="bg-primary/5 px-3 py-2.5 border-t border-border/50 flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary/80">موجودی قابل استفاده</span>
                    <span className="text-sm font-bold text-primary tracking-tight">
                        {fmt(displayTotal)} <span className="text-[10px] font-normal opacity-80">{APP_CONFIG.CREDITS.SYMBOL}</span>
                    </span>
                 </div>
             </div>
         </div>

         <DropdownMenuSeparator className="my-1" />
         
         {/* Footer Actions */}
         <div className="p-1">
             <Link href="/dashboard/billing" passHref>
               <DropdownMenuItem className="cursor-pointer text-xs py-2 px-3 focus:bg-muted/50 rounded-md mb-0.5">
                 <Coins className="ml-2 size-4 text-muted-foreground" /> {APP_CONFIG.TEXT.BILLING_TITLE}
               </DropdownMenuItem>
             </Link>
             <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-destructive text-xs py-2 px-3 focus:bg-destructive/10 focus:text-destructive rounded-md">
               <LogOut className="ml-2 size-4" /> خروج از حساب
             </DropdownMenuItem>
         </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}