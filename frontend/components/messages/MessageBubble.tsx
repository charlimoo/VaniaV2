"use client";

import { useState } from "react";
import { Check, CheckCheck, FileIcon, Download, Music } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "./AudioPlayer";

// --- EXPORTED TYPE ---
export interface MessageData {
  id: number;
  content: string;
  is_me: boolean;
  is_read: boolean;
  created_at: string;
  message_type?: 'TEXT' | 'AUDIO' | 'IMAGE' | 'FILE';
  attachment_url?: string | null;
  metadata?: any;
}

interface MessageBubbleProps {
  message: MessageData;
  isSequence?: boolean;
}

// --- HELPERS ---
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
};

// Fixes SSL errors for local MinIO development
const getValidUrl = (url: string | null | undefined) => {
  if (!url) return "";
  
  // If running locally with MinIO on port 9000, force HTTP to avoid SSL_PROTOCOL_ERROR
  if ((url.includes("127.0.0.1:9000") || url.includes("localhost:9000")) && url.startsWith("https:")) {
    return url.replace("https:", "http:");
  }
  
  return url;
};

export function MessageBubble({ message, isSequence = false }: MessageBubbleProps) {
  const { is_me, message_type, attachment_url, content } = message;
  const [isImageOpen, setIsImageOpen] = useState(false);

  // Process the URL to ensure it works locally
  const validUrl = getValidUrl(attachment_url);

  return (
    <div 
      className={cn(
        "relative max-w-full text-sm leading-relaxed shadow-sm group transition-all",
        is_me 
          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-none" 
          : "bg-muted text-foreground border border-border rounded-2xl rounded-bl-none",
        isSequence && "mt-0.5",
        // Padding adjustment based on content type
        message_type === 'IMAGE' ? "p-1" : "px-4 py-2.5"
      )}
    >
      
      {/* 1. TEXT MESSAGE */}
      {message_type === 'TEXT' && (
        <p className="whitespace-pre-wrap min-w-[80px]">{content}</p>
      )}

      {/* 2. AUDIO MESSAGE */}
      {message_type === 'AUDIO' && validUrl && (
        <div className={cn("pt-1", is_me ? "min-w-[240px]" : "min-w-[240px]")}>
          <div className="flex items-center gap-2 mb-1 opacity-70 px-1">
             <Music className="w-3 h-3" />
             <span className="text-[10px]">پیام صوتی</span>
          </div>
          <AudioPlayer src={validUrl} isMe={is_me} />
          {content && <p className="mt-2 text-xs opacity-90 border-t border-white/20 pt-1.5 mx-1">{content}</p>}
        </div>
      )}

      {/* 3. IMAGE MESSAGE */}
      {message_type === 'IMAGE' && validUrl && (
        <div className="flex flex-col">
          <Dialog open={isImageOpen} onOpenChange={setIsImageOpen}>
            <DialogTrigger asChild>
              <div className="rounded-xl overflow-hidden cursor-zoom-in relative bg-black/5 min-w-[150px] min-h-[150px]">
                <img 
                  src={validUrl} 
                  alt="Attachment" 
                  className="max-w-full h-auto object-cover hover:scale-105 transition-transform duration-500" 
                  loading="lazy"
                />
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-screen-xl w-fit p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
               <div className="relative">
                <img 
                  src={validUrl} 
                  alt="Full Preview" 
                  className="max-w-[90vw] max-h-[85vh] object-contain rounded-md shadow-2xl" 
                />
                <a href={validUrl} download className="absolute bottom-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70">
                    <Download className="w-5 h-5" />
                </a>
               </div>
            </DialogContent>
          </Dialog>
          
          {content && <p className={cn("px-3 py-2 text-sm", is_me ? "text-primary-foreground" : "text-foreground")}>{content}</p>}
        </div>
      )}

      {/* 4. FILE MESSAGE */}
      {message_type === 'FILE' && validUrl && (
        <div className="space-y-2 min-w-[200px]">
          <a 
            href={validUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-all group/file",
              is_me 
                ? "bg-white/10 border-white/20 hover:bg-white/20" 
                : "bg-muted/50 border-border hover:bg-muted"
            )}
          >
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
              is_me ? "bg-white text-primary" : "bg-primary/10 text-primary"
            )}>
              <FileIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <p className="text-xs font-bold truncate dir-ltr text-right">
                {validUrl.split('/').pop()?.split('?')[0] || "Document"}
              </p>
              <div className="flex items-center justify-end gap-1 text-[10px] opacity-70 mt-0.5">
                <span className="group-hover/file:underline">دانلود فایل</span>
                <Download className="h-3 w-3" />
              </div>
            </div>
          </a>
          {content && <p className="text-xs opacity-90 whitespace-pre-wrap">{content}</p>}
        </div>
      )}

      {/* 5. METADATA (Time & Checks) */}
      <div className={cn(
        "flex items-center gap-1 mt-1 text-[9px] select-none opacity-70 dir-ltr",
        message_type === 'IMAGE' ? "absolute bottom-2 right-2 bg-black/40 text-white px-1.5 py-0.5 rounded-full backdrop-blur-sm" : "",
        is_me && message_type !== 'IMAGE' ? "justify-start text-primary-foreground/80" : "justify-end text-muted-foreground"
      )}>
        <span>{formatTime(message.created_at)}</span>
        {is_me && (
          message.is_read 
            ? <CheckCheck className="w-3 h-3" /> 
            : <Check className="w-3 h-3" />
        )}
      </div>
    </div>
  );
}