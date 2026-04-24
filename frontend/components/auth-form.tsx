"use client"

import type { ComponentProps } from "react"

import { AuthContainer } from "@/components/auth/auth-container"

interface AuthFormProps extends ComponentProps<"div"> {
  onSuccess?: () => void | Promise<void>
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  return <AuthContainer onAuthenticated={onSuccess} />
}
