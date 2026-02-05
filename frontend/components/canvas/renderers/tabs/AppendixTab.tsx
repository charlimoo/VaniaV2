// frontend/components/canvas/renderers/tabs/AppendixTab.tsx
"use client";

import { ThoughtAppendix, ResourceType } from "@/lib/types/vania";
import { BookOpen, Film, Feather, Quote, Plus, Library } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// --- Props Interface ---
interface Props {
  library: ThoughtAppendix;
  patientId: number;
  onEdit: (delta: any) => void;
}

// --- Configuration for mapping resource types to UI elements ---
const CONFIG: Record<ResourceType, { icon: any, label: string, color: string }> = {
  "BOOK": { icon: BookOpen, label: "کتاب", color: "text-blue-600 bg-blue-100 border-blue-200" },
  "MOVIE": { icon: Film, label: "فیلم", color: "text-red-600 bg-red-100 border-red-200" },
  "POEM": { icon: Feather, label: "شعر", color: "text-purple-600 bg-purple-100 border-purple-200" }
};

/**
 * Renders the Thought Appendix tab, displaying prescribed books, films, and poems.
 */
export function AppendixTab({ library, patientId, onEdit }: Props) {
  
  const resources = library?.resources || [];

  // --- Render States ---

  // 1. Empty State: When no resources have been prescribed yet.
  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5 animate-in fade-in">
        <Library className="w-12 h-12 mb-4 opacity-20" />
        <h3 className="text-sm font-semibold">پیوست اندیشه خالی است</h3>
        <p className="text-xs opacity-70 mt-2 max-w-xs text-center">
          در پایان جلسات، از دستیار بخواهید منابع فرهنگی مرتبط با موضوع را برای مراجع پیشنهاد و ثبت کند.
        </p>
        <Button variant="ghost" className="mt-4 text-xs h-8 gap-2">
            <Plus className="w-3 h-3" />
            افزودن دستی
        </Button>
      </div>
    );
  }

  // 2. Main Content: List of prescribed resources.
  return (
    <div className="space-y-4 pb-10 animate-in fade-in slide-in-from-right-2 duration-300">
      {resources.map((res) => {
        const conf = CONFIG[res.type] || CONFIG["BOOK"];
        const Icon = conf.icon;
        
        return (
          <Card key={res.id} className="overflow-hidden border shadow-sm bg-card hover:shadow-lg transition-all group">
            <div className={`absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-primary/40 to-transparent ${conf.color}`} />
            
            <CardContent className="p-5">
              
              {/* Header: Title, Creator, and Type */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${conf.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground leading-tight">{res.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{res.creator}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] font-normal ${conf.color}`}>
                  {conf.label}
                </Badge>
              </div>

              {/* Excerpt/Quote */}
              {res.content_excerpt && (
                <div className="relative pl-4 pr-3 py-3 my-3 bg-muted/40 rounded-lg border-r-2 border-primary/20 text-xs italic text-foreground/80 font-serif leading-loose">
                  <Quote className="w-4 h-4 absolute -top-1.5 -right-1.5 text-primary/20 fill-current" />
                  {res.content_excerpt}
                </div>
              )}

              {/* Therapeutic Reason */}
              <div className="mt-3 text-[11px] bg-primary/5 p-2.5 rounded-lg border border-primary/10">
                <strong className="text-primary block mb-1">نسخه درمانی (چرا این اثر؟)</strong>
                <p className="leading-relaxed opacity-90">{res.reason_for_prescription}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}