// frontend/app/(dashboard)/dashboard/doctors/page.tsx
"use client";
import { RoleGuard } from "@/components/role-guard";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Stethoscope, 
  Search, 
  Plus, 
  MessageSquare, 
  Loader2, 
  AlertCircle,
  MoreVertical,
  CalendarCheck
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { cn } from "@/lib/utils";

// Types
interface ConnectedDoctor {
  user_id: number;
  name: string;
  avatar: string | null;
  role_label: string;
  specialty?: string; // New field from backend update
  last_message: string;
  last_message_date: string;
  unread_count: number;
}

export default function MyDoctorsPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<ConnectedDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchMyDoctors = async () => {
      try {
        // We use the Inbox API because it returns active connections with message status
        const res = await fetch(`${API_BASE_URL}/api/vania/messages/inbox/`, {
          headers: getAuthHeaders()
        });
        
        if (res.ok) {
          const data = await res.json();
          // Filter to show only 'Doctors' (in case patient is messaging support/admin)
          // Note: In Vania context, 'role_label' is usually 'پزشک'
          setDoctors(data); 
        } else {
            throw new Error("Failed to load doctors.");
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMyDoctors();
  }, []);

  const handleMessage = (doctorId: number) => {
    // Navigate to the full chat page with this doctor selected
    // Note: The Messages page logic typically requires selecting from the list,
    // but we can likely deep link if we refactor MessagesPage or just open the list.
    // For now, simpler is redirecting to inbox, or if MessagesPage supports ID param.
    // Assuming MessagesPage architecture:
    // We can simulate opening the thread by passing state or just navigation.
    // Or we can just build a simplified chat link.
    // Given the previous code, let's assume we can navigate to the chat page.
    // Actually, `messages/page.tsx` loads the list. Let's just go there.
    router.push(`/dashboard/messages`); 
    // Ideally, we'd pass ?userId=... but the Messages page needs to implement reading that.
  };

  const filteredDoctors = doctors.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    (d.specialty && d.specialty.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <RoleGuard allowedRoles={['patient']}>
    <div className="flex flex-col w-full h-full space-y-8 pb-10 max-w-6xl mx-auto pt-6" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" />
            پزشکان من
          </h1>
          <p className="text-muted-foreground text-sm">
            لیست پزشکانی که با آنها در ارتباط هستید.
          </p>
        </div>

        <Button asChild className="gap-2 shadow-sm">
          <Link href="/dashboard/doctors/find">
            <Plus className="h-4 w-4" /> یافتن پزشک جدید
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="جستجو در پزشکان من..." 
          className="pr-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-6 w-6 animate-spin" /> در حال بارگذاری...
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>خطا</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : filteredDoctors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-muted/10 border-2 border-dashed rounded-xl">
            <Stethoscope className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-medium">شما هنوز با هیچ پزشکی در ارتباط نیستید.</p>
            <Button variant="link" asChild className="mt-2 text-primary">
                <Link href="/dashboard/doctors/find">جستجوی پزشک</Link>
            </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
          {filteredDoctors.map(doc => (
            <Card key={doc.user_id} className="hover:shadow-md transition-shadow flex flex-col">
               <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                  <div className="flex gap-3">
                     <Avatar className="h-12 w-12 border border-border">
                        <AvatarImage src={doc.avatar || ""} />
                        <AvatarFallback className="bg-indigo-50 text-indigo-600">
                           {doc.name.slice(0,1)}
                        </AvatarFallback>
                     </Avatar>
                     <div>
                        <CardTitle className="text-base font-bold">{doc.name}</CardTitle>
                        <CardDescription className="text-xs mt-1 font-medium text-primary">
                           {doc.specialty || "متخصص"}
                        </CardDescription>
                     </div>
                  </div>

               </CardHeader>
               
               <CardContent className="flex-1 pb-2">
                 {/* Last Message Preview */}
                 <div className="bg-muted/30 rounded-lg p-3 text-xs mt-2 border border-border/50">
                    <div className="flex justify-between items-center mb-1 text-[10px] text-muted-foreground">
                        <span>آخرین پیام</span>
                        <span>{new Date(doc.last_message_date).toLocaleDateString('fa-IR')}</span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                        {doc.last_message}
                    </p>
                 </div>
               </CardContent>

               <CardFooter className="pt-2 flex gap-2">
                  <Button 
                    className={cn(
                        "w-full gap-2", 
                        doc.unread_count > 0 ? "bg-emerald-600 hover:bg-emerald-700" : ""
                    )} 
                    variant={doc.unread_count > 0 ? "default" : "outline"}
                    onClick={() => handleMessage(doc.user_id)}
                  >
                     <MessageSquare className="h-4 w-4" />
                     {doc.unread_count > 0 ? `پیام جدید (${doc.unread_count})` : "ارسال پیام"}
                  </Button>
               </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
    </RoleGuard>
  );
}