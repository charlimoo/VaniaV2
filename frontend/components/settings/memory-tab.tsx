// components/settings/memory-tab.tsx
"use client"

import { useEffect, useState } from "react"
import { 
  BrainCircuit, 
  Trash2, 
  Loader2, 
  Search, 
  Info,
  AlertCircle,
  RefreshCw
} from "lucide-react"

import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { API_BASE_URL, getAuthHeaders } from "@/lib/api"
import { cn } from "@/lib/utils"
import { APP_CONFIG } from "@/lib/config";

interface MemoryItem {
  id: string
  // [FIX] Support varying keys from different Mem0 versions
  memory?: string
  text?: string
  content?: string
  created_at?: string
  metadata?: Record<string, any>
}

interface MemoryTabProps {
  className?: string
}

export function MemoryTab({ className }: MemoryTabProps) {
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchMemories = async () => {
    setLoading(true)
    setError(null)
    const headers = getAuthHeaders()
    if (!headers.Authorization) return

    try {
      const res = await fetch(`${API_BASE_URL}/api/services/memory/`, { headers })
      
      if (res.ok) {
        const data = await res.json()
        // Ensure array
        setMemories(Array.isArray(data) ? data : [])
      } else {
        throw new Error("Failed to load memory.")
      }
    } catch (e) {
      console.error("Memory fetch error:", e)
      setError("Could not connect to memory service.")
    } finally {
      setLoading(false)
    }
  }

  // Initial Load
  useEffect(() => {
    fetchMemories()
  }, [])

  const handleDelete = async (id: string) => {
    const headers = getAuthHeaders()
    setDeletingId(id)
    try {
      const res = await fetch(`${API_BASE_URL}/api/services/memory/${id}/`, {
        method: "DELETE",
        headers
      })
      if (!res.ok) throw new Error("Failed to delete.")
      setMemories(prev => prev.filter(m => m.id !== id))
    } catch (e) {
      console.error("Delete error:", e)
    } finally {
      setDeletingId(null)
    }
  }

  // [FIX] Normalize text for search
  const getMemoryText = (m: MemoryItem) => m.memory || m.text || m.content || APP_CONFIG.TEXT.MEMORY_UNKNOWN_FACT

  const filteredMemories = memories.filter(m => 
    getMemoryText(m).toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{APP_CONFIG.TEXT.MEMORY_TAB_TITLE}</h2>
          <p className="text-sm text-muted-foreground">
            {APP_CONFIG.TEXT.MEMORY_TAB_DESC}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMemories} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats & Search */}
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search memories..."
            className="pl-9 bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-md border text-xs text-muted-foreground whitespace-nowrap">
          <Info className="h-3.5 w-3.5" />
          <span>{memories.length} Facts Stored</span>
        </div>
      </div>

      {/* Memory List */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {loading && memories.length === 0 ? (
                 <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                 </div>
            ) : filteredMemories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center px-4">
                <BrainCircuit className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No memories found</p>
                <p className="text-xs mt-1 max-w-xs opacity-70">
                  Chat with an agent that has <b>Memory Enabled</b> to start building your personal context.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredMemories.map((item) => (
                  <div 
                    key={item.id} 
                    className="group flex items-start justify-between gap-4 p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {getMemoryText(item)}
                      </p>
                      {item.created_at && (
                        <p className="text-[10px] text-muted-foreground">
                          Learned on {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      title="Forget this fact"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}