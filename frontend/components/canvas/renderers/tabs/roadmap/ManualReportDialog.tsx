// frontend/components/canvas/renderers/tabs/roadmap/ManualReportDialog.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Edit2, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

interface Flashcard {
  title: string;
  content: string;
}

type SwotState = {
  Strengths: string[];
  Weaknesses: string[];
  Opportunities: string[];
  Threats: string[];
};

const EMPTY_SWOT: SwotState = {
  Strengths: [],
  Weaknesses: [],
  Opportunities: [],
  Threats: [],
};

const swotToText = (items: string[] = []) => items.join("\n");
const textToSwot = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

interface Props {
  patientId: number;
  caseId?: string;
  sessionNumber: number;
  sessionTitle: string;
  initialData?: {
    summary: string;
    private_notes: string;
    flashcards: any[];
    swot_analysis?: Partial<SwotState>;
    smart_goals?: string[];
  };
  trigger?: React.ReactNode;
  onSuccess: (data: any) => void;
}

export function ManualReportDialog({ patientId, caseId, sessionNumber, sessionTitle, initialData, trigger, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [summary, setSummary] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [swot, setSwot] = useState<SwotState>(EMPTY_SWOT);
  const [smartGoalsText, setSmartGoalsText] = useState("");

  useEffect(() => {
    if (open) {
      setSummary(initialData?.summary || "");
      setPrivateNotes(initialData?.private_notes || "");
      
      const rawCards = initialData?.flashcards || [];
      const normalizedCards = rawCards.map(c => ({
        title: c.title || c.front || "",
        content: c.content || c.back || ""
      }));
      setFlashcards(normalizedCards);
      setSwot({
        Strengths: initialData?.swot_analysis?.Strengths || [],
        Weaknesses: initialData?.swot_analysis?.Weaknesses || [],
        Opportunities: initialData?.swot_analysis?.Opportunities || [],
        Threats: initialData?.swot_analysis?.Threats || [],
      });
      setSmartGoalsText((initialData?.smart_goals || []).join("\n"));
    }
  }, [open, initialData]);

  const addFlashcard = () => {
    setFlashcards([...flashcards, { title: "", content: "" }]);
  };

  const updateFlashcard = (index: number, field: keyof Flashcard, value: string) => {
    const newCards = [...flashcards];
    newCards[index][field] = value;
    setFlashcards(newCards);
  };

  const removeFlashcard = (index: number) => {
    setFlashcards(flashcards.filter((_, i) => i !== index));
  };

  const updateSwot = (key: keyof SwotState, value: string) => {
    setSwot((prev) => ({ ...prev, [key]: textToSwot(value) }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/roadmap/report/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          patient_id: patientId,
          case_id: caseId,
          session_number: sessionNumber,
          summary: summary,
          private_notes: privateNotes,
          flashcards: flashcards.filter(f => f.title.trim() !== ""),
          swot_analysis: swot,
          smart_goals: textToSwot(smartGoalsText),
        })
      });

      if (!res.ok) throw new Error("خطا در ذخیره گزارش");
      
      const data = await res.json();
      toast.success("گزارش جلسه ثبت شد.");
      setOpen(false);
      onSuccess(data);

    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Edit2 className="w-3.5 h-3.5" /> ویرایش / تکمیل
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto font-sans" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2 text-foreground">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            گزارش جلسه {sessionNumber}: {sessionTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground/80">خلاصه جلسه و تحلیل بالینی (عمومی)</Label>
            <Textarea 
              value={summary} 
              onChange={(e) => setSummary(e.target.value)} 
              placeholder="آنچه در جلسه گذشت و تحلیل شما (قابل مشاهده برای مراجعه کننده)"
              className="min-h-[120px] bg-muted/20 border-border/50 focus:bg-background transition-colors text-sm leading-relaxed"
            />
          </div>

          <div className="space-y-3 bg-muted/10 p-4 rounded-xl border border-border/40">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-semibold text-foreground/80">تکنیک‌ها و نکات کلیدی (فلش‌کارت)</Label>
              <Button size="sm" variant="ghost" onClick={addFlashcard} className="h-7 text-xs text-primary hover:bg-primary/10">
                <Plus className="w-3 h-3 mr-1" /> افزودن کارت
              </Button>
            </div>
            
            {flashcards.length === 0 && (
              <div className="text-xs text-muted-foreground/50 text-center py-4 border border-dashed border-border/30 rounded-lg">
                هنوز کارتی اضافه نشده است.
              </div>
            )}

            <div className="space-y-2">
              {flashcards.map((card, idx) => (
                <div key={idx} className="flex gap-2 items-start animate-in fade-in slide-in-from-top-1">
                  <div className="grid gap-2 flex-1">
                    <Input 
                      placeholder="عنوان (مثال: تکنیک توقف فکر)" 
                      value={card.title}
                      onChange={(e) => updateFlashcard(idx, 'title', e.target.value)}
                      className="h-9 text-xs font-bold bg-background border-border/50"
                    />
                    <Textarea 
                      placeholder="توضیح مختصر..." 
                      value={card.content}
                      onChange={(e) => updateFlashcard(idx, 'content', e.target.value)}
                      className="min-h-[60px] text-xs bg-background border-border/50"
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFlashcard(idx)} className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 h-8 w-8 mt-1">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 bg-muted/10 p-4 rounded-xl border border-border/40">
            <Label className="text-xs font-semibold text-foreground/80">تحلیل SWOT</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">نقاط قوت</Label>
                <Textarea
                  value={swotToText(swot.Strengths)}
                  onChange={(e) => updateSwot("Strengths", e.target.value)}
                  placeholder="هر مورد در یک خط"
                  className="min-h-[96px] text-sm text-right"
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">نقاط ضعف</Label>
                <Textarea
                  value={swotToText(swot.Weaknesses)}
                  onChange={(e) => updateSwot("Weaknesses", e.target.value)}
                  placeholder="هر مورد در یک خط"
                  className="min-h-[96px] text-sm text-right"
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">فرصت‌ها</Label>
                <Textarea
                  value={swotToText(swot.Opportunities)}
                  onChange={(e) => updateSwot("Opportunities", e.target.value)}
                  placeholder="هر مورد در یک خط"
                  className="min-h-[96px] text-sm text-right"
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">تهدیدها</Label>
                <Textarea
                  value={swotToText(swot.Threats)}
                  onChange={(e) => updateSwot("Threats", e.target.value)}
                  placeholder="هر مورد در یک خط"
                  className="min-h-[96px] text-sm text-right"
                  dir="rtl"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground/80">اهداف جلسه</Label>
            <Textarea
              value={smartGoalsText}
              onChange={(e) => setSmartGoalsText(e.target.value)}
              placeholder="هر هدف را در یک خط بنویسید"
              className="min-h-[110px] text-sm text-right"
              dir="rtl"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-semibold text-foreground/80">
                <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                یادداشت‌های محرمانه 
                <span className="text-[9px] bg-red-950/20 text-red-400 border border-red-900/30 px-2 py-0.5 rounded-full">فقط متخصص</span>
            </Label>
            <Textarea 
              value={privateNotes} 
              onChange={(e) => setPrivateNotes(e.target.value)} 
              placeholder="یادداشت‌های شخصی متخصص..."
              className="bg-red-950/10 border-red-900/30 focus:border-red-900/60 min-h-[80px] text-sm text-red-200/90 placeholder:text-red-200/30"
            />
          </div>

        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto min-w-[140px]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "ذخیره و نهایی‌سازی"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
