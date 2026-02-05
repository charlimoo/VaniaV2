// frontend/components/assistant-ui/voice-input.tsx
"use client";

import { useState, useRef } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { useComposerRuntime } from "@assistant-ui/react";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { cn } from "@/lib/utils";
import { API_BASE_URL, getAuthHeaders } from "@/lib/api";

export const VoiceInput = () => {
  const composer = useComposerRuntime();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await handleTranscribe(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("لطفا دسترسی به میکروفون را بررسی کنید.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const handleTranscribe = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      // Filename helps backend/OpenAI detect format
      formData.append("file", audioBlob, "recording.webm");

      const response = await fetch(`${API_BASE_URL}/agent/transcribe`, {
        method: "POST",
        headers: {
            ...getAuthHeaders(), // Include Auth Token
            // Do NOT set Content-Type here; fetch sets it automatically for FormData
        },
        body: formData,
      });

      if (!response.ok) throw new Error("مشکلی پیش آمده است.");

      const data = await response.json();
      
      // Append transcribed text to current input
      const currentText = composer.getState().text;
      const newText = currentText 
        ? `${currentText} ${data.text}`.trim() 
        : data.text;
      
      composer.setText(newText);
    } catch (error) {
      console.error("Transcription error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex items-center">
      {isProcessing ? (
        <div className="flex size-[34px] items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : isRecording ? (
        <TooltipIconButton
          tooltip="توقف ضبط"
          variant="destructive"
          className={cn(
            "size-[34px] rounded-full p-1",
            "animate-pulse bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
          )}
          onClick={stopRecording}
        >
          <Square className="size-4 fill-current" />
        </TooltipIconButton>
      ) : (
        <TooltipIconButton
          tooltip="تبدیل گفتار به متن"
          variant="ghost"
          className="size-[34px] rounded-full p-1 text-muted-foreground hover:bg-muted"
          onClick={startRecording}
        >
          <Mic className="size-5" />
        </TooltipIconButton>
      )}
    </div>
  );
};