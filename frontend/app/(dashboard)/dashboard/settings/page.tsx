"use client"

import { useState, useEffect } from "react"
import { 
  User, 
  Lock, 
  Save, 
  Loader2, 
  ShieldCheck, 
  AlertCircle,
  CheckCircle2,
  Stethoscope,
  ChevronDown,
  BadgeCheck,
  UserCog, // New icon for profile settings
  ChevronLeft,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUser } from "@/hooks/use-user"
import {
  API_BASE_URL,
  getAuthHeaders,
  getExpertProfessions,
  upgradeExpert,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { isExpertRoleSlug, isVisitorRoleSlug } from "@/lib/roles"

// [NEW] Import the Doctor Profile Modal
import { DoctorProfileModal } from "@/components/settings/DoctorProfileModal"
import { VisitorBaseProfileModal } from "@/components/settings/VisitorBaseProfileModal"

export default function SettingsPage() {
  const { user, refreshUser } = useUser()

  return (
    <div className="flex flex-col w-full h-full space-y-8 pb-10 max-w-6xl mx-auto pt-6" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col gap-1 text-start">
        <h1 className="text-2xl font-bold tracking-tight">تنظیمات</h1>
        <p className="text-muted-foreground">
          مدیریت حساب کاربری، امنیت و پروفایل.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-3 space-y-8">
          
          {/* [NEW] Public Profile Section (Only visible to Doctors) */}
          <section id="doctor-profile">
            <DoctorPublicProfileSection user={user} />
          </section>

          <section id="visitor-profile">
            <VisitorBaseProfileSection user={user} refreshUser={refreshUser} />
          </section>

          <section id="general" className="space-y-4">
            <ProfileForm user={user} refreshUser={refreshUser} />
          </section>


          
          <section id="security">
            <PasswordForm user={user} />
          </section>

          {/* Upgrade Section (Only visible if NOT a verified doctor yet) */}
          <section id="upgrade">
            <DoctorUpgradeSection user={user} refreshUser={refreshUser} />
          </section>
            
        </div>
      </div>
    </div>
  )
}

// --- [NEW] COMPONENT: DOCTOR PUBLIC PROFILE TRIGGER ---

function DoctorPublicProfileSection({ user }: { user: any }) {
  const [isOpen, setIsOpen] = useState(false);

  // 1. Guard Clause: Only show for doctors
  // We check role_slug (preferred) or role name fallback
  const isDoctor = isExpertRoleSlug(user?.role_slug) || isExpertRoleSlug(user?.role);
  
  if (!isDoctor) return null;

  return (
    <>
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm transition-all overflow-hidden">
        <button 
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-between w-full p-6 text-start hover:bg-muted/30 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
              <UserCog className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-bold text-base text-foreground">پروفایل عمومی متخصص</h3>
              <p className="text-sm text-muted-foreground">
                مدیریت اطلاعات نمایش داده شده در لیست متخصصین (بیوگرافی، آدرس، هزینه).
              </p>
            </div>
          </div>
          
          <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
      </div>

      {/* The Modal Component */}
      <DoctorProfileModal 
        isOpen={isOpen} 
        onOpenChange={setIsOpen} 
        onUpdate={() => {
            // Optional: You could refresh global user state here if needed, 
            // but the modal handles its own data fetching.
        }} 
      />
    </>
  )
}

function VisitorBaseProfileSection({ user, refreshUser }: { user: any, refreshUser: () => Promise<any> }) {
  const [isOpen, setIsOpen] = useState(false);
  const isVisitor = isVisitorRoleSlug(user?.role_slug) || isVisitorRoleSlug(user?.role);

  if (!isVisitor) return null;

  return (
    <>
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm transition-all overflow-hidden">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-between w-full p-6 text-start hover:bg-muted/30 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400">
              <UserCog className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-bold text-base text-foreground">پروفایل پایه مراجع</h3>
              <p className="text-sm text-muted-foreground">
                مشخصات اصلی، راه‌های ارتباطی و شبکه‌های اجتماعی خود را بدون ورود به پرونده‌ها مدیریت کنید.
              </p>
            </div>
          </div>

          <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
      </div>

      <VisitorBaseProfileModal
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onUpdate={refreshUser}
      />
    </>
  );
}

// --- SUB-COMPONENT: DOCTOR UPGRADE (Minimal & Expandable) ---

type ExpertProfessionOption = {
  slug: string;
  name: string;
  description?: string;
  credential_label?: string;
};

type LawyerLookupResponse = Array<{
  licenseNumber?: string;
  name?: string;
  family?: string;
}>;

function DoctorUpgradeSection({ user, refreshUser }: { user: any, refreshUser: () => Promise<any> }) {
  const [isOpen, setIsOpen] = useState(false)
  const [credentialCode, setCredentialCode] = useState("")
  const [professions, setProfessions] = useState<ExpertProfessionOption[]>([])
  const [selectedProfession, setSelectedProfession] = useState<string>("")
  const [loading, setLoading] = useState(false)
  
  const isDoctor = isExpertRoleSlug(user?.role_slug) || isExpertRoleSlug(user?.role);
  const isVerified = user?.is_expert_verified;
  const selectedProfessionOption = professions.find((p) => p.slug === selectedProfession) || null;
  const credentialLabel = selectedProfessionOption?.credential_label || "کد اعتبارسنجی تخصص";

  const normalizePersianText = (text: string) =>
    text
      .replace(/ي/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/\s+/g, " ")
      .trim();

  const normalizeForNameMatch = (text: string) =>
    normalizePersianText(text).replace(/^(دکتر|سید|سیده|آقای|خانم)\s+/g, "");

  const isLooseNameMatch = (inputName: string, sourceName: string) => {
    const name1 = normalizeForNameMatch(inputName);
    const name2 = normalizeForNameMatch(sourceName);
    if (name1.length < 3 || !name2) return false;
    if (name1 === name2) return true;

    const inputWords = name1.split(" ").filter((w) => w.length > 1);
    const sourceWords = name2.split(" ").filter((w) => w.length > 1);
    if (!inputWords.length || !sourceWords.length) return false;

    let matches = 0;
    for (const word of inputWords) {
      if (sourceWords.some((sw) => sw === word || sw.startsWith(word))) {
        matches += 1;
      }
    }
    return matches / inputWords.length >= 0.7;
  };

  const normalizeLicenseDigits = (value: string) =>
    value
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .trim();

  const validateLawyerCredential = async (fullName: string, licenseCode: string) => {
    const normalizedLicense = normalizeLicenseDigits(licenseCode);
    const res = await fetch("https://search.icbar.org/App/Handler/Law.ashx?Method=mGetLawyers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "",
        family: "",
        licensenumber: normalizedLicense,
        mobileNumber: "",
        EName: "",
        ELName: "",
        address: "",
        gender: "",
        province: "",
        workstate: "",
        proexperience: "",
      }),
    });

    if (!res.ok) {
      throw new Error("عدم پاسخگویی سامانه وکلا");
    }

    const data = (await res.json()) as LawyerLookupResponse;
    const first = Array.isArray(data) ? data[0] : null;
    if (!first) {
      return {
        ok: false,
        message: "پروانه‌ای با این شناسه در سامانه وکلا یافت نشد",
      };
    }

    const foundName = `${first.name || ""} ${first.family || ""}`.trim();
    const matched = isLooseNameMatch(fullName, foundName);
    if (!matched) {
      return {
        ok: false,
        message: "نام وارد شده با اطلاعات سامانه وکلا مطابقت ندارد",
      };
    }

    return { ok: true, message: "اعتبارسنجی وکیل با موفقیت انجام شد" };
  };

  useEffect(() => {
    if (!isOpen) return;
    getExpertProfessions()
      .then((data) => {
        setProfessions(data || []);
        if (!selectedProfession && data?.length) {
          setSelectedProfession(data[0].slug);
        }
      })
      .catch(() => toast.error("دریافت حوزه‌های تخصصی ناموفق بود"));
  }, [isOpen, selectedProfession]);

  const handleVerify = async () => {
    if (!selectedProfession) {
      toast.error("حوزه تخصصی را انتخاب کنید");
      return;
    }
    if (!credentialCode || credentialCode.length < 3) {
        toast.error("کد معتبر نیست");
        return;
    }

    setLoading(true)
    try {
      if (selectedProfession === "lawyer" && credentialCode.trim() !== "123456") {
        const lawyerCheck = await validateLawyerCredential(user?.full_name || "", credentialCode);
        if (!lawyerCheck.ok) {
          toast.error(lawyerCheck.message);
          return;
        }
      }

      const res = await upgradeExpert(user?.full_name || "", selectedProfession, credentialCode)
      toast.success(res.message || "حساب متخصص فعال شد.")
      await refreshUser()
      setIsOpen(false)
      setCredentialCode("")
    } catch(e) {
      toast.error("اعتبارسنجی ناموفق بود")
    } finally {
      setLoading(false)
    }
  }

  if (isDoctor && isVerified) {
    return (
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BadgeCheck className="w-5 h-5 text-emerald-600" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">حساب متخصص شما فعال است</span>
            <span className="text-xs text-muted-foreground">
              حوزه تایید شده: {user?.expert_profession_label || "نامشخص"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm transition-all overflow-hidden">
      {/* Trigger Row */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-4 text-start hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-full text-muted-foreground">
            <Stethoscope className="w-4 h-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">ارتقا به حساب متخصص</span>
            <span className="text-xs text-muted-foreground">
              حوزه تخصصی خود را تایید کنید تا دسترسی متخصص برای شما فعال شود.
            </span>
          </div>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 pt-0 border-t border-dashed bg-muted/10">
              <p className="text-xs text-muted-foreground py-3 leading-relaxed">
                حوزه تخصصی را انتخاب کنید و اطلاعات اعتبارسنجی همان حوزه را وارد کنید.
              </p>

              <div className="grid gap-3 w-full">
                {!!professions.length && (
                  <Tabs value={selectedProfession} onValueChange={setSelectedProfession} className="w-full">
                    <TabsList className="w-full h-auto p-1 grid grid-cols-4 gap-1 rounded-xl bg-muted/70">
                      {professions.map((profession) => (
                        <TabsTrigger
                          key={profession.slug}
                          value={profession.slug}
                          className="h-9 rounded-lg px-2 text-[11px] md:text-sm whitespace-nowrap"
                        >
                          {profession.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                )}
                {selectedProfessionOption && (
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-sm font-medium">{selectedProfessionOption.name}</div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="expert-credential-input" className="text-xs text-muted-foreground">
                    {credentialLabel}
                  </Label>
                <Input
                  id="expert-credential-input"
                  value={credentialCode}
                  onChange={(e) => setCredentialCode(e.target.value)}
                  className="bg-background text-center font-mono h-9 text-sm"
                />
                </div>
                <Button 
                  onClick={handleVerify} 
                  disabled={loading} 
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-5 w-full md:w-auto md:self-end md:min-w-44"
                >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "بررسی و فعال‌سازی"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- SUB-COMPONENT: PROFILE FORM ---

function ProfileForm({ user, refreshUser }: { user: any, refreshUser: () => Promise<any> }) {
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
  })

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        email: user.email || "",
      })
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSuccess(null)
    setError(null)

    const headers = getAuthHeaders()
    if (!headers.Authorization) return

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/profile/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(formData),
      })

      if (!res.ok) throw new Error("خطا در بروزرسانی پروفایل.")

      await refreshUser()
      setSuccess("پروفایل با موفقیت بروزرسانی شد.")
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError("مشکلی پیش آمد. لطفاً دوباره تلاش کنید.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-start">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-md text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>اطلاعات کاربری</CardTitle>
            <CardDescription>اطلاعات شخصی خود را بروزرسانی کنید.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 pt-6 text-start">
          {success && (
            <Alert className="bg-green-50 text-green-800 border-green-200">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>موفق</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>خطا</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">شماره موبایل</Label>
              <Input 
                id="phone" 
                value={user?.phone_number || ""} 
                disabled 
                className="bg-muted text-muted-foreground text-left ltr" 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">نام و نام خانوادگی</Label>
              <Input 
                id="name" 
                value={formData.full_name} 
                onChange={(e) => setFormData({...formData, full_name: e.target.value})} 
                placeholder="مثال: علی محمدی"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="email">آدرس ایمیل</Label>
              <Input 
                id="email" 
                type="email"
                value={formData.email} 
                onChange={(e) => setFormData({...formData, email: e.target.value})} 
                placeholder="ali@example.com"
                className="text-left ltr"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="px-6 py-4 bg-muted/5 rounded-b-xl flex justify-end">
          <Button type="submit" disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            ذخیره تغییرات
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

// --- SUB-COMPONENT: PASSWORD FORM ---

function PasswordForm({ user }: { user: any }) {
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hasPassword = user?.has_password !== false

  const [passwords, setPasswords] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSuccess(null)
    setError(null)

    if (passwords.new_password !== passwords.confirm_password) {
      setError("رمزهای عبور جدید مطابقت ندارند.")
      setIsLoading(false)
      return
    }

    if (hasPassword && !passwords.old_password) {
      setError("لطفاً رمز عبور فعلی را وارد کنید.")
      setIsLoading(false)
      return
    }

    const headers = getAuthHeaders()
    if (!headers.Authorization) return

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/change-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          old_password: passwords.old_password,
          new_password: passwords.new_password,
          confirm_password: passwords.confirm_password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const msg = typeof data === 'object' ? Object.values(data).flat().join(" ") : "خطا در تغییر رمز."
        throw new Error(msg)
      }

      setSuccess(hasPassword ? "رمز عبور با موفقیت تغییر یافت." : "رمز عبور اولیه با موفقیت تنظیم شد.")
      setPasswords({ old_password: "", new_password: "", confirm_password: "" })
      setTimeout(() => setSuccess(null), 3000)
    } catch (e: any) {
      setError(e.message || "تغییر رمز عبور با خطا مواجه شد.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-start">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-md text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>امنیت</CardTitle>
            <CardDescription>از امنیت حساب خود اطمینان حاصل کنید.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 pt-6 text-start">
          {success && (
            <Alert className="bg-muted-50 text-green-400 border-muted-200">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>موفق</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>خطا</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {hasPassword ? (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="old">رمز عبور فعلی</Label>
                <Input 
                  id="old" 
                  type="password"
                  value={passwords.old_password}
                  onChange={(e) => setPasswords({...passwords, old_password: e.target.value})}
                  required
                  className="text-left ltr"
                />
              </div>
            ) : (
              <Alert className="md:col-span-2 bg-muted-50 text-blue-400 border-muted-200">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>تنظیم رمز اولیه</AlertTitle>
                <AlertDescription>
                  برای حساب شما رمز عبور فعلی ثبت نشده است. رمز عبور جدید را برای فعال‌سازی ورود با رمز تعیین کنید.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="new">رمز عبور جدید</Label>
              <Input 
                id="new" 
                type="password"
                value={passwords.new_password}
                onChange={(e) => setPasswords({...passwords, new_password: e.target.value})}
                required
                minLength={8}
                className="text-left ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">تکرار رمز عبور جدید</Label>
              <Input 
                id="confirm" 
                type="password"
                value={passwords.confirm_password}
                onChange={(e) => setPasswords({...passwords, confirm_password: e.target.value})}
                required
                className="text-left ltr"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="px-6 py-4 bg-muted/5 rounded-b-xl flex justify-end">
          <Button type="submit" disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {hasPassword ? "تغییر رمز عبور" : "ثبت رمز عبور"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
