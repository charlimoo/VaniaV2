// frontend/app/(dashboard)/dashboard/messages/page.tsx
"use client";

import { useEffect, useState, useRef, useCallback, Suspense, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation"; 
import { 
  Search, 
  Send, 
  ArrowRight, 
  Loader2, 
  MessageSquare, 
  MoreVertical, 
  Phone, 
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { cn } from "@/lib/utils";
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

function MessagesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlUserId = searchParams.get('userId');
  
  // [FIX] Get current user to check role
  const { user: currentUser } = useUser();
  const isDoctor = currentUser?.role_slug === 'doctor';

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

  const handleViewProfile = () => {
    if (!activeUser) return;
    // Doctor Agent Slug
    const doctorAgentSlug = "vania-doctor-assistant";
    const newThreadId = `local-${crypto.randomUUID()}`;
    // Navigate to Chat with Patient Context
    router.push(`/chat/${doctorAgentSlug}/${newThreadId}?patientId=${activeUser.user_id}`);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] w-full max-w-7xl mx-auto rounded-xl overflow-hidden bg-card border border-border shadow-sm mt-4" dir="rtl">
      
      {/* SIDEBAR (User List) - No changes here */}
      <div className={cn(
        "w-full md:w-80 h-full border-l border-border bg-background flex flex-col transition-all duration-300",
        mobileView === 'CHAT' ? "hidden md:flex" : "flex"
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
                                        <span className={cn("font-semibold text-sm truncate", isActive ? "text-primary" : "text-foreground")}>
                                            {conv.name}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                                            {formatDate(conv.last_message_date)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate opacity-80 leading-relaxed max-w-[180px]">
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
        mobileView === 'LIST' ? "hidden md:flex" : "flex"
      )}>
        {activeConversationId && activeUser ? (
            <>
                {/* --- Header with Actions [FIXED] --- */}
                <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm z-10 shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="md:hidden -mr-2 text-muted-foreground" onClick={handleClearActiveConversation}>
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

                    <div className="flex items-center gap-1">
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
                                        <User className="h-4 w-4 ml-2" /> مشاهده پرونده پزشکی
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