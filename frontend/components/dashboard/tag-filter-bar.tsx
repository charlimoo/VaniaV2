"use client"

import { Badge } from "@/components/ui/badge"
import { Filter, X, UserCheck } from "lucide-react"
import { cn } from "@/lib/utils"

// --- [MODIFIED] --- Props are now role-specific
interface RoleFilterBarProps {
  allRoles: string[];
  selectedRoles: string[];
  onToggle: (role: string) => void;
  onClear: () => void;
  className?: string;
}

export function RoleFilterBar({ 
  allRoles, 
  selectedRoles, 
  onToggle, 
  onClear,
  className 
}: RoleFilterBarProps) {
  
  if (!allRoles || allRoles.length === 0) return null;

  const isAllSelected = selectedRoles.includes('All');

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} dir="rtl">
      
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium ml-2 select-none">
        <Filter className="h-3.5 w-3.5" />
        <span>طرح:</span>
      </div>

      {/* --- [NEW] --- "All" button */}
      <Badge
        variant={isAllSelected ? "default" : "outline"}
        onClick={() => onToggle('All')}
        className={cn(
          "cursor-pointer transition-all duration-200 text-[11px] px-3 py-1 h-7 select-none border",
          isAllSelected 
            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm border-primary/50" 
            : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground hover:bg-muted"
        )}
      >
        همه
      </Badge>

      {/* Separator */}
      <div className="h-5 w-[1px] bg-border mx-1"></div>

      {/* Role-based Filters */}
      {allRoles.map((role) => {
        const isSelected = selectedRoles.includes(role);
        return (
          <Badge
            key={role}
            variant={isSelected ? "default" : "outline"}
            onClick={() => onToggle(role)}
            className={cn(
              "cursor-pointer transition-all duration-200 text-[11px] px-3 py-1 h-7 select-none border gap-1.5",
              isSelected 
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm border-primary/50" 
                : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground hover:bg-muted"
            )}
          >
            <UserCheck className="h-3 w-3" />
            {role}
          </Badge>
        )
      })}

      {/* --- [MODIFIED] --- Clear button now shows when "All" is NOT selected */}
      {!isAllSelected && (
        <button
          onClick={onClear}
          className="text-[10px] text-muted-foreground hover:text-destructive transition-colors mr-auto flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-destructive/10"
        >
          <X className="h-3 w-3" />
          پاک کردن
        </button>
      )}
    </div>
  )
}