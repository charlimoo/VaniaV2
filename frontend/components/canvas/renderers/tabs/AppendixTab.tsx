"use client";

import { ThoughtAppendix, ResourceType } from "@/lib/types/vania";
import { BookOpen, Film, Feather, Quote, Library, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddResourceDialog } from "./appendix/AddResourceDialog";
import { AppendixDownloadButton } from "./appendix/AppendixDownloadButton";

interface Props {
  library: ThoughtAppendix;
  patientId: number;
  onEdit: (delta: any) => void;
}

const CONFIG: Record<ResourceType, { icon: any, label: string, color: string }> = {
  "BOOK": { icon: BookOpen, label: "کتاب", color: "text-blue-600 bg-blue-100 border-blue-200" },
  "MOVIE": { icon: Film, label: "فیلم", color: "text-red-600 bg-red-100 border-red-200" },
  "POEM": { icon: Feather, label: "شعر", color: "text-purple-600 bg-purple-100 border-purple-200" }
};

export function AppendixTab({ library, patientId, onEdit }: Props) {
  
  const resources = library?.resources || [];

  const handleResourceAdded = (newRes: any) => {
    onEdit({ 
        appendix_data: { 
            ...library,
            resources: [newRes, ...(resources || [])] 
        } 
    });
  };

  // --- Render States ---

  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5 animate-in fade-in p-6 gap-4">
        <Library className="w-12 h-12 opacity-20" />
        <div className="text-center">
            <h3 className="text-sm font-semibold">پیوست اندیشه خالی است</h3>
            <p className="text-xs opacity-70 mt-2 max-w-xs mx-auto">
            در پایان جلسات، منابع فرهنگی مرتبط با موضوع را برای مراجع تجویز کنید.
            </p>
        </div>
        
        <AddResourceDialog 
            patientId={patientId}
            onSuccess={handleResourceAdded}
            trigger={
                <Button variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" /> افزودن اولین منبع
                </Button>
            }
        />
        <AppendixDownloadButton library={library} patientId={patientId} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10 animate-in fade-in slide-in-from-right-2 duration-300">
      
      {/* Header Action */}
      <div className="mb-2 flex flex-wrap justify-end gap-2">
         <AppendixDownloadButton library={library} patientId={patientId} />
         <AddResourceDialog 
            patientId={patientId}
            onSuccess={handleResourceAdded}
         />
      </div>

      {resources.map((res) => {
        const conf = CONFIG[res.type] || CONFIG["BOOK"];
        const Icon = conf.icon;
        
        return (
          <Card key={res.id} className="overflow-hidden border shadow-sm bg-card hover:shadow-lg transition-all group">
            <div className={`absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-primary/40 to-transparent ${conf.color}`} />
            
            <CardContent className="p-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`p-2 rounded-xl ${conf.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="truncate font-bold text-sm text-foreground leading-tight">{res.title}</h4>
                    <p className="truncate text-xs text-muted-foreground mt-0.5">{res.creator}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`shrink-0 text-[10px] font-normal ${conf.color}`}>
                  {conf.label}
                </Badge>
              </div>

              {res.content_excerpt && (
                <div className="relative pl-4 pr-3 py-3 my-3 bg-muted/40 rounded-lg border-r-2 border-primary/20 text-xs italic text-foreground/80 font-serif leading-loose">
                  <Quote className="w-4 h-4 absolute -top-1.5 -right-1.5 text-primary/20 fill-current" />
                  {res.content_excerpt}
                </div>
              )}

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
