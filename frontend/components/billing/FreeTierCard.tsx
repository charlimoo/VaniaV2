import { Button } from "@/components/ui/button";
import { WalletInfo } from "@/lib/types";
import { ShieldAlert, Sparkles, ArrowLeft } from "lucide-react";

interface FreeTierCardProps {
    wallet: WalletInfo | null;
}

export function FreeTierCard({ wallet }: FreeTierCardProps) {
    if (!wallet) return null;
    const totalBalance = parseFloat(wallet.balance_plan) + parseFloat(wallet.balance_paid);

    const scrollToPlans = () => {
        document.getElementById('subscription-plans')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="relative overflow-hidden rounded-3xl border border-dashed border-border bg-card p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
            
            <div className="relative flex items-start gap-5 text-center md:text-right w-full md:w-auto">
                <div className="hidden md:flex p-4 bg-muted/50 rounded-2xl border border-border shrink-0">
                    <ShieldAlert className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-foreground flex items-center gap-2 justify-center md:justify-start">
                        <ShieldAlert className="md:hidden w-6 h-6 text-muted-foreground" />
                        شما اشتراک فعالی ندارید.
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
برای استفاده بیشتر از هوش مصنوعی، برای خود یک اشتراک تهیه کنید.
                    </p>
                </div>
            </div>

            <div className="relative flex flex-col sm:flex-row items-center gap-6 w-full md:w-auto border-t md:border-t-0 md:border-r border-border pt-6 md:pt-0 md:pr-8">
                <div className="text-center min-w-[100px]">
                     <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">اعتبار خریداری شده فعلی</span>
                     <div className="text-4xl font-black text-foreground mt-1">{totalBalance.toLocaleString()}</div>
                </div>
            </div>
        </div>
    );
}