// frontend/app/(dashboard)/dashboard/messages/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback, Suspense, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation"; 
import { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { 
  Search, 
  Send, 
  ArrowRight, 
  Loader2, 
  MessageSquare, 
  MoreVertical, 
  Phone, 
  Video,
  User, 
  Paperclip,
  Mic,
  X,
  File as FileIcon,
  Image as ImageIcon,
  Trash2,
  StopCircle,
  Inbox
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { cn } from "@/lib/utils";
import { hasExpertFeatures } from "@/lib/roles";
import { resolveExpertCaseAgentSlug } from "@/lib/expert-agent";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { MessageBubble, MessageData } from "@/components/messages/MessageBubble";
import { AudioPlayer } from "@/components/messages/AudioPlayer";
import { useUser } from "@/hooks/use-user"; // [FIX] Import useUser

// --- TYPES ---

interface Conversation {
  user_id: number;
  name: string;
  avatar: string | null;
  role_label: string;
  specialty?: string;
  last_message: string;
  last_message_date: string;
  unread_count: number;
  phone_number?: string; // [FIX] Added phone_number
  email?: string | null;
}

// ... (formatDate and formatDuration helpers remain the same) ...
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth();
  
  if (isToday) {
    return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const formatTimeInput = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatJalaliDate = (date: Date) =>
  new DateObject({ date, calendar: persian, locale: persian_fa }).format("YYYY/MM/DD");

const buildMeetIsoString = (jalaliDate: string, timeValue: string) => {
  if (!jalaliDate || !timeValue) return null;

  const [hoursRaw, minutesRaw] = timeValue.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const dateObject = new DateObject({
    date: jalaliDate,
    format: "YYYY/MM/DD",
    calendar: persian,
    locale: persian_fa,
  });
  dateObject.setHour(hours);
  dateObject.setMinute(minutes);
  dateObject.setSecond(0);
  dateObject.setMillisecond(0);

  const jsDate = dateObject.toDate();
  return Number.isNaN(jsDate.getTime()) ? null : jsDate.toISOString();
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function MessagesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlUserId = searchParams.get('userId');
  
  // [FIX] Get current user to check role
  const { user: currentUser } = useUser();
  const isDoctor = hasExpertFeatures(currentUser);

  // --- STATE ---
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // ... (rest of state remains the same)
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputText, setInputText] = useState("");
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { 
    startRecording, 
    stopRecording, 
    cancelRecording, 
    isRecording, 
    recordingTime, 
    audioBlob,
    reset: resetAudio 
  } = useAudioRecorder();

  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isLoadingInbox, setIsLoadingInbox] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreatingMeet, setIsCreatingMeet] = useState(false);
  const [isMeetMenuOpen, setIsMeetMenuOpen] = useState(false);
  const [manualMeetEmail, setManualMeetEmail] = useState("");
  const [selectedMeetEmails, setSelectedMeetEmails] = useState<string[]>([]);
  const [meetScheduledDate, setMeetScheduledDate] = useState(() => formatJalaliDate(new Date()));
  const [meetScheduledTime, setMeetScheduledTime] = useState(() => formatTimeInput(new Date()));
  const [mobileView, setMobileView] = useState<'LIST' | 'CHAT'>('LIST');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ... (handleSwitchConversation and handleClearActiveConversation remain the same) ...
  const handleSwitchConversation = (userId: number) => {
    setActiveConversationId(userId);
    setMobileView('CHAT');
    const params = new URLSearchParams(searchParams);
    params.set('userId', userId.toString());
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleClearActiveConversation = () => {
    setMobileView('LIST');
    setActiveConversationId(null);
    const params = new URLSearchParams(searchParams);
    params.delete('userId');
    router.replace(`${pathname}?${params.toString()}`);
  };

  // ... (fetchInbox and fetchMessages remain the same) ...
  const fetchInbox = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/messages/inbox/`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsLoadingInbox(false); 
    }
  }, []);

  const fetchMessages = useCallback(async (userId: number, isSilent = false) => {
    if (!isSilent) setIsLoadingMessages(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vania/messages/${userId}/`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        setConversations(prev => prev.map(c => 
          c.user_id === userId ? { ...c, unread_count: 0 } : c
        ));
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!isSilent) setIsLoadingMessages(false);
    }
  }, []);

  // ... (All Effects remain the same) ...
  useEffect(() => {
    fetchInbox();
    const interval = setInterval(fetchInbox, 15000); 
    return () => clearInterval(interval);
  }, [fetchInbox]);

  useEffect(() => {
    if (urlUserId) {
        const id = parseInt(urlUserId);
        if (!isNaN(id) && id !== activeConversationId) {
            setActiveConversationId(id);
            setMobileView('CHAT');
        }
    }
  }, [urlUserId]); 

  useEffect(() => {
    if (activeConversationId) {
        fetchMessages(activeConversationId);
        const interval = setInterval(() => fetchMessages(activeConversationId, true), 5000);
        return () => clearInterval(interval);
    }
  }, [activeConversationId, fetchMessages]);

  useEffect(() => {
    if (messagesEndRef.current) {
        const behavior = isLoadingMessages ? "auto" : "smooth";
        messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, [messages, activeConversationId, mobileView, isLoadingMessages, selectedFile, audioBlob]);

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setAudioPreviewUrl(url);
      return () => { URL.revokeObjectURL(url); };
    } else {
      setAudioPreviewUrl(null);
    }
  }, [audioBlob]);

  // ... (Attachment and Recording handlers remain the same) ...
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) { 
        toast.error("حجم فایل نباید بیشتر از ۱۰ مگابایت باشد.");
        return;
      }
      if (audioBlob) { resetAudio(); setAudioPreviewUrl(null); }
      setSelectedFile(file);
      if (file.type.startsWith('image/')) { setPreviewUrl(URL.createObjectURL(file)); } 
      else { setPreviewUrl(null); }
    }
  };

  const clearAttachment = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    resetAudio();
    setAudioPreviewUrl(null);
  };

  const handleStartRecording = async () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAudioPreviewUrl(null);
    await startRecording();
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeConversationId || isSending) return;

    const hasText = inputText.trim().length > 0;
    const hasFile = !!selectedFile;
    const hasAudio = !!audioBlob;

    if (!hasText && !hasFile && !hasAudio) return;

    setIsSending(true);

    try {
      const formData = new FormData();
      if (audioBlob) {
        formData.append('attachment', audioBlob, 'voice_message.webm');
        formData.append('message_type', 'AUDIO');
        formData.append('metadata', JSON.stringify({ duration: recordingTime }));
        if (hasText) formData.append('content', inputText); 
      } else if (selectedFile) {
        formData.append('attachment', selectedFile);
        formData.append('message_type', selectedFile.type.startsWith('image/') ? 'IMAGE' : 'FILE');
        formData.append('metadata', JSON.stringify({ size: selectedFile.size, name: selectedFile.name }));
        if (hasText) formData.append('content', inputText);
      } else {
        formData.append('content', inputText);
        formData.append('message_type', 'TEXT');
      }

      const headers = getAuthHeaders();
      delete headers["Content-Type"]; 

      const res = await fetch(`${API_BASE_URL}/api/vania/messages/${activeConversationId}/`, {
        method: "POST",
        headers: headers,
        body: formData
      });
      
      if (res.ok) {
        setInputText("");
        clearAttachment();
        await fetchMessages(activeConversationId, true);
        fetchInbox(); 
      } else {
        throw new Error();
      }
    } catch (e) {
      toast.error("ارسال پیام ناموفق بود");
    } finally {
      setIsSending(false);
    }
  };

  const activeUser = conversations.find(c => c.user_id === activeConversationId);
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

  // [FIX] Action Handlers
  const handleCallUser = () => {
    if (!activeUser?.phone_number) {
        toast.error("شماره تماس این کاربر در دسترس نیست.");
        return;
    }

    // Standard way to trigger phone dialer
    window.location.href = `tel:${activeUser.phone_number}`;
  };

  const handleViewProfile = async () => {
    if (!activeUser) return;
    const expertAgentSlug = await resolveExpertCaseAgentSlug();
    const newThreadId = `local-${crypto.randomUUID()}`;
    router.push(`/chat/${expertAgentSlug}/${newThreadId}?visitorId=${activeUser.user_id}`);
  };

  const suggestedMeetEmails = useMemo(() => {
    const values = [currentUser?.email, activeUser?.email]
      .map((email) => (email || "").trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(values));
  }, [currentUser?.email, activeUser?.email]);

  useEffect(() => {
    if (!isMeetMenuOpen) return;
    setSelectedMeetEmails(suggestedMeetEmails);
    setManualMeetEmail("");
    const now = new Date();
    setMeetScheduledDate(formatJalaliDate(now));
    setMeetScheduledTime(formatTimeInput(now));
  }, [isMeetMenuOpen, suggestedMeetEmails, activeConversationId]);

  const toggleMeetEmail = (email: string) => {
    setSelectedMeetEmails((prev) =>
      prev.includes(email) ? prev.filter((item) => item !== email) : [...prev, email]
    );
  };

  const handleAddManualMeetEmail = () => {
    const normalized = manualMeetEmail.trim().toLowerCase();
    if (!normalized) return;
    if (!isValidEmail(normalized)) {
      toast.error("ایمیل وارد شده معتبر نیست.");
      return;
    }
    setSelectedMeetEmails((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setManualMeetEmail("");
  };

  const handleSetQuickMeetTime = (minutesFromNow: number) => {
    const next = new Date();
    next.setMinutes(next.getMinutes() + minutesFromNow);
    setMeetScheduledDate(formatJalaliDate(next));
    setMeetScheduledTime(formatTimeInput(next));
  };

  const handleSetTomorrowSameTime = () => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    setMeetScheduledDate(formatJalaliDate(next));
    setMeetScheduledTime(formatTimeInput(next));
  };

  const handleCreateMeet = async () => {
    if (!activeConversationId || !activeUser || isCreatingMeet) return;

    setIsCreatingMeet(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/vania/messages/${activeConversationId}/create-meet/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            attendee_emails: selectedMeetEmails,
            scheduled_at: buildMeetIsoString(meetScheduledDate, meetScheduledTime),
          }),
        }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "ساخت لینک جلسه ناموفق بود.");
      }

      const prefillMessage = data?.prefill_message || "";
      setInputText((prev) => prev.trim() ? `${prev.trim()}\n\n${prefillMessage}` : prefillMessage);
      setIsMeetMenuOpen(false);
      toast.success("لینک جلسه آماده شد و داخل متن پیام قرار گرفت.");
    } catch (e: any) {
      toast.error(e?.message || "ساخت لینک جلسه ناموفق بود.");
    } finally {
      setIsCreatingMeet(false);
    }
  };

  return (
    <div className="mx-auto mt-4 flex h-[calc(100vh-8rem)] w-full max-w-7xl overflow-hidden rounded-xl border border-border bg-card shadow-sm" dir="rtl">
      
      {/* SIDEBAR (User List) - No changes here */}
      <div className={cn(
        "h-full w-full border-l border-border bg-background flex flex-col transition-all duration-300 lg:w-80 xl:w-96",
        mobileView === 'CHAT' ? "hidden lg:flex" : "flex"
      )}>
        {/* ... (Sidebar Header, Search, List Container - Exact same as before) ... */}
        <div className="p-4 h-16 border-b border-border flex items-center justify-between shrink-0 bg-muted/10">
            <h2 className="font-bold text-lg flex items-center gap-2 text-foreground">
                <MessageSquare className="w-5 h-5 text-primary" />
                پیام‌ها
            </h2>
            <div className="text-[10px] font-medium text-muted-foreground bg-background border px-2.5 py-1 rounded-full shadow-sm">
                {conversations.length} گفتگو
            </div>
        </div>

        <div className="p-3 border-b border-border bg-muted/5 shrink-0">
            <div className="relative">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
                <Input 
                    placeholder="جستجو در گفتگوها..." 
                    className="pr-9 h-9 text-xs bg-background border-border/60 focus-visible:ring-1 transition-all" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                />
            </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
            {isLoadingInbox ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
                    <span className="text-xs">بارگذاری گفتگوها...</span>
                </div>
            ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2 opacity-60">
                    <Inbox className="h-10 w-10 stroke-[1.5]" />
                    <span className="text-xs">پیامی یافت نشد.</span>
                </div>
            ) : (
                <div className="flex flex-col">
                    {filteredConversations.map(conv => {
                        const isActive = activeConversationId === conv.user_id;
                        return (
                            <button 
                                key={conv.user_id} 
                                onClick={() => handleSwitchConversation(conv.user_id)} 
                                className={cn(
                                    "relative flex items-center gap-3 p-4 text-start transition-all border-b border-border/40 last:border-0 hover:bg-muted/40",
                                    isActive && "bg-primary/5 hover:bg-primary/10"
                                )}
                            >
                                {isActive && <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary rounded-l-full" />}
                                
                                <div className="relative shrink-0">
                                    <Avatar className="h-11 w-11 border border-border bg-background shadow-sm">
                                        <AvatarImage src={conv.avatar || ""} />
                                        <AvatarFallback className="bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-700 font-bold text-sm">
                                            {conv.name.slice(0,1)}
                                        </AvatarFallback>
                                    </Avatar>
                                    {conv.unread_count > 0 && (
                                        <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 bg-red-500 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-bold text-white shadow-sm animate-in zoom-in">
                                            {conv.unread_count}
                                        </span>
                                    )}
                                </div>
                                
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className={cn("truncate font-semibold text-sm", isActive ? "text-primary" : "text-foreground")}>
                                            {conv.name}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                                            {formatDate(conv.last_message_date)}
                                        </span>
                                    </div>
                                    <p className="max-w-[160px] truncate text-xs leading-relaxed text-muted-foreground opacity-80 xl:max-w-[220px]">
                                        {conv.last_message.includes('voice_message') ? '🎤 پیام صوتی' : conv.last_message}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
      </div>

      {/* CHAT AREA */}
      <div className={cn(
        "flex-1 flex flex-col bg-muted/5 relative h-full min-w-0 overflow-hidden",
        mobileView === 'LIST' ? "hidden lg:flex" : "flex"
      )}>
        {activeConversationId && activeUser ? (
            <>
                {/* --- Header with Actions [FIXED] --- */}
                <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm z-10 shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="lg:hidden -mr-2 text-muted-foreground" onClick={handleClearActiveConversation}>
                            <ArrowRight className="h-5 w-5" />
                        </Button>
                        
                        <Avatar className="h-10 w-10 border border-border shadow-sm">
                            <AvatarImage src={activeUser.avatar || ""} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                {activeUser.name.slice(0,1)}
                            </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex flex-col">
                            <h3 className="font-bold text-sm text-foreground">{activeUser.name}</h3>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                {activeUser.role_label && (
                                    <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-normal rounded-sm bg-muted text-muted-foreground border-border">
                                        {activeUser.role_label}
                                    </Badge>
                                )}
                                {activeUser.specialty && <span className="opacity-70 text-[10px] border-r border-border pr-1.5">{activeUser.specialty}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                        {/* Call Button [FIXED] */}
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-muted-foreground hover:text-foreground"
                            onClick={handleCallUser}
                            title="تماس صوتی"
                        >
                            <Phone className="h-4 w-4" />
                        </Button>

                        {isDoctor && (
                            <Popover open={isMeetMenuOpen} onOpenChange={setIsMeetMenuOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-foreground"
                                        title="ساخت لینک گوگل میت"
                                    >
                                        {isCreatingMeet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    align="end"
                                    sideOffset={10}
                                    className="w-[360px] rounded-2xl border-border/70 p-4 shadow-xl"
                                    dir="rtl"
                                >
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-semibold text-foreground">ساخت جلسه گوگل میت</h4>
                                            <p className="text-xs leading-5 text-muted-foreground">
                                                ایمیل‌های مهمان را انتخاب کنید، زمان جلسه را مشخص کنید و بعد لینک را داخل پیام قرار دهید.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">ایمیل‌های پیشنهادی</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {suggestedMeetEmails.length > 0 ? (
                                                    suggestedMeetEmails.map((email) => {
                                                        const selected = selectedMeetEmails.includes(email);
                                                        return (
                                                            <button
                                                                key={email}
                                                                type="button"
                                                                onClick={() => toggleMeetEmail(email)}
                                                                className={cn(
                                                                    "rounded-full px-3 py-1.5 text-xs transition-colors",
                                                                    selected
                                                                        ? "bg-primary text-primary-foreground"
                                                                        : "bg-muted text-muted-foreground hover:text-foreground"
                                                                )}
                                                            >
                                                                {email}
                                                            </button>
                                                        );
                                                    })
                                                ) : (
                                                    <p className="text-xs text-muted-foreground">ایمیل ذخیره‌شده‌ای برای این گفتگو پیدا نشد.</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="meet-manual-email" className="text-xs text-muted-foreground">
                                                افزودن ایمیل دستی
                                            </Label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    id="meet-manual-email"
                                                    type="email"
                                                    dir="ltr"
                                                    value={manualMeetEmail}
                                                    onChange={(e) => setManualMeetEmail(e.target.value)}
                                                    placeholder="example@gmail.com"
                                                    className="h-9 text-left"
                                                />
                                                <Button type="button" variant="outline" size="sm" onClick={handleAddManualMeetEmail}>
                                                    افزودن
                                                </Button>
                                            </div>
                                            {selectedMeetEmails.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedMeetEmails.map((email) => (
                                                        <button
                                                            key={email}
                                                            type="button"
                                                            onClick={() => toggleMeetEmail(email)}
                                                            className="rounded-full bg-primary/10 px-3 py-1 text-[11px] text-primary transition-colors hover:bg-primary/15"
                                                        >
                                                            {email}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">زمان جلسه</Label>
                                            <div className="flex flex-wrap gap-2">
                                                <Button type="button" variant="outline" size="sm" onClick={() => handleSetQuickMeetTime(0)}>همین حالا</Button>
                                                <Button type="button" variant="outline" size="sm" onClick={() => handleSetQuickMeetTime(30)}>۳۰ دقیقه بعد</Button>
                                                <Button type="button" variant="outline" size="sm" onClick={() => handleSetQuickMeetTime(60)}>۱ ساعت بعد</Button>
                                                <Button type="button" variant="outline" size="sm" onClick={handleSetTomorrowSameTime}>فردا همین ساعت</Button>
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
                                                <PersianDatePicker
                                                    value={meetScheduledDate}
                                                    onChange={setMeetScheduledDate}
                                                    placeholder="تاریخ جلسه را انتخاب کنید"
                                                />
                                                <Input
                                                    type="time"
                                                    value={meetScheduledTime}
                                                    onChange={(e) => setMeetScheduledTime(e.target.value)}
                                                    className="h-9 text-left"
                                                    dir="ltr"
                                                />
                                            </div>
                                            <p className="text-[11px] leading-5 text-muted-foreground">
                                                مدت جلسه به‌صورت پیش‌فرض ۶۰ دقیقه در نظر گرفته می‌شود.
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-end gap-2 pt-1">
                                            <Button type="button" variant="ghost" size="sm" onClick={() => setIsMeetMenuOpen(false)}>
                                                انصراف
                                            </Button>
                                            <Button type="button" size="sm" onClick={handleCreateMeet} disabled={isCreatingMeet}>
                                                {isCreatingMeet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                                                ساخت لینک
                                            </Button>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}

                        {/* Dropdown Menu [FIXED] */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {/* Only show "View Profile" if current user is Doctor */}
                                {isDoctor && (
                                    <DropdownMenuItem onClick={handleViewProfile} className="cursor-pointer">
                                        <User className="h-4 w-4 ml-2" /> مشاهده پرونده
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* --- Messages Area (Unchanged) --- */}
                <div className="flex-1 overflow-y-auto min-h-0 p-4 scroll-smooth">
                    <div className="flex flex-col gap-3 min-h-full">
                        <div className="flex-1" />
                        
                        {isLoadingMessages && messages.length === 0 ? (
                            <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/50" /></div>
                        ) : messages.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center text-muted-foreground opacity-50 gap-3 py-10">
                                <div className="p-4 bg-muted/20 rounded-full">
                                    <MessageSquare className="h-12 w-12" />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="font-semibold text-sm">گفتگوی جدید</p>
                                    <p className="text-xs">پیامی ارسال کنید تا گفتگو آغاز شود.</p>
                                </div>
                            </div>
                        ) : (
                            messages.map((msg, index) => {
                                const isMe = msg.is_me;
                                const isSequence = index > 0 && messages[index - 1].is_me === isMe;
                                
                                return (
                                    <div 
                                        key={msg.id} 
                                        className={cn(
                                            "flex w-full max-w-[85%] sm:max-w-[70%] animate-in slide-in-from-bottom-2 fade-in duration-300",
                                            isMe ? "self-start justify-start" : "self-end justify-end gap-2",
                                            isSequence ? "mt-1" : "mt-4"
                                        )}
                                    >
                                        {!isMe && (
                                            <div className="w-8 shrink-0 flex items-end">
                                                {!isSequence && (
                                                    <Avatar className="h-8 w-8 border shadow-sm">
                                                        <AvatarImage src={activeUser.avatar || ""} />
                                                        <AvatarFallback className="text-[10px]">{activeUser.name.slice(0,1)}</AvatarFallback>
                                                    </Avatar>
                                                )}
                                            </div>
                                        )}
                                        
                                        {!isMe && isSequence && <div className="w-8 shrink-0" />}

                                        <MessageBubble message={msg} isSequence={isSequence} />
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* --- Input Area (Unchanged) --- */}
                <div className="p-3 bg-background border-t border-border shrink-0 z-20">
                    {/* ... (Attachments & Audio Preview) ... */}
                    {selectedFile && !audioBlob && (
                        <div className="mb-2 flex items-center gap-3 p-2 bg-muted/40 rounded-xl border border-border animate-in slide-in-from-bottom-2 relative group max-w-md">
                            <div className="h-12 w-12 bg-background border rounded-lg flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative">
                                {previewUrl ? (
                                    <img src={previewUrl} className="h-full w-full object-cover" alt="Preview" />
                                ) : (
                                    <FileIcon className="h-6 w-6 text-blue-500" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate text-foreground">{selectedFile.name}</p>
                                <p className="text-[10px] text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={clearAttachment}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {audioBlob && audioPreviewUrl && !isRecording && (
                        <div className="mb-2 flex flex-col gap-2 p-3 bg-card rounded-xl border border-border shadow-sm animate-in slide-in-from-bottom-2 max-w-md">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400">
                                    <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                                    <span>پیام صوتی آماده ارسال</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full" onClick={clearAttachment}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="w-full">
                                <AudioPlayer src={audioPreviewUrl} preview={true} isMe={true} />
                            </div>
                        </div>
                    )}

                    {/* Input Controls */}
                    {isRecording ? (
                        <div className="flex items-center gap-3 h-14 px-1 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex-1 bg-red-50 dark:bg-red-950/20 rounded-full h-12 flex items-center px-5 gap-4 border border-red-100 dark:border-red-900/50 relative overflow-hidden shadow-inner">
                                <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]" />
                                <span className="text-sm font-mono font-bold text-red-600 dark:text-red-400 min-w-[50px]">
                                    {formatDuration(recordingTime)}
                                </span>
                                <div className="flex-1 flex items-center justify-end gap-1 opacity-60 h-6">
                                    {[...Array(12)].map((_, i) => (
                                        <div 
                                            key={i} 
                                            className="w-1 bg-red-400 rounded-full animate-[pulse_1s_ease-in-out_infinite]" 
                                            style={{ 
                                                height: `${Math.max(20, Math.random() * 100)}%`, 
                                                animationDelay: `${i * 0.05}s` 
                                            }} 
                                        />
                                    ))}
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-12 w-12 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full" onClick={cancelRecording}>
                                <X className="h-6 w-6" />
                            </Button>
                            <Button size="icon" className="h-12 w-12 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg shadow-red-500/20 animate-in zoom-in" onClick={() => { stopRecording(); }}>
                                <StopCircle className="h-6 w-6 fill-current" />
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                onChange={handleFileSelect} 
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" 
                            />
                            
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className={cn(
                                    "h-11 w-11 rounded-full text-muted-foreground hover:bg-muted shrink-0 transition-colors",
                                    selectedFile ? "text-primary bg-primary/10" : ""
                                )}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!!audioBlob} 
                            >
                                {selectedFile ? <ImageIcon className="h-5 w-5" /> : <Paperclip className="h-5 w-5" />}
                            </Button>

                            <Input 
                                value={inputText} 
                                onChange={(e) => setInputText(e.target.value)} 
                                placeholder={audioBlob ? "توضیحی بنویسید (اختیاری)..." : "پیام خود را بنویسید..."}
                                className="flex-1 border-transparent bg-muted/30 focus-visible:ring-0 focus-visible:bg-muted/50 px-4 min-h-[44px] py-3 rounded-3xl shadow-none transition-all placeholder:text-muted-foreground/50"
                            />
                            
                            {inputText.trim() || selectedFile || audioBlob ? (
                                <Button 
                                    type="submit" 
                                    disabled={isSending} 
                                    size="icon" 
                                    className="h-11 w-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shrink-0 transition-all duration-300 animate-in zoom-in spin-in-90"
                                >
                                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                                </Button>
                            ) : (
                                <Button 
                                    type="button" 
                                    size="icon" 
                                    className="h-11 w-11 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted-foreground/10 hover:text-primary shadow-sm shrink-0 transition-all"
                                    onClick={handleStartRecording}
                                >
                                    <Mic className="h-5 w-5" />
                                </Button>
                            )}
                        </form>
                    )}
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-6 bg-muted/5">
                <div className="p-8 bg-background border border-dashed border-border rounded-full animate-pulse shadow-sm">
                    <MessageSquare className="h-12 w-12 opacity-20" />
                </div>
                <div className="text-center space-y-2 max-w-xs px-4">
                    <h3 className="text-xl font-bold text-foreground">پیام‌رسان امن</h3>
                    <p className="text-sm opacity-80 leading-relaxed">
                        برای شروع گفتگو و ارسال پیام متنی، صوتی یا فایل، یک مخاطب را از لیست سمت راست انتخاب کنید.
                    </p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>}>
        <MessagesContent />
    </Suspense>
  );
}
