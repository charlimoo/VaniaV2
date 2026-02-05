// frontend/components/chat/PatientSelector.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { 
  Check, 
  ChevronsUpDown, 
  User, 
  X, 
  Loader2, 
  Stethoscope
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { AddPatientModal } from "./AddPatientModal"; // Import the new modal

// --- Type Definitions ---
interface Patient {
  id: number;
  full_name?: string;
  phone_number: string;
}

/**
 * Renders a dropdown in the chat header that allows the doctor to select, switch,
 * and clear the active patient context. This is the primary mechanism for telling
 * the Vania agent which patient file to work on.
 */
export function PatientSelector() {
  // --- State Hooks ---
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // --- React & Library Hooks ---
  const router = useRouter();
  const params = useParams();
  const agentId = params.agentId as string;
  const { activePatientId, activePatientName, setActivePatient, reset: resetVaniaStore } = useVaniaStore();

  // --- Data Fetching Effect ---
  // Fetches the list of patients when the popover is opened or if a patient is already active.
  useEffect(() => {
    const shouldFetch = (popoverOpen || activePatientId) && !hasLoaded && !loading;

    if (shouldFetch) {
      setLoading(true);
      fetch(`${API_BASE_URL}/api/vania/my-patients/`, { headers: getAuthHeaders() })
        .then(res => res.ok ? res.json() : Promise.reject('Failed to fetch patients'))
        .then(data => {
          // [FIX] Explicitly type the map result
          const validPatients: Patient[] = data
            .filter((p: any) => p.patient_id !== null)
            .map((p: any) => ({
              id: p.patient_id,
              full_name: p.name,
              phone_number: p.phone
            }));
          
          // [FIX] Explicitly type the Map logic to ensure TS knows the values are Patients
          const uniquePatients: Patient[] = Array.from(
            new Map(validPatients.map((item) => [item.id, item])).values()
          );

          setPatients(uniquePatients);
          setHasLoaded(true);

          // Auto-resolve patient name
          if (activePatientId) {
            // [FIX] 'p' is now correctly inferred as Patient
            const match = uniquePatients.find(p => p.id === activePatientId);
            if (match && (!activePatientName || activePatientName === "Loading...")) {
              setActivePatient(activePatientId, match.full_name || match.phone_number);
            }
          }
        })
        .catch(error => console.error("Failed to fetch patient list:", error))
        .finally(() => setLoading(false));
    }
  }, [popoverOpen, hasLoaded, activePatientId, activePatientName, loading, setActivePatient]);

  // --- Event Handlers ---

  const handleSelectPatient = (patientId: number, name: string) => {
    // 1. Update global state
    setActivePatient(patientId, name);
    setPopoverOpen(false);
    
    // 2. Navigate to a new chat thread locked to this patient's context
    const newThreadId = `local-${crypto.randomUUID()}`;
    router.push(`/chat/${agentId}/${newThreadId}?patientId=${patientId}`);
  };

  const handleClearContext = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the popover from opening
    // 1. Reset global state
    resetVaniaStore();
    
    // 2. Navigate to a new, context-free chat thread
    const newThreadId = `local-${crypto.randomUUID()}`;
    router.push(`/chat/${agentId}/${newThreadId}`);
  };

  // --- Render Logic ---
  const selectedPatient = patients.find(p => p.id === activePatientId);
  const displayName = selectedPatient?.full_name || activePatientName || "انتخاب پرونده بیمار";

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
          {/* Avatar Icon */}
          <div className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
            activePatientId ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {loading && !hasLoaded ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
          </div>

          {/* Text Info */}
          <div className="flex flex-col items-start min-w-[100px]">
            <span className="text-xs font-semibold truncate max-w-[150px]">{displayName}</span>
          </div>

          {/* Actions: Clear or Chevron */}
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
          {/* Search Input */}
          <div className="flex items-center border-b px-3 bg-muted/20">
            <CommandInput 
                placeholder="جستجوی نام یا شماره تماس بیمار..." 
                className="h-11 bg-transparent text-sm"
            />
          </div>
          
          <CommandList className="max-h-[300px] overflow-y-auto p-1">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                {loading ? "در حال بارگذاری..." : "بیماری یافت نشد."}
            </CommandEmpty>
            
            <CommandGroup heading="لیست بیماران شما" className="px-1 text-xs text-muted-foreground font-medium">
              {patients.map((patient) => {
                const isSelected = activePatientId === patient.id;
                return (
                  <CommandItem
                    key={patient.id}
                    value={`${patient.full_name || ''} ${patient.phone_number}`}
                    onSelect={() => handleSelectPatient(patient.id, patient.full_name || patient.phone_number)}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 mb-1 cursor-pointer"
                  >
                    {/* Avatar */}
                    <Avatar className="h-9 w-9 border">
                        <AvatarFallback className={cn(isSelected ? "bg-primary text-primary-foreground" : "bg-muted")}>
                            {patient.full_name ? patient.full_name.slice(0, 1) : "P"}
                        </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate">{patient.full_name || "بیمار بدون نام"}</span>
                        <p className="text-[10px] text-muted-foreground font-mono">{patient.phone_number}</p>
                    </div>

                    {/* Check Icon for selected patient */}
                    {isSelected && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          
          <CommandSeparator />
          
          {/* "Add New Patient" trigger integrated into the popover footer */}
          <div className="p-1 bg-muted/30">
             <AddPatientModal />
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}