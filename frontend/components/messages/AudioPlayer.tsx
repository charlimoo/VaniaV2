"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  isMe?: boolean;
  preview?: boolean; // New prop to style it differently for pre-send preview
}

export function AudioPlayer({ src, isMe = false, preview = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Reset state when src changes
    setIsPlaying(false);
    setCurrentTime(0);
    setIsReady(false);

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsReady(true);
    };

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    // Force load for pre-blob URLs
    if (audio.readyState >= 1) {
        onLoadedMetadata();
    }

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(e => console.error("Playback failed:", e));
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = Number(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time) || time === Infinity) return "00:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  // Determine colors based on context
  const theme = {
    bg: preview ? "bg-background border border-border" : isMe ? "bg-white/20" : "bg-black/5 dark:bg-white/5",
    btnBg: isMe && !preview ? "bg-white text-primary" : "bg-primary text-primary-foreground",
    slider: isMe && !preview ? "accent-white" : "accent-primary",
    text: isMe && !preview ? "text-primary-foreground/90" : "text-muted-foreground"
  };

  return (
    <div className={cn(
      "flex items-center gap-3 p-2 rounded-xl min-w-[220px] transition-all",
      theme.bg
    )} dir="ltr">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <button 
        type="button" // Prevent form submission
        onClick={togglePlay}
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-sm",
          theme.btnBg
        )}
      >
        {!isReady && !duration ? (
           // If metadata isn't loaded yet, we can still show play but maybe a small spinner if it stalls
           <Play className="h-4 w-4 fill-current ml-0.5 opacity-50" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-[120px]">
        <input
          type="range"
          min={0}
          max={duration || 100} // Fallback max to prevent locked slider
          value={currentTime}
          onChange={handleSeek}
          className={cn(
            "w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-current opacity-20 hover:opacity-30 transition-opacity",
            theme.slider
          )}
        />
        <div className={cn("flex justify-between text-[10px] font-mono font-medium leading-none", theme.text)}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}