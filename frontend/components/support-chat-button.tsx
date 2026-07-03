"use client"

import { Headphones } from "lucide-react"

import { Button } from "@/components/ui/button"

type GoftinoApi = {
  open?: () => void
  setWidget?: (options: { hasIcon?: boolean }) => void
}

type GoftinoWindow = Window & {
  Goftino?: GoftinoApi
}

export function SupportChatButton() {
  const openSupportChat = () => {
    const goftino = (window as GoftinoWindow).Goftino
    goftino?.setWidget?.({ hasIcon: false })
    goftino?.open?.()
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={openSupportChat}
      aria-label="پشتیبانی"
      title="پشتیبانی"
    >
      <Headphones className="h-5 w-5 text-muted-foreground" />
    </Button>
  )
}
