// frontend/components/chat/PatientSelector.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation"; 
import { 
  Check, 
  ChevronsUpDown, 
  User, 
  X, 
  Loader2, 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { useVaniaStore } from "@/lib/vania/store";
import { AddPatientModal } from "./AddPatientModal";

interface Patient {
  id: number;
  full_name?: string;
  phone_number: string;
}

export function PatientSelector() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const agentId = params.agentId as string;
  
  const { activePatientId, activePatientName, setActivePatient, reset: resetVaniaStore } = useVaniaStore();

  // 1. Sync Store with URL (Clear if removed)
  useEffect(() => {
    const urlPatientId = searchParams.get('visitorId') || searchParams.get('patientId');
    if (!urlPatientId && activePatientId) {
        resetVaniaStore();
    }
  }, [searchParams, activePatientId, resetVaniaStore]);

  // 2. Fetch Data & Hydrate from URL on Refresh
  useEffect(() => {
    // We fetch if:
    // A) The popover is opened
    // B) OR we have a patientId in URL but haven't loaded the name yet (Refresh scenario)
    const urlPatientId = searchParams.get('visitorId') || searchParams.get('patientId');
    const shouldFetch = (popoverOpen || urlPatientId) && !hasLoaded && !loading;

    if (shouldFetch) {
      setLoading(true);
      fetch(`${API_BASE_URL}/api/vania/my-visitors/`, { headers: getAuthHeaders() })
        .then(res => res.ok ? res.json() : Promise.reject('Failed to fetch visitors'))
        .then(data => {
          const validPatients: Patient[] = data
            .filter((p: any) => p.patient_id !== null && p.status === "ACTIVE")
            .map((p: any) => ({
              id: p.patient_id,
              full_name: p.name,
              phone_number: p.phone
            }));
          
          const uniquePatients: Patient[] = Array.from(
            new Map(validPatients.map((item) => [item.id, item])).values()
          );

          setPatients(uniquePatients);
          setHasLoaded(true);

          // [FIX] HYDRATION LOGIC
          // If URL has an ID, find it in the list and set the store immediately
          if (urlPatientId) {
            const targetId = parseInt(urlPatientId);
            const match = uniquePatients.find(p => p.id === targetId);
            
            if (match) {
                // Only update if different to avoid loops
                if (activePatientId !== targetId || !activePatientName) {
                    setActivePatient(targetId, match.full_name || match.phone_number);
                }
            }
          }
        })
        .catch(error => console.error("Failed to fetch visitor list:", error))
        .finally(() => setLoading(false));
    }
  }, [popoverOpen, hasLoaded, loading, searchParams, activePatientId, activePatientName, setActivePatient]);

  // --- Event Handlers ---

  const handleSelectPatient = (patientId: number, name: string) => {
    setActivePatient(patientId, name);
    setPopoverOpen(false);
    
    const newThreadId = `local-${crypto.randomUUID()}`;
    router.push(`/chat/${agentId}/${newThreadId}?visitorId=${patientId}`);
  };

  const handleClearContext = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    resetVaniaStore();
    
    const newThreadId = `local-${crypto.randomUUID()}`;
    router.push(`/chat/${agentId}/${newThreadId}`);
  };

  // Determine display name
  const selectedPatient = patients.find(p => p.id === activePatientId);
  
  // Prefer store name if available (instant), fallback to list lookup, fallback to placeholder
  const displayName = activePatientName || selectedPatient?.full_name || "انتخاب پرونده مراجع";

  // Check if we are in a loading state for the initial hydration
  const isHydrating = loading && !hasLoaded && (searchParams.get('visitorId') || searchParams.get('patientId'));

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={popoverOpen}
          className={cn(
            "h-8 pl-2 pr-3 gap-3 rounded-full border transition-all duration-300 group",
            activePatientId 
              ? "bg-primary/10 border-primary/20 text-primary-800 hover:bg-primary/20 hover:border-primary/30" 
              : "bg-background text-muted-foreground hover:border-border hover:text-foreground"
          )}
        >
          <div className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
            activePatientId ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {isHydrating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
          </div>

          <div className="flex flex-col items-start min-w-[100px]">
            <span className="text-xs font-semibold truncate max-w-[150px]">
                {isHydrating ? "در حال بارگذاری..." : displayName}
            </span>
          </div>

          <div className="flex items-center gap-1 border-r border-border/50 pr-2 mr-1">
            {activePatientId ? (
               <div 
                  role="button" 
                  className="p-1 hover:bg-primary/20 rounded-full transition-colors" 
                  onClick={handleClearContext}
                  title="بستن پرونده و شروع گفتگوی آزاد"
               >
                  <X className="h-3 w-3" />
               </div>
            ) : (
               <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
            )}
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[320px] p-0 rounded-xl shadow-lg border-border/60" align="start" sideOffset={8}>
        <Command dir="rtl" className="rounded-xl">
          <div className="flex items-center border-b px-3 bg-muted/20">
            <CommandInput 
                placeholder="جستجوی نام یا شماره تماس مراجع..." 
                className="h-11 bg-transparent text-sm"
            />
          </div>
          
          <CommandList className="max-h-[300px] overflow-y-auto p-1">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                {loading ? "در حال بارگذاری..." : "مراجعی یافت نشد."}
            </CommandEmpty>
            
            <CommandGroup heading="لیست مراجعین شما" className="px-1 text-xs text-muted-foreground font-medium">
              {patients.map((patient) => {
                const isSelected = activePatientId === patient.id;
                return (
                  <CommandItem
                    key={patient.id}
                    value={`${patient.full_name || ''} ${patient.phone_number}`}
                    onSelect={() => handleSelectPatient(patient.id, patient.full_name || patient.phone_number)}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 mb-1 cursor-pointer"
                  >
                    <Avatar className="h-9 w-9 border">
                        <AvatarFallback className={cn(isSelected ? "bg-primary text-primary-foreground" : "bg-muted")}>
                            {patient.full_name ? patient.full_name.slice(0, 1) : "P"}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate">{patient.full_name || "مراجع بدون نام"}</span>
                        <p className="text-[10px] text-muted-foreground font-mono">{patient.phone_number}</p>
                    </div>

                    {isSelected && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          
          <CommandSeparator />
          
          {/* <div className="p-1 bg-muted/30">
             <AddPatientModal />
          </div> */}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
