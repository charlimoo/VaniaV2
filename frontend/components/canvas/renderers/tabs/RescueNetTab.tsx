// frontend/components/canvas/renderers/tabs/RescueNetTab.tsx
"use client";

import { RescueTask, RescueDimension } from "@/lib/types/vania";
import { Check, LifeBuoy, Plus, Trash2, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

import { AddTaskDialog } from "./rescuenet/AddTaskDialog";
import { EditTaskDialog } from "./rescuenet/EditTaskDialog";
import { RescueNetDownloadButton } from "./rescuenet/RescueNetDownloadButton";

interface Props {
  tasks: RescueTask[];
  patientId: number;
  caseId?: string;
  onEdit: (delta: any) => void;
  readOnly?: boolean;
}
// --- Configuration for the 9 Dimensions ---
const DIMENSIONS: { key: RescueDimension; label: string; colorClass: string }[] = [
  { key: "PERSONAL", label: "رشد شخصی", colorClass: "bg-muted-50 text-red-400 border-muted" },
  { key: "EMOTIONAL", label: "رشد عاطفی", colorClass: "bg-muted-50 text-pink-400 border-muted" },
  { key: "RELATIONSHIP", label: "ارتباط سودمند", colorClass: "bg-muted-50 text-purple-400 border-muted" },
  { key: "FRIENDSHIP", label: "ارتباط با دوستان", colorClass: "bg-muted-50 text-indigo-400 border-muted" },
  { key: "CAREER", label: "شغلی-تحصیلی", colorClass: "bg-muted-50 text-blue-400 border-muted" },
  { key: "INTELLECTUAL", label: "رشد فکری", colorClass: "bg-muted-50 text-cyan-400 border-muted" },
  { key: "ENVIRONMENT", label: "رشد محیطی", colorClass: "bg-muted-50 text-teal-400 border-muted" },
  { key: "RECREATION", label: "تفریحی-ورزشی", colorClass: "bg-muted-50 text-green-400 border-muted" },
  { key: "SOLITUDE", label: "مدیریت تنهایی", colorClass: "bg-muted-50 text-orange-400 border-muted" },
];

const formatDueDate = (value?: string) => {
  if (!value) return "";
  if (value.includes("/")) return value;
  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("fa-IR");
  } catch {
    return value;
  }
};

export function RescueNetTab({ tasks, patientId, caseId, onEdit, readOnly = false }: Props) {
  
  // Group tasks
  const groupedTasks = DIMENSIONS.map(dim => ({
    ...dim,
    items: tasks?.filter(t => t.dimension === dim.key) || []
  }));

  const totalTasks = tasks?.length || 0;
  const completedTasks = tasks?.filter(t => t.status === 'DONE').length || 0;
  const activeDimensions = groupedTasks.filter(g => g.items.length > 0).length;
  const coveragePercent = totalTasks > 0 ? Math.round((activeDimensions / 9) * 100) : 0;

  // --- Handlers ---

  const handleTaskAdded = (newTask: RescueTask) => {
    onEdit({ tasks: [newTask, ...(tasks || [])] });
  };

  const handleTaskUpdated = (updatedTask: RescueTask) => {
    const newTasks = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    onEdit({ tasks: newTasks });
  };

  const handleDelete = async (taskId: string) => {
    if (readOnly) return;
    if (!confirm("آیا از حذف این تکلیف اطمینان دارید؟")) return;

    try {
        const res = await fetch(`${API_BASE_URL}/api/vania/tasks/manage/${taskId}/?patient_id=${patientId}`, {
            method: "DELETE",
            headers: { ...getAuthHeaders(), ...(caseId ? { "X-Target-Case-ID": caseId } : {}) }
        });

        if (!res.ok) throw new Error("خطا در حذف تکلیف");

        toast.success("تکلیف حذف شد.");
        const newTasks = tasks.filter(t => t.id !== taskId);
        onEdit({ tasks: newTasks });

    } catch (e: any) {
        toast.error(e.message);
    }
  };

  const handleToggleStatus = async (task: RescueTask) => {
    if (readOnly) return;
    const newStatus = task.status === "DONE" ? "PENDING" : "DONE";
    
    // Optimistic
    const newTasks = tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
    onEdit({ tasks: newTasks });

    try {
        // Use the general completion endpoint which supports doctors via role check
        // Or reuse the complete-my-task endpoint if permissions allow
        // Here we use the dedicated task update endpoint for doctors
        const res = await fetch(`${API_BASE_URL}/api/vania/tasks/manage/${task.id}/`, {
            method: "PUT", // Assuming PUT can toggle status or creating a dedicated toggle
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            // We use the CompleteTaskView endpoint logic or TaskManagementView
            // Actually, let's use the dedicated completion endpoint which we will fix in backend
        }); 
        
        // BETTER APPROACH: Use the dedicated CompleteTaskView but fix permissions in Backend
        const completeRes = await fetch(`${API_BASE_URL}/api/vania/my-tasks/${task.id}/complete/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ 
                status: newStatus,
                patient_id: patientId // Pass patient ID for doctor context
                ,case_id: caseId
            })
        });

        if (!completeRes.ok) throw new Error("خطا در تغییر وضعیت.");

    } catch (e) {
        toast.error("خطا در همگام‌سازی وضعیت.");
        onEdit({ tasks }); // Revert
    }
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in slide-in-from-right-2 duration-300">
      
      {/* Overview Banner */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
            <h3 className="font-bold text-sm flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-primary"/>
                تور نجات
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              مدیریت تکالیف و تمرین‌های مراجع در ۹ بعد اصلی.
            </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-center sm:gap-4">
          <RescueNetDownloadButton tasks={tasks || []} patientId={patientId} />
            <div className="min-w-[64px]">
                <div className="text-xl font-black text-primary">{`${completedTasks}/${totalTasks}`}</div>
                <div className="text-[10px] text-muted-foreground">انجام شده</div>
            </div>
            <div className="hidden h-8 w-px bg-border/50 sm:block" />
            <div className="min-w-[64px]">
                <div className="text-xl font-black text-primary">{coveragePercent}%</div>
                <div className="text-[10px] text-muted-foreground">تنوع ابعاد</div>
            </div>
            
            {!readOnly ? <AddTaskDialog 
                patientId={patientId}
                caseId={caseId}
                onSuccess={handleTaskAdded}
                trigger={
                    <Button size="sm" className="gap-2 h-9">
                        <Plus className="w-4 h-4" /> افزودن
                    </Button>
                }
            /> : null}
            
        </div>
      </div>

      {/* Dimensions Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {groupedTasks.map((group) => (
          <div key={group.key} className="border border-border/60 rounded-xl overflow-hidden bg-card/50 hover:bg-card transition-colors shadow-sm">
            
            <div className={`px-4 py-2.5 text-xs font-bold flex justify-between items-center border-b ${group.colorClass}`}>
              <span className="flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60"/>
                 {group.label}
              </span>
              {group.items.length > 0 && (
                  <Badge variant="secondary" className="bg-background/80 text-foreground border-0 h-5 px-1.5 text-[10px] shadow-sm">
                    {group.items.filter(t => t.status === 'DONE').length} / {group.items.length}
                  </Badge>
              )}
            </div>

            <div className="p-2 space-y-1 min-h-[60px]">
              {group.items.length === 0 ? (
                <div className="py-4 flex items-center justify-center text-[10px] text-muted-foreground/40 italic">
                  — خالی —
                </div>
              ) : (
                group.items.map(task => (
                  <div key={task.id} className="group/task flex items-start gap-2 p-2 rounded-lg bg-background border border-border/40 hover:border-primary/30 transition-all shadow-sm">
                    
                    {/* Status Toggle */}
                    <button 
                        onClick={() => handleToggleStatus(task)}
                        className={cn(
                            "mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all",
                            readOnly && "cursor-default opacity-70",
                            task.status === "DONE" 
                                ? "bg-emerald-500 border-emerald-500 text-white" 
                                : "border-muted-foreground/30 hover:border-primary bg-muted/10"
                        )}
                        disabled={readOnly}
                    >
                        {task.status === "DONE" && <Check className="w-3 h-3" />}
                    </button>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                        <p className={cn("text-xs leading-relaxed", task.status === "DONE" && "line-through text-muted-foreground opacity-70")}>
                          {task.text}
                        </p>
                        {task.due_date && task.status !== "DONE" && (
                          <div className="flex items-center gap-1 mt-1 text-[9px] text-amber-600/80 font-medium">
                            <CalendarClock className="w-2.5 h-2.5" />
                            {formatDueDate(task.due_date)}
                          </div>
                        )}
                    </div>

                    {/* Actions (Edit/Delete) - Only show on hover */}
                    {!readOnly ? <div className="flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover/task:opacity-100">
                        <EditTaskDialog task={task} patientId={patientId} caseId={caseId} onSuccess={handleTaskUpdated} />
                        
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                            onClick={() => handleDelete(task.id)}
                        >
                            <Trash2 className="w-3 h-3" />
                        </Button>
                    </div> : null}
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
