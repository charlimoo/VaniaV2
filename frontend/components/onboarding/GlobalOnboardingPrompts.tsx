"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, BriefcaseBusiness, Download, EllipsisVertical, PlusSquare, Share, Smartphone, UserRoundCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useUser } from "@/hooks/use-user";
import { APP_CONFIG } from "@/lib/config";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import {
  LOGIN_PWA_PROMPT_KEY,
  PROFILE_PROMPT_SESSION_KEY,
  PROFILE_PROMPT_SHOWN_KEY,
  PWA_DISMISSED_KEY,
  SIGNUP_PROFILE_PROMPT_KEY,
} from "@/lib/onboarding-prompts";
import { hasExpertFeatures, hasVisitorFeatures } from "@/lib/roles";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PROFILE_PROMPT_TTL_MS = 12 * 60 * 60 * 1000;

type ProfilePromptReason = "account" | "visitor" | "expert";

type ProfileCompletionStatus = {
  isComplete: boolean;
  reasons: ProfilePromptReason[];
};

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
};

const isMobileOrTablet = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1024px), (pointer: coarse)").matches;
};

const isIosSafari = () => {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isWebKit = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isWebKit;
};

const wasRecentlyDismissed = () => {
  if (typeof window === "undefined") return true;
  const dismissedAt = Number(localStorage.getItem(PWA_DISMISSED_KEY) || "0");
  return dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_TTL_MS;
};

const hasMeaningfulValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "boolean") return true;
  return Boolean(value);
};

const hasProfileSentence = (value: unknown) => {
  if (typeof value !== "string") return false;
  const text = value.trim().replace(/\s+/g, " ");
  return text.length >= 10 && text.split(" ").length >= 2;
};

const hasAnyMeaningfulField = (data: Record<string, unknown>, fields: string[]) =>
  fields.some((field) => hasMeaningfulValue(data[field]));

const wasProfilePromptShownRecently = () => {
  if (typeof window === "undefined") return true;
  const shownAt = Number(localStorage.getItem(PROFILE_PROMPT_SHOWN_KEY) || "0");
  return shownAt > 0 && Date.now() - shownAt < PROFILE_PROMPT_TTL_MS;
};

const markProfilePromptShown = () => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PROFILE_PROMPT_SESSION_KEY, "1");
  localStorage.setItem(PROFILE_PROMPT_SHOWN_KEY, String(Date.now()));
};

async function resolveProfileCompletionStatus(user: any): Promise<ProfileCompletionStatus> {
  const reasons: ProfilePromptReason[] = [];
  const userHasVisitorFeatures = hasVisitorFeatures(user);
  const userHasExpertFeatures = hasExpertFeatures(user);

  if (!hasMeaningfulValue(user?.full_name)) {
    reasons.push("account");
  }

  if (userHasVisitorFeatures) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/my-base-profile/`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const payload = await res.json().catch(() => null);
        const data = (payload?.data || {}) as Record<string, unknown>;
        const hasBaseIdentity = hasMeaningfulValue(data.full_name) && hasMeaningfulValue(data.mobile_phone);
        const hasPersonalContext = hasAnyMeaningfulField(data, [
          "gender",
          "birth_date",
          "marital_status",
          "education_level",
          "education_major",
          "job_status",
          "job_title",
          "address_home",
          "preferred_contact_method",
          "referral_source",
          "family_history",
        ]);
        if (!hasBaseIdentity || !hasPersonalContext) {
          reasons.push("visitor");
        }
      } else {
        reasons.push("visitor");
      }
    } catch {
      reasons.push("visitor");
    }
  }

  if (userHasExpertFeatures && user?.is_expert_verified) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/my-profile/`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const hasPublicProfile =
          hasMeaningfulValue(data.specialty) &&
          hasProfileSentence(data.bio) &&
          hasMeaningfulValue(data.clinic_address) &&
          hasMeaningfulValue(data.location_id);
        if (!hasPublicProfile) {
          reasons.push("expert");
        }
      } else {
        reasons.push("expert");
      }
    } catch {
      reasons.push("expert");
    }
  }

  return {
    isComplete: reasons.length === 0,
    reasons: Array.from(new Set(reasons)),
  };
}

export function GlobalOnboardingPrompts() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileReasons, setProfileReasons] = useState<ProfilePromptReason[]>([]);
  const [pwaOpen, setPwaOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIosGuide, setIsIosGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (loading || !user || typeof window === "undefined") return;

    const hasSignupPrompt = sessionStorage.getItem(SIGNUP_PROFILE_PROMPT_KEY) === "1";
    if (hasSignupPrompt) {
      sessionStorage.removeItem(SIGNUP_PROFILE_PROMPT_KEY);
      sessionStorage.removeItem(LOGIN_PWA_PROMPT_KEY);
      resolveProfileCompletionStatus(user).then((status) => {
        if (!status.isComplete) {
          setProfileReasons(status.reasons);
          markProfilePromptShown();
          setProfileOpen(true);
        }
      });
      return;
    }

    const hasPwaPrompt = sessionStorage.getItem(LOGIN_PWA_PROMPT_KEY) === "1";
    const shownInSession = sessionStorage.getItem(PROFILE_PROMPT_SESSION_KEY) === "1";
    const shouldCheckProfilePrompt = !shownInSession && (hasPwaPrompt || !wasProfilePromptShownRecently());
    if (shouldCheckProfilePrompt) {
      resolveProfileCompletionStatus(user).then((status) => {
        if (!status.isComplete) {
          setProfileReasons(status.reasons);
          markProfilePromptShown();
          setProfileOpen(true);
        }
      });
      return;
    }

    if (!hasPwaPrompt || isStandalone() || !isMobileOrTablet() || wasRecentlyDismissed()) return;

    const shouldShowGuide = Boolean(installPrompt) || isIosSafari();
    if (!shouldShowGuide) return;

    sessionStorage.removeItem(LOGIN_PWA_PROMPT_KEY);
    setIsIosGuide(isIosSafari() && !installPrompt);
    setPwaOpen(true);
  }, [installPrompt, loading, user]);

  const showAccountReason = profileReasons.includes("account");
  const showVisitorReason = profileReasons.includes("visitor");
  const showExpertReason = profileReasons.includes("expert");

  const pwaDescription = useMemo(() => {
    if (isIosGuide) return "برای دسترسی سریع‌تر، وانیا را به صفحه اصلی آیفون اضافه کنید.";
    return "وانیا را مثل یک اپ روی گوشی باز کنید؛ سریع‌تر، تمام‌صفحه و همیشه دم دست.";
  }, [isIosGuide]);

  const closePwa = (open: boolean) => {
    setPwaOpen(open);
    if (!open && typeof window !== "undefined") {
      localStorage.setItem(PWA_DISMISSED_KEY, String(Date.now()));
    }
  };

  const installPwa = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
    closePwa(false);
  };

  return (
    <>
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader className="text-right">
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRoundCog className="size-5" />
            </div>
            <DialogTitle>پروفایل را کامل کن</DialogTitle>
            <DialogDescription>
              برای اینکه دستیارها، بوم‌ها و ارتباط با متخصصان با اطلاعات درست کار کنند، این بخش‌های پروفایل را تکمیل کنید.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {(showAccountReason || profileReasons.length === 0) && (
              <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground">ویرایش پروفایل عمومی</p>
                  <p className="text-xs leading-6 text-muted-foreground">نام و نام خانوادگی و ایمیل حساب را در بخش اطلاعات کاربری تنظیم کنید.</p>
                </div>
              </div>
            )}
            {(showVisitorReason || profileReasons.length === 0) && (
              <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
                <Smartphone className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground">پروفایل پایه مراجع</p>
                  <p className="text-xs leading-6 text-muted-foreground">
                    اطلاعات هویتی، تماس، وضعیت فردی، تحصیلی و شغلی را تکمیل کنید تا پاسخ‌ها و بوم همکاری دقیق‌تر شوند.
                  </p>
                </div>
              </div>
            )}
            {showExpertReason && (
              <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
                <BriefcaseBusiness className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground">ویرایش پروفایل عمومی متخصص</p>
                  <p className="text-xs leading-6 text-muted-foreground">
                    تخصص اصلی، استان یا شهر، آدرس دقیق مطب و حداقل یک جمله درباره خودتان را ثبت کنید. افزودن تصویر هم به اعتماد و جذب مخاطب کمک می‌کند.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setProfileOpen(false)}>
              بعدا
            </Button>
            <Button
              onClick={() => {
                setProfileOpen(false);
                router.push("/dashboard/settings");
              }}
            >
              رفتن به تنظیمات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={pwaOpen} onOpenChange={closePwa}>
        <SheetContent side="bottom" dir="rtl" className="min-h-[470px] rounded-t-3xl px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-6 sm:min-h-[520px]">
          <SheetHeader className="p-0 text-right">
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Download className="size-5" />
            </div>
            <SheetTitle>نصب {APP_CONFIG.BRANDING.APP_NAME}</SheetTitle>
            <SheetDescription>{pwaDescription}</SheetDescription>
          </SheetHeader>

          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                {isIosGuide ? "راهنمای نصب در iPhone / iPad" : "راهنمای نصب در Android / Chrome"}
              </p>
              <div className="space-y-2">
                {isIosGuide ? (
                  <>
                    <div className="flex gap-3 rounded-md bg-background/60 p-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Share className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">۱. Safari را باز نگه دارید</p>
                        <p className="text-xs leading-6 text-muted-foreground">از پایین صفحه روی دکمه Share بزنید.</p>
                      </div>
                    </div>
                    <div className="flex gap-3 rounded-md bg-background/60 p-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <PlusSquare className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">۲. Add to Home Screen</p>
                        <p className="text-xs leading-6 text-muted-foreground">این گزینه را انتخاب کنید و سپس Add را بزنید.</p>
                      </div>
                    </div>
                    <div className="flex gap-3 rounded-md bg-background/60 p-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Smartphone className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">۳. از صفحه اصلی وارد شوید</p>
                        <p className="text-xs leading-6 text-muted-foreground">آیکن وانیا کنار اپ‌های شما قرار می‌گیرد.</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex gap-3 rounded-md bg-background/60 p-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Download className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">۱. نصب برنامه را بزنید</p>
                        <p className="text-xs leading-6 text-muted-foreground">اگر پیام نصب Chrome نمایش داده شد، Install را تایید کنید.</p>
                      </div>
                    </div>
                    <div className="flex gap-3 rounded-md bg-background/60 p-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <EllipsisVertical className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">۲. اگر دکمه نصب نبود</p>
                        <p className="text-xs leading-6 text-muted-foreground">از منوی سه‌نقطه Chrome گزینه Add to Home screen را انتخاب کنید.</p>
                      </div>
                    </div>
                    <div className="flex gap-3 rounded-md bg-background/60 p-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Smartphone className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">۳. وانیا را مثل اپ باز کنید</p>
                        <p className="text-xs leading-6 text-muted-foreground">آیکن وانیا روی صفحه اصلی اضافه می‌شود.</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <SheetFooter className="p-0">
            {installPrompt ? (
              <Button className="h-11 w-full" onClick={installPwa}>
                نصب برنامه
              </Button>
            ) : null}
            <Button variant="outline" className="h-11 w-full" onClick={() => closePwa(false)}>
              بعدا
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
