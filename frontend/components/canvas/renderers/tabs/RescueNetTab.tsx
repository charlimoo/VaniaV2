// frontend/components/canvas/renderers/tabs/RescueNetTab.tsx
"use client";

import { RescueTask, RescueDimension } from "@/lib/types/vania";
import { 
  Check, 
  Circle, 
  LifeBuoy,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddTaskDialog } from "./rescuenet/AddTaskDialog";
// --- Props Interface ---
interface Props {
  tasks: RescueTask[];
  patientId: number;
  onEdit: (delta: any) => void;
}

// --- Configuration for the 9 Dimensions ---
const DIMENSIONS: { key: RescueDimension; label: string; colorClass: string }[] = [
  { key: "PERSONAL", label: "رشد شخصی", colorClass: "bg-red-50 text-red-700 border-red-200" },
  { key: "EMOTIONAL", label: "رشد عاطفی", colorClass: "bg-pink-50 text-pink-700 border-pink-200" },
  { key: "RELATIONSHIP", label: "ارتباط سودمند", colorClass: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "FRIENDSHIP", label: "ارتباط با دوستان", colorClass: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { key: "CAREER", label: "شغلی-تحصیلی", colorClass: "bg-blue-50 text-blue-700 border-blue-100" },
  { key: "INTELLECTUAL", label: "رشد فکری", colorClass: "bg-cyan-50 text-cyan-700 border-cyan-100" },
  { key: "ENVIRONMENT", label: "رشد محیطی", colorClass: "bg-teal-50 text-teal-700 border-teal-100" },
  { key: "RECREATION", label: "تفریحی-ورزشی", colorClass: "bg-green-50 text-green-700 border-green-100" },
  { key: "SOLITUDE", label: "مدیریت تنهایی", colorClass: "bg-orange-50 text-orange-700 border-orange-100" },
];

/**
 * Renders the "Rescue Net" (تور نجات) tab.
 * This component visualizes patient tasks, categorized into the 9 core life dimensions,
 * providing a holistic view of their therapeutic progress and homework.
 */
export function RescueNetTab({ tasks, patientId, onEdit }: Props) {
  
  // Group tasks by their dimension for rendering.
  const groupedTasks = DIMENSIONS.map(dim => ({
    ...dim,
    items: tasks?.filter(t => t.dimension === dim.key) || []
  }));

  // --- Calculations for the overview banner ---
  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter(t => t.status === 'DONE').length || 0;
  const activeDimensions = groupedTasks.filter(g => g.items.length > 0).length;
  const coveragePercent = Math.round((activeDimensions / 9) * 100);
  const handleTaskAdded = (newTask: RescueTask) => {
    onEdit({ tasks: [newTask, ...(tasks || [])] });
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-right-2 duration-300">
      
      {/* --- Overview Banner --- */}
      <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
            <h3 className="font-bold text-sm flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-primary"/>
                تور نجات (Rescue Net)
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              برنامه جامع برای توسعه متوازن در ۹ بعد اصلی زندگی.
            </p>
        </div>
        <div className="flex items-center gap-4 text-center">
            <div>
                <div className="text-xl font-black text-primary">{`${completedTasks}/${totalTasks}`}</div>
                <div className="text-[10px] text-muted-foreground">تکالیف انجام شده</div>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div>
                <div className="text-xl font-black text-primary">{coveragePercent}%</div>
                <div className="text-[10px] text-muted-foreground">پوشش ابعاد</div>
            </div>
            <AddTaskDialog 
                patientId={patientId}
                onSuccess={handleTaskAdded}
                trigger={
                    <Button size="sm" className="gap-2 h-9">
                        <Plus className="w-4 h-4" /> افزودن
                    </Button>
                }
            />
        </div>
      </div>

      {/* --- Grid of Dimensions --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groupedTasks.map((group) => (
          <div key={group.key} className="border border-border/60 rounded-xl overflow-hidden bg-card/50 hover:bg-card transition-colors shadow-sm">
            
            {/* Dimension Header */}
            <div className={`px-4 py-2 text-xs font-bold flex justify-between items-center border-b ${group.colorClass}`}>
              <span>{group.label}</span>
              {group.items.length > 0 && (
                  <Badge variant="secondary" className="bg-white/50 text-inherit border-0 h-5 px-1.5 text-[10px]">
                    {group.items.filter(t => t.status === 'DONE').length} / {group.items.length}
                  </Badge>
              )}
            </div>

            {/* List of Tasks for this Dimension */}
            <div className="p-2 space-y-1 min-h-[60px]">
              {group.items.length === 0 ? (
                <div className="py-3 flex items-center justify-center text-[10px] text-muted-foreground/40 italic">
                  — تکلیفی ثبت نشده —
                </div>
              ) : (
                group.items.map(task => (
                  <div key={task.id} className="group/task flex items-start gap-3 p-2.5 rounded-lg bg-background border border-border/30 shadow-sm">
                    {/* Status Icon */}
                    <div className="mt-0.5 shrink-0">
                      {task.status === "DONE" ? (
                        <div className="bg-emerald-100 text-emerald-600 rounded-full p-0.5">
                            <Check className="w-3 h-3" />
                        </div>
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground/30" />
                      )}
                    </div>
                    {/* Task Text */}
                    <span className={`text-xs leading-relaxed ${task.status === "DONE" ? "line-through opacity-50" : ""}`}>
                      {task.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}