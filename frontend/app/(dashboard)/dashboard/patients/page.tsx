// frontend/app/(dashboard)/dashboard/patients/page.tsx
"use client";

import { RoleGuard } from "@/components/role-guard";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Users, 
  Search, 
  Plus, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  User, 
  AlertCircle,
  Check,
  X,
  Calendar,
  ClipboardList,
  MessageSquare,
  Phone,
  Mail,
  Lock
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

import { API_BASE_URL, getAuthHeaders, lookupPatientForDoctor } from "@/lib/api";
import { useVaniaStore } from "@/lib/vania/store";
import { cn } from "@/lib/utils";

// --- Types ---
interface PatientRow {
  id: string;
  db_id: number;
  type: "CONNECTION" | "INVITE" | "REQUEST";
  patient_id: number | null;
  name: string;
  phone: string;
  status: "ACTIVE" | "ARCHIVED" | "PENDING_PATIENT_APPROVAL" | "PENDING_DOCTOR_APPROVAL" | "PENDING_PATIENT" | "PENDING_DOCTOR" | "INVITED" | "REJECTED";
  date: string;
  request_data?: {
    main_concern: string;
    history_brief?: string;
    preferred_time?: string;
  };
}

type RequestState = 'PENDING' | 'ACCEPTING' | 'REJECTING' | 'ACCEPTED' | 'REJECTED';

interface ExistingPatientPreview {
  id: number;
  full_name: string;
  phone_number: string;
  existing_connection_status: string | null;
  activation_locked: boolean;
}

function PatientsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setActivePatient } = useVaniaStore();
  
  const initialTab = searchParams.get("tab") === "REQUESTS" ? "REQUESTS" : "ACTIVE";
  const [activeTab, setActiveTab] = useState(initialTab);

  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [useCompactRowActions, setUseCompactRowActions] = useState(false);
  
  const [requestStates, setRequestStates] = useState<Record<number, RequestState>>({});
  
  // --- INVITE FLOW STATE ---
  const [isInviteOpen, setIsInviteOpen] = useState(false);        // Modal 1: Phone Entry
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false); // Modal 2: Profile Details
  const [isExistingPatientModalOpen, setIsExistingPatientModalOpen] = useState(false); // Modal 2-alt: Existing user
  const [existingPatient, setExistingPatient] = useState<ExistingPatientPreview | null>(null);
  
  const [invitePhone, setInvitePhone] = useState("");
  const [profileData, setProfileData] = useState({
    fullName: "",
    password: "",
    email: ""
  });

  const [isChecking, setIsChecking] = useState(false); // Checking phone existence
  const [isInviting, setIsInviting] = useState(false); // Performing final invite
  const [statusUpdating, setStatusUpdating] = useState<Record<number, boolean>>({});

  // --- DATA FETCHING ---
  const fetchPatients = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/my-patients/`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        throw new Error("بارگذاری لیست بیماران ناموفق بود.");
      }
      const data: PatientRow[] = await res.json();
      setPatients(data);
      
      if (!isRefresh) {
        const initialStates: Record<number, RequestState> = {};
        data.forEach((p) => {
          if (p.type === 'REQUEST') {
            initialStates[p.db_id] = 'PENDING';
          }
        });
        setRequestStates(initialStates);
      }

    } catch (error: any) {
      console.error("Failed to load patients", error);
      toast.error("خطا در بارگذاری لیست بیماران");
      setError(error.message);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    const mobileViewport = window.matchMedia("(max-width: 1023px)");
    const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)");

    const syncActionMode = () => {
      setUseCompactRowActions(mobileViewport.matches || coarsePointer.matches);
    };

    syncActionMode();
    mobileViewport.addEventListener("change", syncActionMode);
    coarsePointer.addEventListener("change", syncActionMode);

    return () => {
      mobileViewport.removeEventListener("change", syncActionMode);
      coarsePointer.removeEventListener("change", syncActionMode);
    };
  }, []);

  // --- ACTIONS: ADD PATIENT FLOW ---

  // Step 1: Check Phone Number
  const handleCheckAndInvite = async () => {
    if (!invitePhone || invitePhone.length < 10) {
      toast.error("شماره موبایل وارد شده معتبر نیست.");
      return;
    }

    setIsChecking(true);
    try {
      const lookup = await lookupPatientForDoctor(invitePhone);
      if (lookup.exists && lookup.patient) {
        setExistingPatient({
          id: lookup.patient.id,
          full_name: lookup.patient.full_name,
          phone_number: lookup.patient.phone_number,
          existing_connection_status: lookup.existing_connection_status ?? null,
          activation_locked: !!lookup.activation_locked,
        });
        setIsInviteOpen(false);
        setIsExistingPatientModalOpen(true);
      } else {
        setIsInviteOpen(false);
        setIsProfileModalOpen(true);
      }
    } catch (e) {
      toast.error("خطا در بررسی شماره موبایل.");
    } finally {
      setIsChecking(false);
    }
  };

  // Step 2: Execute Invitation (With or Without Profile Data)
  const executeInvite = async (skipProfile = false) => {
    setIsInviting(true);

    const payload = {
      phone_number: invitePhone,
      ...(skipProfile ? {} : {
        full_name: profileData.fullName,
        password: profileData.password,
        email: profileData.email
      })
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/patients/invite/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        if (data.activation_locked || data.status === "ARCHIVED") {
          toast.success("بیمار به لیست اضافه شد اما فعلا غیرفعال است.");
        } else {
          toast.success(data.message || "عملیات با موفقیت انجام شد.");
        }

        setIsInviteOpen(false);
        setIsProfileModalOpen(false);
        setIsExistingPatientModalOpen(false);
        setExistingPatient(null);
        setInvitePhone("");
        setProfileData({ fullName: "", password: "", email: "" });
        fetchPatients(true);
      } else {
        toast.error(data.error || "خطا در افزودن بیمار");
      }
    } catch (e) {
      toast.error("خطای شبکه.");
    } finally {
      setIsInviting(false);
    }
  };

  // --- ACTIONS: MANAGE REQUESTS ---

  const handleRespond = async (id: number, action: 'ACCEPT' | 'REJECT') => {
    setRequestStates(prev => ({ ...prev, [id]: action === 'ACCEPT' ? 'ACCEPTING' : 'REJECTING' }));
    try {
        const res = await fetch(`${API_BASE_URL}/api/vania/my-patients/requests/${id}/respond/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({ action })
        });
        if (res.ok) {
            toast.success(action === 'ACCEPT' ? "بیمار به لیست شما اضافه شد." : "درخواست رد شد.");
            setRequestStates(prev => ({ ...prev, [id]: action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED' }));
            setTimeout(() => fetchPatients(true), 2000); // Refresh list in background
        } else {
            const data = await res.json();
            toast.error(data.error || "خطا در انجام عملیات");
            setRequestStates(prev => ({ ...prev, [id]: 'PENDING' }));
        }
    } catch (e) {
        toast.error("خطا در برقراری ارتباط");
        setRequestStates(prev => ({ ...prev, [id]: 'PENDING' }));
    }
  };

  const handleOpenClinicalChat = (patient: PatientRow) => {
    if (!patient.patient_id) {
      toast.info("این بیمار هنوز ثبت‌نام نکرده است و پرونده‌ای ندارد.");
      return;
    }
    if (patient.status !== "ACTIVE") {
      toast.info("پرونده بالینی فقط برای بیماران فعال در دسترس است.");
      return;
    }
    setActivePatient(patient.patient_id, patient.name);
    const threadId = `local-${crypto.randomUUID()}`;
    router.push(`/chat/vania-doctor-assistant/${threadId}?patientId=${patient.patient_id}`);
  };

  const handleMessage = (patientId: number | null) => {
    if (!patientId) return;
    router.push(`/dashboard/messages?userId=${patientId}`);
  };

  const handleToggleStatus = async (patient: PatientRow, action: "ACTIVATE" | "DEACTIVATE") => {
    if (patient.type !== "CONNECTION") return;
    setStatusUpdating((prev) => ({ ...prev, [patient.db_id]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/my-patients/${patient.db_id}/status/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ action })
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "وضعیت بیمار به‌روز شد.");
        fetchPatients(true);
        return;
      }

      if (res.status === 409) {
        toast.error("این بیمار در حال حاضر نزد پزشک دیگری فعال است و فعلا قابل فعال‌سازی نیست.");
      } else {
        toast.error(data.error || data.message || "خطا در تغییر وضعیت بیمار.");
      }
    } catch {
      toast.error("خطا در برقراری ارتباط با سرور.");
    } finally {
      setStatusUpdating((prev) => ({ ...prev, [patient.db_id]: false }));
    }
  };

  // --- FILTERING ---
  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.phone.includes(searchQuery)
  );
  
  const requests = filteredPatients.filter(p => p.type === 'REQUEST' || (p.db_id in requestStates));
  const activeList = filteredPatients.filter(p => p.type !== 'REQUEST' && !(p.db_id in requestStates));

  const pendingRequestCount = requests.filter(r => requestStates[r.db_id] === 'PENDING').length;
  const connectionRows = patients.filter((p) => p.type === "CONNECTION" && p.patient_id !== null);
  const kpiTotal = connectionRows.length;
  const kpiActive = connectionRows.filter((p) => p.status === "ACTIVE").length;
  const kpiDeactive = connectionRows.filter((p) => p.status === "ARCHIVED").length;
  const kpiPending = patients.filter((p) =>
    p.status === "PENDING_PATIENT_APPROVAL" ||
    p.status === "PENDING_DOCTOR_APPROVAL" ||
    p.status === "PENDING_PATIENT" ||
    p.status === "PENDING_DOCTOR"
  ).length;

  return (
    <div className="mx-auto flex h-full w-full min-w-0 max-w-6xl flex-col space-y-8 pb-10" dir="rtl">
      
      {/* --- HEADER SECTION --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-border/40 py-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
               <Users className="h-6 w-6 text-primary"  />
            مدیریت مطب
          </h1>
          <p className="text-muted-foreground">
            مشاهده پرونده‌ها، پیگیری درخواست‌های نوبت و مدیریت مراجعین.
          </p>
        </div>

        {/* --- MODAL 1: INITIAL PHONE CHECK --- */}
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2 shadow-md hover:shadow-lg transition-all">
              <Plus className="h-5 w-5" /> افزودن بیمار جدید
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] sm:max-w-lg">
            <DialogHeader className="text-right">
              <DialogTitle>افزودن بیمار جدید</DialogTitle>
              <DialogDescription>
                شماره موبایل بیمار را وارد کنید تا وضعیت عضویت او بررسی شود.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-3">
              <label className="text-sm font-medium">شماره موبایل</label>
              <div className="relative">
                <Phone className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
                <Input 
                  placeholder="09123456789" 
                  className="pr-10 text-left ltr font-mono text-lg"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button onClick={handleCheckAndInvite} disabled={isChecking || invitePhone.length < 10} className="w-full">
                {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : "بررسی و ادامه"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* --- MODAL 2: CREATE PROFILE (Only if new user) --- */}
        <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
            <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-md">
                <DialogHeader className="text-right">
                    <DialogTitle>تکمیل پروفایل بیمار</DialogTitle>
                    <DialogDescription>
                        این کاربر جدید است. می‌توانید اطلاعات اولیه او را تکمیل کنید تا حساب کاربری برایش ایجاد شود.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="py-2 space-y-4">
                    {/* Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">نام و نام خانوادگی</label>
                        <div className="relative">
                            <User className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
                            <Input 
                                placeholder="مثال: علی رضایی" 
                                className="pr-10"
                                value={profileData.fullName}
                                onChange={(e) => setProfileData({...profileData, fullName: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">رمز عبور (اختیاری)</label>
                        <div className="relative">
                            <Lock className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
                            <Input 
                                type="text"
                                placeholder="تعیین رمز عبور اولیه" 
                                className="pr-10 text-left ltr font-mono"
                                value={profileData.password}
                                onChange={(e) => setProfileData({...profileData, password: e.target.value})}
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">ایمیل (اختیاری)</label>
                        <div className="relative">
                            <Mail className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
                            <Input 
                                placeholder="example@mail.com" 
                                className="pr-10 text-left ltr"
                                value={profileData.email}
                                onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-2">
                    <Button variant="outline" onClick={() => executeInvite(true)} disabled={isInviting}>
                        رد کردن و ساخت سریع
                    </Button>
                    <Button onClick={() => executeInvite(false)} disabled={isInviting}>
                        {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : "ساخت حساب و افزودن"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isExistingPatientModalOpen} onOpenChange={setIsExistingPatientModalOpen}>
          <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-md">
            <DialogHeader className="text-right">
              <DialogTitle>کاربر موجود در پلتفرم</DialogTitle>
              <DialogDescription>
                این شماره قبلا در سیستم ثبت شده است. برای افزودن به لیست بیماران تایید کنید.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="rounded-md border p-3">
                <p className="text-sm font-semibold">{existingPatient?.full_name || "کاربر بدون نام"}</p>
                <p className="text-xs text-muted-foreground font-mono mt-1" dir="ltr">{existingPatient?.phone_number}</p>
              </div>
              <Badge variant={existingPatient?.activation_locked ? "outline" : "secondary"} className="font-normal">
                {existingPatient?.activation_locked ? "در صورت افزودن، غیرفعال ثبت می‌شود" : "پس از افزودن، فعال خواهد بود"}
              </Badge>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setIsExistingPatientModalOpen(false)}
                disabled={isInviting}
              >
                انصراف
              </Button>
              <Button onClick={() => executeInvite(true)} disabled={isInviting}>
                {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : "افزودن به لیست بیماران"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>خطا</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* --- CONTENT TABS --- */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0 space-y-6">
        
        {/* Toolbar: Tabs & Search */}
        <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <TabsList className="bg-muted/50 p-1 rounded-xl h-auto self-start">
                <TabsTrigger value="ACTIVE" className="rounded-lg px-4 py-2 data-[state=active]:shadow-sm">
                    لیست بیماران
                </TabsTrigger>
                <TabsTrigger value="REQUESTS" className="rounded-lg px-4 py-2 gap-2 data-[state=active]:shadow-sm">
                    درخواست‌های نوبت
                    {pendingRequestCount > 0 && (
                        <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                            {pendingRequestCount}
                        </Badge>
                    )}
                </TabsTrigger>
            </TabsList>

            <div className="relative w-full min-w-0 md:w-80">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="جستجو بر اساس نام یا شماره..." 
                    className="pr-9 text-right bg-background/50 border-muted-foreground/20 focus:bg-background transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        </div>

        {/* --- TAB 1: ACTIVE PATIENTS TABLE --- */}
        <TabsContent value="ACTIVE" className="mt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground text-right">کل بیماران</p>
                  <p className="text-2xl font-bold mt-1 text-right">{kpiTotal}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground text-right">بیماران فعال</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-600 text-right">{kpiActive}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground text-right">بیماران غیرفعال</p>
                  <p className="text-2xl font-bold mt-1 text-amber-600 text-right">{kpiDeactive}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground text-right">در انتظار تایید</p>
                  <p className="text-2xl font-bold mt-1 text-blue-600 text-right">{kpiPending}</p>
                </CardContent>
              </Card>
            </div>
            <Card className="min-w-0 overflow-hidden border-border shadow-sm">
                <CardContent className="p-0">
                <Table dir="rtl">
<TableHeader className="bg-muted/40">
  <TableRow className="hover:bg-transparent">
    <TableHead className="w-[300px] text-right font-semibold h-12 pr-6">نام بیمار</TableHead>
    <TableHead className="text-right font-semibold">شماره تماس</TableHead>
    <TableHead className="text-center font-semibold w-[220px]">وضعیت</TableHead>
    <TableHead className="text-right font-semibold hidden md:table-cell">تاریخ عضویت</TableHead>
    <TableHead className="text-left font-semibold pl-6">عملیات</TableHead>
  </TableRow>
</TableHeader>
                    <TableBody>
                    {loading ? (
                        <TableRow>
                        <TableCell colSpan={5} className="h-64 text-center">
                            <div className="flex flex-col justify-center items-center gap-3 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" /> 
                                <span>در حال بارگذاری اطلاعات...</span>
                            </div>
                        </TableCell>
                        </TableRow>
                    ) : activeList.length === 0 ? (
                        <TableRow>
                        <TableCell colSpan={5} className="h-64 text-center">
                            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground opacity-60">
                                <Users className="h-10 w-10" />
                                <p>هیچ بیماری در لیست شما یافت نشد.</p>
                            </div>
                        </TableCell>
                        </TableRow>
                    ) : (
                        activeList.map((patient) => (
                        <TableRow key={patient.id} className="group hover:bg-muted/20 transition-colors">
                            <TableCell className="font-medium py-3">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9 border border-border">
                                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                                            {patient.name.slice(0, 2)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-foreground">{patient.name}</span>
                                        {patient.patient_id && <span className="text-[10px] text-muted-foreground">شناسه: {patient.patient_id}</span>}
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-sm">
                                <span className="font-mono bg-muted/30 px-2 py-1 rounded text-muted-foreground" dir="ltr">
                                    {patient.phone}
                                </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {patient.type === "CONNECTION" &&
                                (patient.status === "ACTIVE" || patient.status === "ARCHIVED") && (
                                  <Button
                                    size="sm"
                                    variant={patient.status === "ACTIVE" ? "default" : "outline"}
                                    className={cn(
                                      "h-8 min-w-[100px] text-[11px] gap-1.5",
                                      patient.status === "ACTIVE"
                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
                                        : "text-primary-700 border-amber-300 bg-amber-50 hover:bg-amber-100"
                                    )}
                                    disabled={!!statusUpdating[patient.db_id]}
                                    onClick={() =>
                                      handleToggleStatus(
                                        patient,
                                        patient.status === "ACTIVE" ? "DEACTIVATE" : "ACTIVATE"
                                      )
                                    }
                                  >
                                    {statusUpdating[patient.db_id] ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : patient.status === "ACTIVE" ? (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        فعال
                                      </>
                                    ) : (
                                      <>
                                        <Clock className="w-3.5 h-3.5" />
                                        غیرفعال
                                      </>
                                    )}
                                  </Button>
                                )}
                              {(patient.status === "PENDING_PATIENT_APPROVAL" ||
                                patient.status === "PENDING_DOCTOR_APPROVAL" ||
                                patient.status === "PENDING_PATIENT" ||
                                patient.status === "PENDING_DOCTOR") && (
                                <Badge variant="outline" className="text-muted-foreground gap-1 font-normal bg-background">
                                  <Clock className="w-3 h-3" /> منتظر تایید
                                </Badge>
                              )}
                              {patient.status === "INVITED" && (
                                <Badge variant="outline" className="text-muted-foreground gap-1 font-normal bg-background">
                                  دعوت شده
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs hidden md:table-cell">
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3 opacity-50" />
                                    {new Date(patient.date).toLocaleDateString('fa-IR')}
                                </span>
                            </TableCell>
                            <TableCell className="text-left pl-4" dir="ltr">
                                {patient.status === 'ACTIVE' && (
                                    <div className="flex justify-start items-center gap-2 w-full">
                                        {!useCompactRowActions ? (
                                          <div className="flex gap-2">
                                              <Button size="sm" variant="default" className="h-8 gap-1.5 shadow-sm text-xs font-medium" onClick={() => handleOpenClinicalChat(patient)}>
                                                  <ClipboardList className="h-3.5 w-3.5" /> پرونده بالینی
                                              </Button>
                                              <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground hover:text-primary" onClick={() => handleMessage(patient.patient_id)}>
                                                  <MessageSquare className="h-4 w-4" />
                                              </Button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-1.5">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-8 px-2"
                                              onClick={() => handleOpenClinicalChat(patient)}
                                              title="پرونده بالینی"
                                            >
                                              <ClipboardList className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-8 px-2 text-muted-foreground hover:text-primary"
                                              onClick={() => handleMessage(patient.patient_id)}
                                              title="ارسال پیام"
                                            >
                                              <MessageSquare className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        )}
                                    </div>
                                )}
                                {patient.status === 'ARCHIVED' && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Lock className="h-3.5 w-3.5" />
                                    <span>برای پرونده بالینی و چت باید فعال شود</span>
                                  </div>
                                )}
                            </TableCell>
                        </TableRow>
                        ))
                    )}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
        </TabsContent>

{/* --- TAB 2: REQUESTS --- */}
        <TabsContent value="REQUESTS">
            <Card className="min-w-0 overflow-hidden border border-border shadow-sm">
                <CardContent className="p-0">
                    <Table dir="rtl">
                        <TableHeader className="bg-muted/40 h-10">
                            <TableRow>
                                <TableHead className="w-[220px] text-right font-medium text-xs pr-4">بیمار</TableHead>
                                <TableHead className="text-right font-medium text-xs">شرح مشکل</TableHead>
                                <TableHead className="text-center font-medium text-xs w-[140px]">زمان ترجیحی</TableHead>
                                <TableHead className="text-left font-medium text-xs pl-4 w-[180px]">اقدامات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-40 text-center">
                                        <div className="flex flex-col justify-center items-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            <span className="text-xs">در حال بارگذاری...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : requests.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-40 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground opacity-60">
                                            <ClipboardList className="h-8 w-8" />
                                            <p className="text-xs">درخواست جدیدی یافت نشد.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                requests.map((req) => {
                                    const state = requestStates[req.db_id] || 'PENDING';
                                    const isLoading = state === 'ACCEPTING' || state === 'REJECTING';
                                    const isHandled = state === 'ACCEPTED' || state === 'REJECTED';

                                    return (
                                        <TableRow 
                                            key={req.id} 
                                            className={cn(
                                                "transition-colors h-14", // Fixed minimum height for consistency
                                                isHandled ? "bg-muted/40 hover:bg-muted/40 opacity-50 grayscale" : "hover:bg-muted/5"
                                            )}
                                        >
                                            {/* Patient Identity */}
                                            <TableCell className="py-2 pr-4 align-middle">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 border border-border/50">
                                                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                                                            {req.name.slice(0, 1)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-sm font-medium leading-none">{req.name}</span>
                                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                            <span dir="ltr" className="font-mono">{req.phone}</span>
                                                            <span className="w-1 h-1 rounded-full bg-border" />
                                                            <span>{new Date(req.date).toLocaleDateString('fa-IR')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* Clinical Info (Single line with truncation) */}
                                            <TableCell className="py-2 align-middle max-w-[300px]">
                                                <div className="flex flex-col gap-1">
                                                    <p className="text-sm text-foreground truncate" title={req.request_data?.main_concern}>
                                                        {req.request_data?.main_concern || <span className="text-muted-foreground italic text-xs">بدون توضیح</span>}
                                                    </p>
                                                    {req.request_data?.history_brief && (
                                                        <p className="text-[11px] text-muted-foreground truncate" title={req.request_data.history_brief}>
                                                            <span className="opacity-70">سابقه: </span>
                                                            {req.request_data.history_brief}
                                                        </p>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Timing */}
                                            <TableCell className="py-2 align-middle text-center">
                                                {req.request_data?.preferred_time ? (
                                                    <Badge variant="secondary" className="font-normal text-[11px] px-2 h-6 border-border/50 bg-background text-foreground/80">
                                                        {req.request_data.preferred_time}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-[10px]">-</span>
                                                )}
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell className="py-2 pl-4 align-middle">
                                                <div className="flex justify-end items-center h-full">
                                                    {isHandled ? (
                                                        <div className={cn(
                                                            "flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium border w-full justify-center",
                                                            state === 'ACCEPTED' 
                                                                ? "bg-emerald-50 text-emerald-600 border-emerald-200" 
                                                                : "bg-red-50 text-red-600 border-red-200"
                                                        )}>
                                                            {state === 'ACCEPTED' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                                            {state === 'ACCEPTED' ? 'تایید شد' : 'رد شد'}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 w-full">
                                                            <Button 
                                                                size="sm" 
                                                                className="h-8 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-none"
                                                                onClick={() => handleRespond(req.db_id, 'ACCEPT')}
                                                                disabled={isLoading}
                                                            >
                                                                {state === 'ACCEPTING' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "تایید"}
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="h-8 px-3 text-xs border-border hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30"
                                                                onClick={() => handleRespond(req.db_id, 'REJECT')}
                                                                disabled={isLoading}
                                                            >
                                                                {state === 'REJECTING' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "رد"}
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PatientsPage() {
  return (
    // Only allow 'doctor' to see this
    <RoleGuard allowedRoles={['doctor']}>
      <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>}>
          <PatientsContent />
      </Suspense>
    </RoleGuard>
  );
}

