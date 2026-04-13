// start of components/auth/onboarding-form.tsx
"use client"

import { useState } from "react"
import { Loader2, User, Mail, Lock, ArrowLeft, Phone } from "lucide-react" 

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { API_BASE_URL, getAuthHeaders } from "@/lib/api"
import { useUser } from "@/hooks/use-user"
import { extractErrorMessage } from "@/lib/error-utils"
import { PASSWORD_POLICY_HINT, getPasswordPolicyErrors } from "@/lib/password-policy"

interface OnboardingFormProps {
  onComplete: () => void;
  phoneNumber?: string; // ADDED: Accept phone number
}

export function OnboardingForm({ onComplete, phoneNumber }: OnboardingFormProps) {
  const { refreshUser } = useUser()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (formData.password !== formData.confirm_password) {
      setError("رمزهای عبور مطابقت ندارند.")
      setIsLoading(false)
      return
    }

    const passwordErrors = getPasswordPolicyErrors(formData.password)
    if (passwordErrors.length > 0) {
      setError(passwordErrors[0])
      setIsLoading(false)
      return
    }

    try {
      const headers = getAuthHeaders()
      
      const res = await fetch(`${API_BASE_URL}/api/auth/profile/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          email: formData.email.trim(),
          password: formData.password
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(extractErrorMessage(data, "خطا در بروزرسانی پروفایل."))
      }

      await refreshUser()
      onComplete()

    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6 md:p-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">تکمیل پروفایل</h1>
        <p className="text-muted-foreground text-sm">
          لطفاً برای ادامه اطلاعات حساب خود را تکمیل کنید.
        </p>
      </div>

      <div className="grid gap-4">
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-100 rounded-md text-center">
            {error}
          </div>
        )}

        {/* --- ADDED: Read-only Phone Field (Acts as 'username' for Chrome) --- */}
        {phoneNumber && (
          <div className="grid gap-2">
            <Label htmlFor="phone_static">شماره موبایل</Label>
            <div className="relative">
              <Phone className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone_static"
                name="username"           // Browser looks for 'username'
                autoComplete="username"   // Explicit hint
                value={phoneNumber}
                readOnly
                disabled
                className="pr-9 ltr text-left bg-muted/50 text-muted-foreground" 
              />
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="full_name">نام و نام خانوادگی</Label>
          <div className="relative">
            <User className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="full_name"
              name="name"
              autoComplete="name"
              placeholder="مثال: علی محمدی"
              className="pr-9" 
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">آدرس ایمیل</Label>
          <div className="relative">
            <Mail className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              name="email"
              autoComplete="email" // Explicitly NOT 'username'
              placeholder="اختیاری - ali@example.com"
              className="pr-9 ltr text-left" 
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            می‌توانید ایمیل را بعداً در تنظیمات حساب وارد کنید.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">تعیین رمز عبور</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              name="password"
              autoComplete="new-password" // Hint for saving new credentials
              placeholder="********"
              className="pr-9 ltr text-left"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {PASSWORD_POLICY_HINT}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirm_password">تکرار رمز عبور</Label>
          <div className="relative">
            <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirm_password"
              type="password"
              name="confirm_password"
              autoComplete="new-password"
              placeholder="********"
              className="pr-9 ltr text-left"
              value={formData.confirm_password}
              onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full mt-2 gap-2" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <>تکمیل ثبت‌نام <ArrowLeft className="h-4 w-4" /></>
          )}
        </Button>
      </div>
    </form>
  )
}
// end of components/auth/onboarding-form.tsx
