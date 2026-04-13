"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  HelpCircle, 
  ChevronDown, 
  Phone,
  Mail,
  MapPin,
  Headphones,
  Loader2
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useConfig } from "@/components/providers/config-provider";
import { API_BASE_URL } from "@/lib/api";

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

export default function PublicSupportPage() {
  const { config } = useConfig(); 
  const contacts = Array.isArray(config.support_contacts) ? config.support_contacts : [];
  
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("همه");
  const [openItems, setOpenItems] = useState<number[]>([]);

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
        console.error("Failed to load FAQs", e);
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
      const matchesCategory = selectedCategory === "همه" || item.category === selectedCategory;
      const matchesSearch = 
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.answer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory, faqs]);

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="w-full space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* --- SECTION 1: DYNAMIC HEADER --- */}
      <div className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/40 backdrop-blur-xl transition-all duration-500 hover:border-white/20 mt-6">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none opacity-50" />
        
        <div className="relative z-10 flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="mb-6 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 shadow-2xl backdrop-blur-md">
            <Headphones className="h-10 w-10 text-indigo-400" strokeWidth={1.5} />
          </div>

          <h1 className="mb-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
            مرکز <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">پشتیبانی</span>
          </h1>
          <p className="mb-10 text-lg text-neutral-400 max-w-lg mx-auto font-light leading-relaxed">
            پاسخ سوالات متداول و راه‌های ارتباطی مستقیم با تیم فنی
          </p>

          <div className="grid w-full grid-cols-1 divide-y divide-white/5 rounded-2xl border border-white/5 bg-white/[0.02] sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-x-reverse overflow-hidden backdrop-blur-sm">
            
            <div className="group flex flex-col items-center justify-center p-6 transition-colors hover:bg-white/[0.02]">
              <Phone className="mb-3 h-6 w-6 text-neutral-500 transition-colors group-hover:text-indigo-400" />
              <span className="mb-1 text-sm font-medium text-neutral-400">تماس تلفنی</span>
              <a href={`tel:${config.support_phone}`} className="font-mono text-lg font-bold text-white tracking-wider hover:text-indigo-300 transition-colors" dir="ltr">
                {config.support_phone || "---"}
              </a>
            </div>

            <div className="group flex flex-col items-center justify-center p-6 transition-colors hover:bg-white/[0.02]">
              <Mail className="mb-3 h-6 w-6 text-neutral-500 transition-colors group-hover:text-indigo-400" />
              <span className="mb-1 text-sm font-medium text-neutral-400">پست الکترونیک</span>
              <a href={`mailto:${config.support_email}`} className="font-sans text-base font-semibold text-white hover:text-indigo-300 transition-colors">
                {config.support_email || "---"}
              </a>
            </div>

            <div className="group flex flex-col items-center justify-center p-6 transition-colors hover:bg-white/[0.02]">
              <MapPin className="mb-3 h-6 w-6 text-neutral-500 transition-colors group-hover:text-indigo-400" />
              <span className="mb-1 text-sm font-medium text-neutral-400">دفتر مرکزی</span>
              <span className="text-center text-sm font-semibold text-white">
                {config.support_address || "---"}
              </span>
              {config.support_postal_code && (
                <span className="mt-1 text-xs text-neutral-400">کد پستی: {config.support_postal_code}</span>
              )}
            </div>

          </div>

          {contacts.length > 0 && (
            <div className="mt-6 w-full rounded-2xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-sm">
              <h3 className="text-right text-sm font-semibold text-white mb-3">مسئولان پاسخگویی</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {contacts.map((contact, index) => (
                  <div key={`${contact.name}-${index}`} className="rounded-xl border border-white/10 bg-black/10 p-3 text-right">
                    {contact.role && <p className="text-xs text-neutral-400">{contact.role}</p>}
                    <p className="text-sm font-semibold text-white mt-0.5">{contact.name}</p>
                    <a href={`tel:${contact.phone}`} className="inline-flex mt-1 text-xs font-mono text-indigo-300 hover:text-indigo-200 transition-colors" dir="ltr">
                      {contact.phone}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- SECTION 2: FAQ ACCORDION --- */}
      <div className="space-y-8 px-2">
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-indigo-500" />
            سوالات متداول
          </h2>
          
          <div className="relative w-full md:w-80 group">
            <Search className="absolute right-3 top-3 h-4 w-4 text-zinc-500 group-focus-within:text-white transition-colors" />
            <Input
              placeholder="جستجو در سوالات..."
              className="pr-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 transition-all rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 border",
                selectedCategory === cat
                  ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                  : "bg-transparent text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200 hover:bg-white/5"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="space-y-3 min-h-[300px]">
          {loadingFaqs ? (
             <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <Loader2 className="w-8 h-8 animate-spin mb-2 opacity-50" />
                <p>در حال دریافت سوالات...</p>
             </div>
          ) : (
            <AnimatePresence mode="popLayout">
                {filteredFaqs.length === 0 ? (
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="text-center py-20 text-zinc-500 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]"
                >
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>موردی با این مشخصات یافت نشد.</p>
                </motion.div>
                ) : (
                filteredFaqs.map((faq, originalIndex) => {
                    const isOpen = openItems.includes(originalIndex);
                    return (
                    <motion.div
                        key={faq.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                        "group border rounded-2xl overflow-hidden bg-white/[0.02] transition-all duration-300",
                        isOpen 
                            ? "border-indigo-500/30 bg-white/[0.04] shadow-[0_4px_20px_-10px_rgba(99,102,241,0.1)]" 
                            : "border-white/5 hover:border-white/10 hover:bg-white/[0.03]"
                        )}
                    >
                        <button
                        onClick={() => toggleItem(originalIndex)}
                        className="w-full flex items-center justify-between p-6 text-start outline-none"
                        >
                        <span className={cn(
                            "font-medium text-lg transition-colors",
                            isOpen ? "text-indigo-300" : "text-zinc-200 group-hover:text-white"
                        )}>
                            {faq.question}
                        </span>
                        <div className={cn(
                            "p-2 rounded-full transition-all duration-300",
                            isOpen ? "bg-indigo-500/20 text-indigo-400 rotate-180" : "bg-white/5 text-zinc-500 group-hover:text-white group-hover:bg-white/10"
                        )}>
                            <ChevronDown className="h-5 w-5" />
                        </div>
                        </button>
                        
                        <AnimatePresence>
                        {isOpen && (
                            <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                            >
                            <div className="px-6 pb-6 pt-0">
                                <div className="pt-4 border-t border-dashed border-white/10 text-zinc-400 text-base leading-loose text-justify">
                                {faq.answer}
                                </div>
                            </div>
                            </motion.div>
                        )}
                        </AnimatePresence>
                    </motion.div>
                    );
                })
                )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
