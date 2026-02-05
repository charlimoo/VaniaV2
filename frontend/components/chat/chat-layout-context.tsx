// start of components/chat/chat-layout-context.tsx
"use client"

import React, { createContext, useContext, useState, useCallback } from "react"

interface ChatLayoutContextType {
  refreshTrigger: number
  refreshThreads: () => void
}

const ChatLayoutContext = createContext<ChatLayoutContextType | undefined>(undefined)

export function ChatLayoutProvider({ children }: { children: React.ReactNode }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const refreshThreads = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  return (
    <ChatLayoutContext.Provider value={{ refreshTrigger, refreshThreads }}>
      {children}
    </ChatLayoutContext.Provider>
  )
}

export function useChatLayout() {
  const context = useContext(ChatLayoutContext)
  if (context === undefined) {
    throw new Error("useChatLayout must be used within a ChatLayoutProvider")
  }
  return context
}
// end of components/chat/chat-layout-context.tsx