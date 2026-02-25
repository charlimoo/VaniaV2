"use client";

import { useState } from "react";
import { LifeBuoy, Check, Loader2, Circle, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

// --- Types ---
interface Task {
  id: string;
  text: string;
  dimension: string;
  status: "PENDING" | "DONE";
  due_date?: string;
  doctor_id?: number;
}

interface Props {
  tasks: Task[];
  selectedDoctorId?: number | null;
  onEdit: (delta: any) => void;
}

// --- Dimensions Config (Vania Core) ---
const DIMENSIONS: Record<string, { label: string; color: string }> = {
  "PERSONAL": { label: "رشد شخصی", color: "text-red-400 bg-muted-50 border-muted-100" },
  "EMOTIONAL": { label: "رشد عاطفی", color: "text-pink-400 bg-muted-50 border-muted-100" },
  "RELATIONSHIP": { label: "ارتباط سودمند", color: "text-purple-400 bg-muted-50 border-muted-100" },
  "FRIENDSHIP": { label: "ارتباط با دوستان", color: "text-indigo-400 bg-muted-50 border-muted-100" },
  "CAREER": { label: "شغلی-تحصیلی", color: "text-blue-400 bg-muted-50 border-muted-100" },
  "INTELLECTUAL": { label: "رشد فکری", color: "text-cyan-400 bg-muted-50 border-muted-100" },
  "ENVIRONMENT": { label: "رشد محیطی", color: "text-teal-400 bg-muted-50 border-muted-100" },
  "RECREATION": { label: "تفریحی-ورزشی", color: "text-green-400 bg-muted-50 border-muted-100" },
  "SOLITUDE": { label: "مدیریت تنهایی", color: "text-orange-400 bg-muted-50 border-muted-100" },
};

export function PatientRescueNetTab({ tasks, selectedDoctorId, onEdit }: Props) {
  // Track loading state for individual task IDs to prevent double-clicks
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const handleComplete = async (task: Task) => {
    if (task.status === "DONE" || loadingIds.has(task.id)) return;
    
    // Add ID to loading set
    setLoadingIds(prev => new Set(prev).add(task.id));
    
    try {
      // 1. Optimistic Update (Immediate Feedback)
      const newTasks = tasks.map(t => 
        t.id === task.id ? { ...t, status: "DONE" as const } : t
      );
      onEdit({ tasks: newTasks });

      // 2. Server API Call
      const res = await fetch(`${API_BASE_URL}/api/vania/my-tasks/${task.id}/complete/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          doctor_id: selectedDoctorId || task.doctor_id || null
        })
      });

      if (!res.ok) throw new Error("Failed to update task");
      
      toast.success("عالی بود! خسته نباشید.", { icon: "🎉" });

    } catch (e) {
      console.error(e);
      toast.error("خطا در ثبت وضعیت. لطفاً مجدد تلاش کنید.");
      // Revert Optimistic Update on Failure
      onEdit({ tasks }); 
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  // Group tasks by dimension for the UI
  const groupedTasks = Object.keys(DIMENSIONS).map(key => ({
    key,
    ...DIMENSIONS[key],
    items: tasks.filter(t => t.dimension === key)
  })).filter(g => g.items.length > 0);

  const pendingCount = tasks.filter(t => t.status === "PENDING").length;

  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-right-2 duration-300 font-sans">
      
      {/* --- Header --- */}
      <div className="flex items-center justify-between px-1">
        <div className="space-y-1">
          <h3 className="font-bold flex items-center gap-2 text-foreground">
            <LifeBuoy className="w-5 h-5 text-primary" />
            تور نجات من
          </h3>
          <p className="text-xs text-muted-foreground">برنامه جامع توسعه فردی</p>
        </div>
        <Badge variant="secondary" className="px-3 py-1 bg-background border shadow-sm">
          {pendingCount} وظیفه باقی‌مانده
        </Badge>
      </div>

      {/* --- Empty State --- */}
      {groupedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
          <Check className="w-10 h-10 mb-2 opacity-20" />
          <p className="text-sm font-medium">تبریک! همه کارها انجام شده است.</p>
          <p className="text-xs mt-1">یا هنوز وظیفه‌ای ثبت نشده است.</p>
        </div>
      ) : (
        /* --- Grid Layout --- */
        <div className="grid gap-4">
          {groupedTasks.map(group => (
            <div key={group.key} className="border border-border/60 rounded-xl overflow-hidden bg-card shadow-sm transition-all hover:shadow-md">
              
              {/* Group Header */}
              <div className={cn("px-4 py-2.5 border-b text-xs font-bold flex justify-between items-center", group.color)}>
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                  {group.label}
                </span>
                <span className="opacity-80 font-mono text-[10px]">
                  {group.items.filter(i => i.status === "DONE").length} / {group.items.length}
                </span>
              </div>

              {/* Task List */}
              <div className="p-2 space-y-1">
                {group.items.map(task => {
                  const isDone = task.status === "DONE";
                  const isLoading = loadingIds.has(task.id);

                  return (
                    <div 
                      key={task.id} 
                      onClick={() => handleComplete(task)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer group hover:bg-muted/50 border border-transparent",
                        isDone && "opacity-60 bg-muted/20"
                      )}
                    >
                      {/* Checkbox Circle */}
                      <div className={cn(
                        "mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                        isDone 
                          ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" 
                          : "border-muted-foreground/30 bg-background group-hover:border-primary"
                      )}>
                        {isLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isDone ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Circle className="w-0 h-0 group-hover:w-2 group-hover:h-2 fill-primary text-primary transition-all duration-300" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm leading-snug", isDone && "line-through text-muted-foreground")}>
                          {task.text}
                        </p>
                        
                        {task.due_date && !isDone && (
                          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-amber-600/80 font-medium">
                            <CalendarClock className="w-3 h-3" />
                            {new Date(task.due_date).toLocaleDateString('fa-IR')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
