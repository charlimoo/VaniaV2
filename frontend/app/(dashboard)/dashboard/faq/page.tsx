"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Search, 
  HelpCircle, 
  ChevronDown, 
  BookOpen,
  Phone,
  Mail,
  Headphones,
  Loader2,
  Package
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { GuideModal } from "@/components/guide/GuideModal"
import { useUser } from "@/hooks/use-user"
import { cn } from "@/lib/utils"
import { useConfig } from "@/components/providers/config-provider"
import { API_BASE_URL } from "@/lib/api"

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

export default function FaqPage() {
  const { config } = useConfig();
  const { user } = useUser();
  const contacts = Array.isArray(config.support_contacts) ? config.support_contacts : [];
  
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("همه")
  const [openItems, setOpenItems] = useState<number[]>([])

  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/billing/faqs/`);
        if (res.ok) {
          const data = await res.json();
          // [FIX] Handle DRF Pagination (data.results) vs Raw Array
          const list = Array.isArray(data) ? data : (data.results || []);
          setFaqs(list);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingFaqs(false);
      }
    };
    fetchFaqs();
  }, []);

  const categories = useMemo(() => {
    if (loadingFaqs || !Array.isArray(faqs)) return ["همه"];
    return ["همه", ...Array.from(new Set(faqs.map(item => item.category)))];
  }, [faqs, loadingFaqs]);

  const filteredFaqs = useMemo(() => {
    if (!Array.isArray(faqs)) return [];
    return faqs.filter(item => {
      const matchesCategory = selectedCategory === "همه" || item.category === selectedCategory
      const matchesSearch = 
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.answer.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [searchQuery, selectedCategory, faqs]);

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  return (
    <div className="flex flex-col w-full h-full space-y-8 pb-4 max-w-6xl mx-auto pt-6" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1 text-start">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" /> 
            مرکز راهنما
          </h1>
          <p className="text-muted-foreground">
            سوالات متداول و مستندات پشتیبانی.
          </p>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="جستجو در سوالات..."
            className="pr-9 bg-background text-start"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border",
              selectedCategory === cat
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Guide Section */}
      <div className="rounded-xl border border-border/60 bg-card/50 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-right">
            <h2 className="text-lg font-semibold flex items-center justify-start gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              راهنمای استفاده از وانیا آپ
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              برای آشنایی کامل با دستیارها، بخش‌های پلتفرم و مسیر شروع سریع.
            </p>
          </div>

          <GuideModal user={user} triggerLabel="مشاهده راهنمای کامل" triggerClassName="w-full md:w-auto" />
        </div>
      </div>

      {/* FAQ List */}
      <div className="space-y-4 min-h-[300px]">
        {loadingFaqs ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p>در حال بارگذاری...</p>
            </div>
        ) : (
            <AnimatePresence mode="popLayout">
            {filteredFaqs.length === 0 ? (
                <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 text-muted-foreground"
                >
                <Search className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">موردی یافت نشد</p>
                <p className="text-sm">عبارت جستجو یا دسته‌بندی را تغییر دهید.</p>
                </motion.div>
            ) : (
                filteredFaqs.map((faq, originalIndex) => {
                const isOpen = openItems.includes(originalIndex)
                
                return (
                    <motion.div
                    key={faq.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                        "border rounded-xl overflow-hidden bg-card transition-colors duration-200",
                        isOpen ? "border-primary/50 shadow-sm" : "hover:border-primary/30"
                    )}
                    >
                    <button
                        onClick={() => toggleItem(originalIndex)}
                        className="w-full flex items-center justify-between p-5 text-start group"
                    >
                        <div className="flex items-center gap-4">
                        <span className="font-semibold text-foreground/90 group-hover:text-primary transition-colors text-right">
                            {faq.question}
                        </span>
                        {selectedCategory === "همه" && (
                            <Badge variant="secondary" className="text-[10px] font-normal hidden sm:inline-flex">
                            {faq.category}
                            </Badge>
                        )}
                        </div>
                        <ChevronDown 
                        className={cn(
                            "h-5 w-5 text-muted-foreground transition-transform duration-300",
                            isOpen && "rotate-180 text-primary"
                        )} 
                        />
                    </button>
                    
                    <AnimatePresence>
                        {isOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                            <div className="px-5 pb-5 pt-0 text-muted-foreground text-sm leading-relaxed border-t border-dashed border-border/50 mt-2 text-start">
                            <div className="pt-4 text-right">
                                {faq.answer}
                            </div>
                            </div>
                        </motion.div>
                        )}
                    </AnimatePresence>
                    </motion.div>
                )
                })
            )}
            </AnimatePresence>
        )}
      </div>

      {/* --- Minimal Contact Section (Dynamic) --- */}
      <div className="mt-8 pt-8 border-t border-border/40">
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4 flex flex-col gap-4 text-xs text-muted-foreground">
          
          <div className="flex items-center gap-2 justify-between ">
            <div className="flex items-center gap-2">
              <div className=" p-1.5 bg-primary/10 rounded-full text-primary">
                  <Headphones className="h-3.5 w-3.5" />
              </div>
              <span>پاسخ خود را پیدا نکردید؟ تیم فنی آماده راهنمایی شماست.</span>
            </div>

          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
             <a href={`tel:${config.support_phone}`} className="flex items-center gap-2 hover:text-primary transition-colors group">
                
                <span className="font-mono font-medium tracking-wide dir-ltr text-foreground/80">
                    {config.support_phone || "---"}
                </span>
                <Phone className="h-3.5 w-3.5 group-hover:text-primary/80" />
             </a>
             
             <div className="hidden md:block w-px h-3 bg-border" />
             
             <a href={`mailto:${config.support_email}`} className="flex items-center gap-2 hover:text-primary transition-colors group">
                
                <span className="font-sans font-medium text-foreground/80">
                    {config.support_email || "---"}
                </span>
                <Mail className="h-3.5 w-3.5 group-hover:text-primary/80" />
             </a>
             <div className="hidden md:block w-px h-3 bg-border" />
             {config.support_postal_code && (
                <span className="flex gap-2 text-foreground/80">{config.support_postal_code} <Package className="h-3.5 w-3.5 group-hover:text-primary/80" /></span>
             )}
          </div>
          </div>
          {contacts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {contacts.map((contact, index) => (
                <div key={`${contact.name}-${index}`} className="rounded-lg border border-border/40 px-3 py-2 bg-background/40 text-right">
                  {contact.role && <p className="text-[11px] text-muted-foreground">{contact.role}</p>}
                  <p className="text-xs font-semibold text-foreground">{contact.name}</p>
                  <a href={`tel:${contact.phone}`} className="inline-block font-mono text-[11px] text-primary mt-0.5" dir="ltr">
                    {contact.phone}
                  </a>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

    </div>
  )
}
