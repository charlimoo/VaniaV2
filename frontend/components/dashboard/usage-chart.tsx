// start of frontend/components/dashboard/usage-chart.tsx
// start of components/dashboard/usage-chart.tsx
"use client"

import { useMemo } from "react"
import { 
  Area, 
  AreaChart, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis,
  YAxis
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, MessageSquare } from "lucide-react"
import { APP_CONFIG } from "@/lib/config"

interface SessionData {
  created_at: string | number
}

interface UsageChartProps {
  sessions: SessionData[]
  days?: number
}

// Helper to enforce Persian digits
const toPersianDigits = (num: number | string) => {
  return num.toString().replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[parseInt(d)]);
};

export function UsageChart({ sessions, days = 7 }: UsageChartProps) {
  
  const chartData = useMemo(() => {
    // 1. Initialize map for last X days
    const dataMap = new Map<string, number>()
    const now = new Date()
    
    // Use Persian Locale for Date Keys
    const locale = APP_CONFIG.ECONOMY.LOCALE // 'fa-IR'

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(now.getDate() - i)
      // Generates "۱۰ آذر" etc.
      const key = d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
      dataMap.set(key, 0)
    }

    // 2. Aggregate Sessions
    sessions.forEach(session => {
      const ts = typeof session.created_at === 'number' 
        ? session.created_at * 1000 
        : session.created_at
      
      const date = new Date(ts)
      const key = date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
      
      if (dataMap.has(key)) {
        dataMap.set(key, (dataMap.get(key) || 0) + 1)
      }
    })

    // 3. Convert to Array
    return Array.from(dataMap.entries()).map(([date, count]) => ({ date, count }))
  }, [sessions, days])

  const totalChats = sessions.length

  return (
    <Card className="flex flex-col h-full shadow-sm" dir="rtl">
      <CardHeader className="pb-2 text-start">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">فعالیت اخیر</CardTitle>
            <CardDescription className="text-xs mt-1">
              گفتگوها در {toPersianDigits(days)} روز گذشته
            </CardDescription>
          </div>
          <div className="bg-primary/10 p-2 rounded-full">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-[180px] w-full">
        {totalChats === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
            <MessageSquare className="h-8 w-8 mb-2 opacity-20" />
            <span className="text-xs">هیچ فعالیتی ثبت نشده است</span>
          </div>
        ) : (
          // Recharts container is generally LTR for coordinate systems, 
          // but we style the text inside to be RTL friendly.
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                stroke="#888888" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                minTickGap={10}
                tickFormatter={(val) => val} // Already Persian string
              />
              <YAxis 
                stroke="#888888"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => toPersianDigits(val)}
                orientation="right" // Put Y-Axis on the Right for RTL feel
              />
              <Tooltip 
                cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '4 4' }}
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: '1px solid var(--border)', 
                  backgroundColor: 'var(--popover)',
                  color: 'var(--popover-foreground)',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  fontSize: '12px',
                  textAlign: 'right', // Align text right
                  direction: 'rtl'    // Enforce RTL direction for tooltip content
                }}
                // Translate "count" to "تعداد گفتگو" and format the value
                formatter={(value: number) => [toPersianDigits(value), "تعداد گفتگو"]}
                labelStyle={{ marginBottom: '0.25rem', color: 'var(--muted-foreground)' }}
              />
              <Area 
                type="monotone" 
                dataKey="count" 
                stroke="var(--primary)" 
                fillOpacity={1} 
                fill="url(#colorCount)" 
                strokeWidth={2}
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
// end of frontend/components/dashboard/usage-chart.tsx