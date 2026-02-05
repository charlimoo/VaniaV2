"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, KeyRound, ArrowRight } from "lucide-react" 
import { useUser } from "@/hooks/use-user"
import { API_BASE_URL } from "@/lib/api"
import { OnboardingForm } from "@/components/auth/onboarding-form"
import { getSmartRedirectPath } from "@/lib/redirect-utils" 
import { APP_CONFIG } from "@/lib/config";

type AuthStep = "PHONE" | "OTP" | "PASSWORD" | "ONBOARDING"

interface AuthFormProps extends React.ComponentProps<"div"> {
  /**
   * Callback triggered when authentication is successful.
   * If provided, the form behaves as a Modal (closes instead of redirecting).
   * If not provided, the form behaves as a Page (redirects to dashboard).
   */
  onSuccess?: () => void;
}

export function AuthForm({ className, onSuccess, ...props }: AuthFormProps) {
  const router = useRouter()
  const { refreshUser } = useUser()
  
  const [step, setStep] = React.useState<AuthStep>("PHONE")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [phoneNumber, setPhoneNumber] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [otpCode, setOtpCode] = React.useState("")

  // --- ACTIONS ---

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/request-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneNumber }),
      })

      if (!res.ok) throw new Error("ارسال کد تایید با خطا مواجه شد.")
      setStep("OTP")
    } catch (err: any) {
      setError(err.message || "مشکلی پیش آمده است")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phoneNumber,
          otp_code: otpCode,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error("کد تایید نامعتبر است.")

      // 1. Store Token
      localStorage.setItem("accessToken", data.access)
      if (data.refresh) localStorage.setItem("refreshToken", data.refresh)

      // 2. Wait for storage
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 3. Refresh Global State
      const result = await refreshUser()
      if (!result.success) throw new Error(result.error || "بارگذاری پروفایل انجام نشد")

      // 4. Handle Success Callback (Modal Mode)
      if (onSuccess) {
        onSuccess();
        return;
      }

      // 5. Decision: Onboarding vs Smart Redirect (Page Mode)
      if (data.user_created) {
        setStep("ONBOARDING")
      } else {
        const destination = await getSmartRedirectPath(data.access)
        router.push(destination)
      }

    } catch (err: any) {
      setError(err.message || "تایید هویت انجام نشد")
      if (err.message?.includes("OTP") || err.message?.includes("Invalid")) {
         localStorage.removeItem("accessToken")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phoneNumber,
          password: password,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.detail || "اطلاعات ورود نامعتبر است.")

      // Store & Redirect
      localStorage.setItem("accessToken", data.access)
      if (data.refresh) localStorage.setItem("refreshToken", data.refresh)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      await refreshUser()
      
      if (onSuccess) {
        onSuccess();
        return;
      }

      const destination = await getSmartRedirectPath(data.access)
      router.push(destination)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Post-Onboarding Redirect
  const handleOnboardingComplete = async () => {
    if (onSuccess) {
        onSuccess();
        return;
    }

    const token = localStorage.getItem("accessToken")
    if (token) {
        const destination = await getSmartRedirectPath(token)
        router.push(destination)
    } else {
        router.push("/dashboard")
    }
  }

  // --- RENDER HELPERS (Forms) ---

  const renderPhoneStep = () => (
    <form onSubmit={handleRequestOtp} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">خوش آمدید</h1>
        <p className="text-muted-foreground text-sm">
          برای ورود یا ثبت‌نام شماره موبایل خود را وارد کنید.
        </p>
      </div>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="phone">شماره موبایل</Label>
          {/* RTL Adjustment: Phone numbers should be LTR */}
          <Input
            id="phone"
            type="tel"
            placeholder="09123456789"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
            autoFocus
            className="ltr text-left" 
          />
        </div>
        
        {error && <div className="text-sm text-red-500 text-center">{error}</div>}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "ادامه با کد تایید"}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">یا</span>
          </div>
        </div>

        <Button 
          type="button" 
          variant="outline" 
          className="w-full gap-2"
          onClick={() => { setError(null); setStep("PASSWORD"); }}
        >
          <KeyRound className="h-4 w-4" /> ورود با رمز عبور
        </Button>
      </div>
    </form>
  )

  const renderOtpStep = () => (
    <form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">تایید حساب کاربری</h1>
        <p className="text-muted-foreground text-sm">
          کد ارسال شده به {phoneNumber} را وارد کنید
        </p>
      </div>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="otp">کد یکبار مصرف</Label>
          <Input
            id="otp"
            type="text"
            placeholder="123456"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            required
            autoFocus
            className="text-center text-lg tracking-widest ltr"
          />
        </div>

        {error && <div className="text-sm text-red-500 text-center">{error}</div>}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "تایید و ورود"}
        </Button>

        <Button 
          type="button" 
          variant="ghost" 
          className="w-full"
          onClick={() => { setStep("PHONE"); setError(null); }}
        >
          تغییر شماره موبایل
        </Button>
      </div>
    </form>
  )

  const renderPasswordStep = () => (
    <form onSubmit={handlePasswordLogin} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">ورود</h1>
        <p className="text-muted-foreground text-sm">
          شماره موبایل و رمز عبور خود را وارد کنید.
        </p>
      </div>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="phone_login">شماره موبایل</Label>
          <Input
            id="phone_login"
            type="tel"
            placeholder="+989123456789"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
            autoFocus
            className="ltr text-left"
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center">
            <Label htmlFor="password_login">رمز عبور</Label>

          </div>
          <Input
            id="password_login"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="ltr text-left"
          />
        </div>

        {error && <div className="text-sm text-red-500 text-center">{error}</div>}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "ورود"}
        </Button>

        <Button 
          type="button" 
          variant="ghost" 
          className="w-full gap-2"
          onClick={() => { setError(null); setStep("PHONE"); }}
        >
          <ArrowRight className="h-4 w-4" /> بازگشت به کد تایید
        </Button>
      </div>
    </form>
  )

  // --- RENDER HELPERS (Layout Parts) ---

  const renderFormContent = () => (
    <div className="flex flex-col justify-center p-6 md:p-12 bg-background relative overflow-hidden h-full">
      {/* Subtle background texture */}
      <div className="absolute inset-0 bg-dot-pattern opacity-[0.03] pointer-events-none" />
      
      <div className="relative z-10 max-w-[380px] mx-auto w-full">
        {step === "PHONE" && renderPhoneStep()}
        {step === "OTP" && renderOtpStep()}
        {step === "PASSWORD" && renderPasswordStep()}
        {step === "ONBOARDING" && (
          <OnboardingForm onComplete={handleOnboardingComplete} />
        )}
      </div>
    </div>
  )

  const renderImageSide = () => (
    <div className="relative hidden md:block bg-muted overflow-hidden group h-full">
      <img
        src={APP_CONFIG.IMAGES.AUTH_BACKGROUND}
        alt="Authentication"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Floating "Trust" Card - Adds depth */}
      <div className="absolute bottom-10 start-10 end-10 z-20">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl shadow-2xl">
          <div className="text-white mb-2">
            <h3 className="text-2xl font-bold tracking-tight">{APP_CONFIG.BRANDING.APP_NAME}</h3>
            <p className="text-sm text-white/80 font-medium">{APP_CONFIG.BRANDING.APP_TAGLINE}</p>
          </div>
        </div>
      </div>
    </div>
  )

  // --- MAIN RENDER ---

  const isModal = !!onSuccess;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0 border-none shadow-xl">
        {isModal ? (
          // MODAL LAYOUT: Single Column, Compact
          <CardContent className="p-0">
            {renderFormContent()}
          </CardContent>
        ) : (
          // FULL PAGE LAYOUT: Two Columns with Image
          <CardContent className="grid p-0 md:grid-cols-2 min-h-[600px]">
            {renderFormContent()}
            {renderImageSide()}
          </CardContent>
        )}
      </Card>
    </div>
  )
}