"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, Loader2, Mic, Pause, Play, Square, Trash2, WandSparkles } from "lucide-react";
import { useComposerRuntime } from "@assistant-ui/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import { handleBillingError } from "@/lib/billing-utils";
import { cn } from "@/lib/utils";

type VoiceDraftNote = {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  transcript?: string;
};

const formatDuration = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export const VoiceInput = () => {
  const composer = useComposerRuntime();
  const router = useRouter();
  const {
    isRecording,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    reset: resetRecorder,
  } = useAudioRecorder();

  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState<VoiceDraftNote[]>([]);
  const [draftText, setDraftText] = useState("");
  const [processingNoteId, setProcessingNoteId] = useState<string | null>(null);
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
  const notesRef = useRef<VoiceDraftNote[]>([]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    if (!isOpen) return;
    setDraftText(composer.getState().text || "");
  }, [composer, isOpen]);

  useEffect(() => {
    if (!audioBlob || isRecording || !isOpen) return;

    const url = URL.createObjectURL(audioBlob);
    setNotes((prev) => [
      {
        id: crypto.randomUUID(),
        blob: audioBlob,
        url,
        duration: recordingTime,
      },
      ...prev,
    ]);
    resetRecorder();
  }, [audioBlob, isOpen, isRecording, recordingTime, resetRecorder]);

  useEffect(() => {
    return () => {
      notesRef.current.forEach((note) => URL.revokeObjectURL(note.url));
    };
  }, []);

  const noteCountLabel = useMemo(() => notes.length.toLocaleString("fa-IR"), [notes.length]);

  const closeDialog = (nextOpen: boolean) => {
    if (nextOpen) {
      setIsOpen(true);
      return;
    }

    if (isRecording) {
      stopRecording();
    }
    notes.forEach((note) => URL.revokeObjectURL(note.url));
    setNotes([]);
    setDraftText("");
    setProcessingNoteId(null);
    setPlayingNoteId(null);
    resetRecorder();
    setIsOpen(false);
  };

  const appendTranscript = (noteId: string, transcript: string) => {
    const cleanText = transcript.trim();
    if (!cleanText) return;

    setNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, transcript: cleanText } : note)));
    setDraftText((prev) => (prev.trim() ? `${prev.trim()}\n${cleanText}` : cleanText));
  };

  const transcribeNote = async (note: VoiceDraftNote) => {
    setProcessingNoteId(note.id);
    try {
      const formData = new FormData();
      formData.append("file", note.blob, `voice-draft-${note.id}.webm`);

      const response = await fetch(`${API_BASE_URL}/agent/transcribe`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const apiLikeError = {
          status: response.status,
          detail: body?.detail || body?.error || "تبدیل گفتار به متن ناموفق بود.",
          message: body?.detail || body?.error || "تبدیل گفتار به متن ناموفق بود.",
        };
        if (handleBillingError(apiLikeError, router)) return;
        throw apiLikeError;
      }

      const data = await response.json();
      const text = String(data?.text || "").trim();
      if (!text) {
        toast.error("متنی از فایل صوتی استخراج نشد.");
        return;
      }

      appendTranscript(note.id, text);
      toast.success("متن این بخش به پیش‌نویس اضافه شد.");
    } catch (error: any) {
      toast.error(error?.detail || error?.message || "تبدیل گفتار به متن ناموفق بود.");
    } finally {
      setProcessingNoteId(null);
    }
  };

  const removeNote = (noteId: string) => {
    setNotes((prev) => {
      const nextNotes = prev.filter((note) => note.id !== noteId);
      const removedNote = prev.find((note) => note.id === noteId);
      if (removedNote) URL.revokeObjectURL(removedNote.url);
      return nextNotes;
    });
    if (playingNoteId === noteId) {
      setPlayingNoteId(null);
    }
  };

  const applyDraftToComposer = (sendNow: boolean) => {
    const nextText = draftText.trim();
    if (!nextText) {
      toast.error("ابتدا متن یا یادداشت صوتی را آماده کنید.");
      return;
    }

    composer.setText(nextText);
    if (sendNow) {
      composer.send();
    }
    closeDialog(false);
  };

  return (
    <>
      <div className="flex items-center">
        <TooltipIconButton
          tooltip="یادداشت صوتی چندبخشی"
          variant="ghost"
          className="size-[34px] rounded-full p-1 text-muted-foreground hover:bg-muted"
          onClick={() => setIsOpen(true)}
        >
          <Mic className="size-5" />
        </TooltipIconButton>
      </div>

      <Dialog open={isOpen} onOpenChange={closeDialog}>
        <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>پیش‌نویس صوتی پیام</DialogTitle>
            <DialogDescription>
              می‌توانید چند فایل صوتی کوتاه ضبط کنید، هر بخش را به متن تبدیل کنید، متن نهایی را ویرایش کنید و بعد برای ایجنت بفرستید.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <AudioLines className="h-3.5 w-3.5" />
                  بخش‌های صوتی
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    {noteCountLabel}
                  </Badge>
                </div>

                {!isRecording ? (
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void startRecording()}>
                    <Mic className="h-4 w-4" />
                    شروع ضبط
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="gap-1.5 animate-pulse"
                    onClick={stopRecording}
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    توقف ضبط
                  </Button>
                )}
              </div>

              {isRecording ? (
                <div className="mt-3 text-[11px] text-amber-600">در حال ضبط... {formatDuration(recordingTime)}</div>
              ) : (
                <div className="mt-3 text-[11px] text-muted-foreground">
                  هر بار ضبط یک بخش جداگانه می‌سازد. بعد از توقف، می‌توانید همان بخش را به متن تبدیل کنید.
                </div>
              )}

              <div className="mt-3 space-y-2">
                {notes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-[11px] text-muted-foreground">
                    هنوز بخشی ضبط نشده است.
                  </div>
                ) : (
                  notes.map((note, index) => (
                    <div key={note.id} className="rounded-xl border border-border/50 bg-background/80 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs font-medium">
                            <span>بخش {notes.length - index}</span>
                            <span className="text-muted-foreground">{formatDuration(note.duration)}</span>
                          </div>
                          <audio
                            controls
                            src={note.url}
                            className="mt-2 h-10 w-full"
                            onPlay={() => setPlayingNoteId(note.id)}
                            onPause={() => setPlayingNoteId((prev) => (prev === note.id ? null : prev))}
                            onEnded={() => setPlayingNoteId((prev) => (prev === note.id ? null : prev))}
                          />
                          {note.transcript ? (
                            <div className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-[12px] leading-6 text-foreground/90">
                              {note.transcript}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1 self-end sm:self-start">
                          <TooltipIconButton
                            tooltip={playingNoteId === note.id ? "در حال پخش" : "پیش‌نمایش فایل صوتی"}
                            variant="ghost"
                            className="size-8 rounded-full"
                            disabled
                          >
                            {playingNoteId === note.id ? <Pause className="size-4" /> : <Play className="size-4" />}
                          </TooltipIconButton>
                          <TooltipIconButton
                            tooltip="تبدیل به متن و افزودن به پیش‌نویس"
                            variant="ghost"
                            className="size-8 rounded-full"
                            onClick={() => void transcribeNote(note)}
                            disabled={processingNoteId === note.id}
                          >
                            {processingNoteId === note.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <WandSparkles className="size-4" />
                            )}
                          </TooltipIconButton>
                          <TooltipIconButton
                            tooltip="حذف این بخش"
                            variant="ghost"
                            className="size-8 rounded-full text-destructive"
                            onClick={() => removeNote(note.id)}
                          >
                            <Trash2 className="size-4" />
                          </TooltipIconButton>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">متن نهایی پیام</div>
                <div className="text-[11px] text-muted-foreground">
                  متن را قبل از ارسال می‌توانید ویرایش کنید.
                </div>
              </div>
              <Textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="متن تبدیل‌شده یا توضیح تکمیلی خود را اینجا ویرایش کنید..."
                className="min-h-[220px] resize-y text-sm leading-7"
              />
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => applyDraftToComposer(false)} className="w-full sm:w-auto">
              انتقال به کادر پیام
            </Button>
            <Button onClick={() => applyDraftToComposer(true)} className={cn("w-full gap-2 sm:w-auto")}>
              ارسال به ایجنت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
