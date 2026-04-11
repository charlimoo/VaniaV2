"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { 
  Loader2, 
  User, 
  Mail, 
  Lock, 
  Edit2,
  KeyRound,
  ArrowLeft
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

// --- Schemas ---
const phoneSchema = z.object({
  phoneNumber: z.string().regex(/^(\+98|0)?9\d{9}$/, "شماره موبایل معتبر نیست"),
})

const otpSchema = z.object({
  otp: z.string().length(6, "کد تایید باید ۶ رقم باشد"),
})

const passwordSchema = z.object({
  password: z.string().min(1, "لطفا رمز عبور را وارد کنید"),
})

const registrationSchema = z.object({
  fullName: z.string().min(3, "نام کامل الزامی است"),
  email: z.string().email("ایمیل معتبر نیست").optional().or(z.literal("")),
  password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد"),
})

// --- Step 1: Phone ---
export function StepPhone({ onSubmit, isLoading }: { onSubmit: (val: string) => void, isLoading: boolean }) {
  const form = useForm({ resolver: zodResolver(phoneSchema) })

  return (
    <form onSubmit={form.handleSubmit((d) => onSubmit(d.phoneNumber))} className="flex flex-col h-full justify-center space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-bold tracking-tight text-white">ورود / ثبت‌نام</h2>
        <p className="text-xs text-zinc-400">شماره موبایل خود را وارد کنید</p>
      </div>
      
      <div className="space-y-4">
        <div className="relative group">
          <Input 
            {...form.register("phoneNumber")}
            placeholder="0912..." 
            className="h-12 text-center text-lg tracking-widest ltr bg-white/5 border-white/10 focus:border-white/20 focus:bg-white/10 rounded-xl transition-all placeholder:text-white/20"
            autoFocus
            disabled={isLoading}
          />
        </div>
        {form.formState.errors.phoneNumber && (
          <p className="text-xs text-red-400 text-center">
            {form.formState.errors.phoneNumber.message as string}
          </p>
        )}

        <Button size="lg" className="w-full h-12 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold" disabled={isLoading}>
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "ادامه"}
        </Button>
      </div>
    </form>
  )
}

// --- Step 2: Registration (New User) ---
export function StepRegistration({ 
  phoneNumber, 
  onSubmit, 
  isLoading 
}: { 
  phoneNumber: string; 
  onSubmit: (data: any) => void; 
  isLoading: boolean;
}) {
  const form = useForm({
    resolver: zodResolver(registrationSchema),
    defaultValues: { fullName: "", email: "", password: "" }
  })

  const onFormSubmit = (data: any) => {
    onSubmit({ ...data, role: "visitor" })
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold text-white">تکمیل اطلاعات</h2>
        <p className="text-[10px] text-zinc-500 font-mono tracking-wider">{phoneNumber}</p>
      </div>

      <form onSubmit={form.handleSubmit(onFormSubmit)} className="flex flex-col gap-3">
        
        <div className="space-y-3">
          <div className="relative group">
            <User className="absolute right-3 top-2.5 h-4 w-4 text-zinc-500 group-focus-within:text-white transition-colors" />
            <Input 
                {...form.register("fullName")} 
                placeholder="نام و نام خانوادگی" 
                className="h-10 pr-9 text-sm bg-white/5 border-white/10 focus:border-white/30 rounded-lg placeholder:text-zinc-600 transition-all"
            />
          </div>

          <div className="relative group">
            <Mail className="absolute right-3 top-2.5 h-4 w-4 text-zinc-500 group-focus-within:text-white transition-colors" />
            <Input 
                {...form.register("email")} 
                placeholder="ایمیل (اختیاری، قابل تکمیل در تنظیمات)" 
                className="h-10 pr-9 text-sm bg-white/5 border-white/10 focus:border-white/30 rounded-lg placeholder:text-zinc-600 transition-all ltr text-left"
            />
          </div>

          <div className="relative group">
            <Lock className="absolute right-3 top-2.5 h-4 w-4 text-zinc-500 group-focus-within:text-white transition-colors" />
            <Input 
                {...form.register("password")} 
                type="password" 
                placeholder="رمز عبور" 
                className="h-10 pr-9 text-sm bg-white/5 border-white/10 focus:border-white/30 rounded-lg placeholder:text-zinc-600 transition-all ltr text-left"
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-11 mt-2 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold shadow-lg shadow-white/5" disabled={isLoading}>
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "دریافت کد تایید"}
        </Button>
      </form>
    </div>
  )
}

// --- Step 3: OTP (Updated to use Standard InputOTP) ---
export function StepOtp({ phoneNumber, onBack, onSubmit, onPasswordLogin, isLoading }: any) {
  const form = useForm({ resolver: zodResolver(otpSchema) })

  return (
    <form onSubmit={form.handleSubmit((d) => onSubmit(d.otp))} className="flex flex-col h-full justify-center space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-bold tracking-tight text-white">تایید شماره</h2>
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 bg-white/5 py-1.5 px-4 rounded-full w-fit mx-auto border border-white/5">
          <span className="tracking-wider">{phoneNumber}</span>
          <button type="button" onClick={onBack} className="text-white hover:text-zinc-300" title="ویرایش">
            <Edit2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex justify-center" dir="ltr">
        <InputOTP 
          maxLength={6} 
          disabled={isLoading}
          value={form.watch("otp")}
          onChange={(val) => form.setValue("otp", val)}
          autoFocus
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <Button size="lg" className="w-full h-11 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold" disabled={isLoading}>
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "ورود"}
        </Button>

        {onPasswordLogin && (
            <Button 
                type="button" 
                variant="ghost" 
                onClick={onPasswordLogin} 
                className="text-zinc-500 hover:text-white hover:bg-transparent h-auto p-0 text-xs font-normal"
            >
                <KeyRound className="w-3 h-3 ml-1.5" />
                ورود با رمز عبور
            </Button>
        )}
      </div>
    </form>
  )
}

// --- Step 4: Password ---
export function StepPassword({ onSubmit, onBack, isLoading }: any) {
  const form = useForm({ resolver: zodResolver(passwordSchema) })

  return (
    <form onSubmit={form.handleSubmit((d) => onSubmit(d.password))} className="flex flex-col h-full justify-center space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-bold tracking-tight text-white">رمز عبور</h2>
        <p className="text-xs text-zinc-400">رمز عبور خود را وارد کنید</p>
      </div>

      <div className="relative group">
        <Lock className="absolute right-3 top-3.5 h-4 w-4 text-zinc-500 group-focus-within:text-white transition-colors" />
        <Input 
          type="password"
          {...form.register("password")}
          className="h-12 pr-10 text-lg ltr placeholder:text-right bg-white/5 border-white/10 focus:border-white/30 rounded-xl"
          placeholder="••••••••"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-3">
        <Button size="lg" className="w-full h-12 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold" disabled={isLoading}>
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "ورود"}
        </Button>
        <Button type="button" variant="ghost" onClick={onBack} className="text-xs text-zinc-500 hover:text-white hover:bg-transparent">
          <ArrowLeft className="w-3 h-3 ml-2" />
          بازگشت به کد تایید
        </Button>
      </div>
    </form>
  )
}
