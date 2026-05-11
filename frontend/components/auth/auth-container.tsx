"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"

import { GuideModal } from "@/components/guide/GuideModal"
import { useUser } from "@/hooks/use-user"
import { API_BASE_URL } from "@/lib/api"
import { extractErrorMessage } from "@/lib/error-utils"
import { getSmartRedirectPath } from "@/lib/redirect-utils"
import { getNormalizedValidPhoneOrNull, toLatinDigits } from "@/lib/phone"
import { StepOtp, StepPassword, StepPhone, StepRegistration } from "./auth-steps"
import { markLoginPwaPromptPending, markSignupProfilePromptPending } from "@/lib/onboarding-prompts"

type AuthStage = "PHONE" | "OTP" | "PASSWORD" | "REGISTRATION"

type PendingSignup = {
  phoneNumber: string
  signupToken: string
  expiresAt: number
}

const PENDING_SIGNUP_STORAGE_KEY = "vania.pendingSignup"
const DEFAULT_SIGNUP_TOKEN_TTL_SECONDS = 15 * 60

interface AuthContainerProps {
  onAuthenticated?: () => void | Promise<void>
}

export function AuthContainer({ onAuthenticated }: AuthContainerProps = {}) {
  const router = useRouter()
  const { refreshUser, user, loading: userLoading } = useUser()

  const [stage, setStage] = useState<AuthStage>("PHONE")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [signupData, setSignupData] = useState<{ fullName?: string; email?: string; password?: string } | null>(null)
  const [signupError, setSignupError] = useState<string | null>(null)
  const [canUsePasswordLogin, setCanUsePasswordLogin] = useState(false)

  useEffect(() => {
    if (!userLoading && user && !onAuthenticated) {
      router.replace("/dashboard")
    }
  }, [user, userLoading, router, onAuthenticated])

  useEffect(() => {
    if (typeof window === "undefined") return
    const raw = sessionStorage.getItem(PENDING_SIGNUP_STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as PendingSignup
      if (!parsed.phoneNumber || !parsed.signupToken || !parsed.expiresAt || Date.now() >= parsed.expiresAt) {
        sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY)
        return
      }
      setPhoneNumber(parsed.phoneNumber)
      setPendingSignup(parsed)
      setCanUsePasswordLogin(false)
      setStage("REGISTRATION")
    } catch {
      sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY)
    }
  }, [])

  const finalizeAuth = async (accessToken: string) => {
    await refreshUser()
    toast.success("ورود موفقیت‌آمیز")
    if (onAuthenticated) {
      await onAuthenticated()
      return
    }
    const destination = await getSmartRedirectPath(accessToken)
    router.push(destination)
  }

  const persistPendingSignup = (next: PendingSignup | null) => {
    setPendingSignup(next)
    if (typeof window === "undefined") return
    if (next) {
      sessionStorage.setItem(PENDING_SIGNUP_STORAGE_KEY, JSON.stringify(next))
    } else {
      sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY)
    }
  }

  const sendOtp = async (phone: string) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/request-otp/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: phone, send_otp: true }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(extractErrorMessage(data, "ارسال کد با خطا مواجه شد."))
    }
    return data
  }

  const handlePhoneSubmit = async (phone: string) => {
    const normalizedPhone = getNormalizedValidPhoneOrNull(phone)
    if (!normalizedPhone) {
      toast.error("شماره موبایل باید با فرمت 09123456789 باشد")
      return
    }

    setIsLoading(true)
    setSignupError(null)
    setSignupData(null)
    setCanUsePasswordLogin(false)
    persistPendingSignup(null)

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/request-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: normalizedPhone, send_otp: false }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, "بررسی شماره موبایل انجام نشد."))
      }

      setPhoneNumber(normalizedPhone)
      if (data?.user_exists && data?.has_password) {
        setCanUsePasswordLogin(true)
        setStage("PASSWORD")
        return
      }

      setCanUsePasswordLogin(Boolean(data?.has_password))
      await sendOtp(normalizedPhone)
      setStage("OTP")
      toast.success("کد تایید ارسال شد")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ارسال کد با خطا مواجه شد.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (!phoneNumber) return false
    try {
      await sendOtp(phoneNumber)
      toast.success("کد تایید دوباره ارسال شد")
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ارسال مجدد کد با خطا مواجه شد.")
      return false
    }
  }

  const verifyOtp = async (otp: string) => {
    setIsLoading(true)
    try {
      const normalizedOtp = toLatinDigits(otp).replace(/\D/g, "")
      const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneNumber, otp_code: normalizedOtp }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, "کد تایید نامعتبر است."))
      }

      if (data.requires_signup) {
        const expiresIn = Number(data.signup_token_expires_in) || DEFAULT_SIGNUP_TOKEN_TTL_SECONDS
        const nextPending = {
          phoneNumber,
          signupToken: data.signup_token,
          expiresAt: Date.now() + expiresIn * 1000,
        }
        persistPendingSignup(nextPending)
        setStage("REGISTRATION")
        return
      }

      localStorage.setItem("accessToken", data.access)
      if (data.refresh) localStorage.setItem("refreshToken", data.refresh)
      persistPendingSignup(null)
      markLoginPwaPromptPending()
      await finalizeAuth(data.access)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تایید هویت انجام نشد.")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordLogin = async (password: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneNumber, password }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, "شماره موبایل یا رمز عبور نادرست است."))
      }
      localStorage.setItem("accessToken", data.access)
      if (data.refresh) localStorage.setItem("refreshToken", data.refresh)
      markLoginPwaPromptPending()
      await finalizeAuth(data.access)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ورود با رمز عبور انجام نشد.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegistrationSubmit = async (data: { fullName: string; email?: string; password: string }) => {
    if (!pendingSignup?.signupToken) {
      toast.error("زمان ثبت نام به پایان رسیده است. دوباره کد دریافت کنید.")
      setStage("PHONE")
      persistPendingSignup(null)
      return
    }

    setIsLoading(true)
    setSignupError(null)
    setSignupData(data)

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/complete-signup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signup_token: pendingSignup.signupToken,
          full_name: data.fullName,
          email: data.email || null,
          password: data.password,
        }),
      })
      const responseData = await res.json().catch(() => null)
      if (!res.ok) {
        const errorCode = responseData?.code
        if (errorCode === "signup_token_expired" || errorCode === "invalid_signup_token") {
          persistPendingSignup(null)
          setStage("PHONE")
          throw new Error("زمان ثبت نام به پایان رسیده است. دوباره کد دریافت کنید.")
        }
        throw new Error(extractErrorMessage(responseData, "ثبت نام انجام نشد."))
      }

      localStorage.setItem("accessToken", responseData.access)
      if (responseData.refresh) localStorage.setItem("refreshToken", responseData.refresh)
      persistPendingSignup(null)
      markSignupProfilePromptPending()
      await finalizeAuth(responseData.access)
    } catch (e) {
      const message = e instanceof Error ? e.message : "ثبت نام انجام نشد."
      setSignupError(message)
      toast.error(message)
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
            {stage === "PHONE" && <StepPhone onSubmit={handlePhoneSubmit} isLoading={isLoading} />}

            {stage === "OTP" && (
              <StepOtp
                phoneNumber={phoneNumber}
                onBack={() => setStage("PHONE")}
                onPasswordLogin={canUsePasswordLogin ? () => setStage("PASSWORD") : undefined}
                onResendOtp={handleResendOtp}
                onSubmit={verifyOtp}
                isLoading={isLoading}
              />
            )}

            {stage === "PASSWORD" && (
              <StepPassword
                phoneNumber={phoneNumber}
                onSubmit={handlePasswordLogin}
                onBack={async () => {
                  const ok = await handleResendOtp()
                  if (ok) setStage("OTP")
                }}
                onEditPhone={() => setStage("PHONE")}
                isLoading={isLoading}
              />
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
