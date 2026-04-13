"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { useUser } from "@/hooks/use-user"
import { API_BASE_URL, checkUserExistence } from "@/lib/api"
import { extractErrorMessage } from "@/lib/error-utils"
import { StepPhone, StepOtp, StepPassword, StepRegistration } from "./auth-steps"
import Link from "next/link"
import { getNormalizedValidPhoneOrNull, normalizePhoneNumberInput } from "@/lib/phone"
import { GuideModal } from "@/components/guide/GuideModal"

type AuthStage = "PHONE" | "REGISTRATION" | "OTP" | "PASSWORD"

export function AuthContainer() {
  const router = useRouter()
  const { refreshUser, user, loading: userLoading } = useUser()
  
  const [stage, setStage] = useState<AuthStage>("PHONE")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [signupData, setSignupData] = useState<any>(null) // Stores reg data between steps
  const [signupError, setSignupError] = useState<string | null>(null)

  // If user is already logged in, redirect
  useEffect(() => {
    if (!userLoading && user) {
      router.replace("/dashboard")
    }
  }, [user, userLoading, router])

  // --- ACTIONS ---

  // 1. Phone Submit -> Check Existence
  const handlePhoneSubmit = async (phone: string) => {
    const normalizedPhone = getNormalizedValidPhoneOrNull(phone)
    if (!normalizedPhone) {
      toast.error("شماره موبایل باید با فرمت 09123456789 باشد")
      return
    }
    setIsLoading(true)
    try {
      const { exists } = await checkUserExistence(normalizedPhone)
      setPhoneNumber(normalizedPhone)
      setSignupError(null)
      
      if (exists) {
        // User exists -> Trigger OTP for Login
        await requestOtp(normalizedPhone)
        // Stage set inside requestOtp
      } else {
        // New User -> Go to Registration Form
        setStage("REGISTRATION")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در بررسی وضعیت حساب کاربری")
    } finally {
      setIsLoading(false)
    }
  }

  // 2. Registration Submit -> Request OTP
  const handleRegistrationSubmit = async (data: any) => {
    setSignupError(null)
    setSignupData(data) // Save for later
    await requestOtp(phoneNumber)
  }

  // 3. Request OTP API
  const requestOtp = async (phone: string) => {
    const normalizedPhone = normalizePhoneNumberInput(phone)
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/request-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: normalizedPhone }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(extractErrorMessage(data, "خطا در ارسال کد"))
      
      setStage("OTP")
      toast.success("کد تایید ارسال شد")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ارسال کد با خطا مواجه شد.")
    } finally {
      setIsLoading(false)
    }
  }

  // 4. Verify OTP (Login or Signup Finalization)
  const verifyOtp = async (otp: string) => {
    setIsLoading(true)
    try {
      // If we have signupData, it means we are in the Register flow
      const payload: any = { 
        phone_number: phoneNumber, 
        otp_code: otp,
      }
      
      if (signupData) {
        payload.signup_data = signupData;
      }

      const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      
      const data = await res.json().catch(() => null)
      
      if (!res.ok) {
        if (signupData && data?.signup_data) {
          setSignupError(extractErrorMessage(data.signup_data, "اطلاعات ثبت‌نام معتبر نیست."))
          setStage("REGISTRATION")
        }
        throw new Error(extractErrorMessage(data, "کد تایید نامعتبر است"))
      }

      // Success
      localStorage.setItem("accessToken", data.access)
      if (data.refresh) localStorage.setItem("refreshToken", data.refresh)

      await refreshUser()

      toast.success("ورود موفقیت‌آمیز")
      
      router.push("/dashboard")

    } catch (e: any) {
      toast.error(e?.message || "خطا در اعتبار سنجی")
    } finally {
      setIsLoading(false)
    }
  }

  // 5. Password Login (Alternative for Existing Users)
  const handlePasswordLogin = async (password: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneNumber, password }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(extractErrorMessage(data, "رمز عبور اشتباه است"))

      localStorage.setItem("accessToken", data.access)
      if (data.refresh) localStorage.setItem("refreshToken", data.refresh)
      
      await refreshUser()
      router.push("/dashboard")
      toast.success("ورود موفقیت‌آمیز")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (userLoading) return null

  return (
    <div className="w-full max-w-[420px] mx-auto p-4">
      <motion.div 
        layout
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className="glass-panel rounded-[2rem] p-8 relative overflow-hidden bg-background/60 backdrop-blur-md border border-white/10 shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
        
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full"
          >
            {stage === "PHONE" && (
              <StepPhone onSubmit={handlePhoneSubmit} isLoading={isLoading} />
            )}
            
            {stage === "REGISTRATION" && (
              <StepRegistration 
                phoneNumber={phoneNumber} 
                onSubmit={handleRegistrationSubmit} 
                isLoading={isLoading}
                initialValues={signupData ?? undefined}
                serverError={signupError}
              />
            )}

            {stage === "OTP" && (
              <StepOtp 
                phoneNumber={phoneNumber} 
                onBack={() => {
                  setSignupData(null)
                  setSignupError(null)
                  setStage("PHONE")
                }} 
                // Only show Password login option if NOT signing up
                onPasswordLogin={!signupData ? () => setStage("PASSWORD") : undefined}
                onSubmit={verifyOtp} 
                isLoading={isLoading} 
              />
            )}

            {stage === "PASSWORD" && (
              <StepPassword 
                onSubmit={handlePasswordLogin} 
                onBack={() => setStage("OTP")} 
                isLoading={isLoading} 
              />
            )}
          </motion.div>
        </AnimatePresence>

        <motion.div 
          layout 
          className="mt-8 pt-6 border-t border-white/5 flex justify-center items-center gap-4 text-[11px] font-medium text-zinc-500"
        >
          <Link href="/terms" className="hover:text-zinc-300 transition-colors">قوانین و مقررات</Link>
          <div className="w-px h-3 bg-zinc-800" />
          <Link href="/support" className="hover:text-zinc-300 transition-colors">پشتیبانی</Link>
          <div className="w-px h-3 bg-zinc-800" />
          <GuideModal
            triggerMode="text"
            triggerLabel="راهنما"
            triggerClassName="text-[11px] font-medium text-zinc-500 hover:text-zinc-300"
          />
        </motion.div>
      </motion.div>
    </div>
  )
}
