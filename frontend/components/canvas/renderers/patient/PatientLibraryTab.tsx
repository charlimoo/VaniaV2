"use client";

import { useAssistantRuntime } from "@assistant-ui/react";
import { BookOpen, Film, Feather, Check, Quote, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Types ---
interface Resource {
  id: string;
  type: "BOOK" | "MOVIE" | "POEM";
  title: string;
  creator: string;
  reason_for_prescription: string;
  content_excerpt?: string;
  status: "SUGGESTED" | "CONSUMED";
}

interface Props {
  library: Resource[];
  onEdit: (delta: any) => void;
}

// --- Icons Config ---
const ICONS = {
  BOOK: BookOpen,
  MOVIE: Film,
  POEM: Feather
};

const TYPE_LABELS = {
  BOOK: "کتاب",
  MOVIE: "فیلم",
  POEM: "شعر"
};

export function PatientLibraryTab({ library, onEdit }: Props) {
  const runtime = useAssistantRuntime();

  const handleMarkConsumed = (resource: Resource) => {
    if (resource.status === "CONSUMED") return;

    // 1. Optimistic Update (Visual feedback immediately)
    const newLib = library.map(r => 
      r.id === resource.id ? { ...r, status: "CONSUMED" as const } : r
    );
    onEdit({ library: newLib });
    
    toast.success("تبریک! اثر در آرشیو ثبت شد.", {
      description: "بیایید درباره آن گفتگو کنیم."
    });

    // 2. Trigger Agent Logic ("Therapeutic Companion")
    // This sends a message as the user, prompting the Agent to use the 'mark_resource_consumed' tool
    // and start a reflective conversation per the 6-Phase Protocol.
    runtime.thread.append({
      role: "user",
      content: [{ 
        type: "text", 
        text: `من "${resource.title}" (${TYPE_LABELS[resource.type]}) را تمام کردم. مایلم درباره‌اش صحبت کنم.` 
      }]
    });
  };

  const activeResources = library.filter(r => r.status === "SUGGESTED");
  const consumedResources = library.filter(r => r.status === "CONSUMED");

  return (
    <div className="space-y-8 pb-10 animate-in fade-in slide-in-from-right-2 duration-300 font-sans">
      
      {/* --- Active Suggestions Section --- */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            پیشنهادات جدید
          </h3>
          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
            {activeResources.length} مورد
          </Badge>
        </div>
        
        {activeResources.length === 0 ? (
          <div className="text-center py-12 bg-muted/10 rounded-2xl border border-dashed border-muted-foreground/20 text-xs text-muted-foreground flex flex-col items-center gap-2">
            <BookOpen className="w-8 h-8 opacity-20" />
            <p>در حال حاضر پیشنهاد جدیدی ندارید.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {activeResources.map(res => (
              <ResourceCard 
                key={res.id} 
                resource={res} 
                onAction={() => handleMarkConsumed(res)} 
              />
            ))}
          </div>
        )}
      </section>

      {/* --- Consumed Archive Section --- */}
      {consumedResources.length > 0 && (
        <section className="pt-4 border-t border-border/40">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-muted-foreground">
            <Check className="w-4 h-4" />
            آرشیو مطالعه شده‌ها
          </h3>
          <div className="grid gap-4 opacity-80 hover:opacity-100 transition-opacity">
            {consumedResources.map(res => (
              <ResourceCard 
                key={res.id} 
                resource={res} 
                isDone 
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// --- Sub-Component: Resource Card ---
function ResourceCard({ resource, onAction, isDone }: { resource: Resource, onAction?: () => void, isDone?: boolean }) {
  const Icon = ICONS[resource.type] || BookOpen;
  
  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300",
      isDone ? "bg-muted/10 border-border/50" : "bg-card hover:shadow-md border-l-4 border-l-primary/60"
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex gap-3 overflow-hidden">
            <div className={cn(
              "p-2.5 rounded-xl h-fit shrink-0",
              isDone ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className={cn("font-bold text-sm truncate", isDone && "text-muted-foreground")}>
                {resource.title}
              </h4>
              <p className="text-xs text-muted-foreground truncate">{resource.creator}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0 font-normal">
            {TYPE_LABELS[resource.type]}
          </Badge>
        </div>

        {/* Content Excerpt (Poem/Quote) */}
        {resource.content_excerpt && (
          <div className="mt-3 text-xs italic text-muted-foreground bg-muted/30 border-r-2 border-primary/20 pr-3 pl-2 py-2 rounded-r-sm leading-relaxed relative">
            <Quote className="w-3 h-3 absolute -top-1.5 -right-1.5 text-primary/20 fill-current" />
            {resource.content_excerpt}
          </div>
        )}

        {/* Footer: Reason & Action */}
        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="flex-1 bg-muted/40 p-2 rounded-lg">
            <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
              <span className="font-semibold text-primary/80 ml-1">دلیل پیشنهاد:</span>
              {resource.reason_for_prescription}
            </p>
          </div>
          
          {!isDone && onAction && (
            <Button size="sm" className="h-8 text-xs px-4 shadow-sm font-bold shrink-0" onClick={onAction}>
              انجام شد
            </Button>
          )}
          
          {isDone && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
              <Check className="w-3 h-3" /> تکمیل
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}