"use client";

import React, { memo } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Square,
  FileCheck,
  Lock,
  Sparkles,
  Zap,
} from "lucide-react";

import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAssistantState,
  useComposerRuntime,
  useThread,
} from "@assistant-ui/react";

import type { FC } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { Reasoning, ReasoningGroup } from "@/components/assistant-ui/reasoning";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { ComposerAttachments, UserMessageAttachments } from "@/components/assistant-ui/attachment";
import { cn } from "@/lib/utils";
import { ToolStack } from "@/components/assistant-ui/tool-stack";
import { ServiceSuggestion, DemoConfig } from "@/lib/types";
import { APP_CONFIG } from "@/lib/config";
import ShinyText from "@/components/react-bits/ShinyText";
import { VoiceInput } from "./voice-input";
import { PatientSelector } from "@/components/chat/PatientSelector";
import {
  COMPOSER_ATTACHMENT_ACCEPT,
  COMPOSER_ATTACHMENT_MAX_FILES,
  isSupportedComposerAttachment,
} from "@/lib/SimpleThreadAdapters";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BILLING_REQUIRED_EVENT, BillingRequiredDetail } from "@/lib/billing-utils";

interface ThreadProps {
  suggestions?: ServiceSuggestion[];
  showVoiceInput?: boolean;
  isPreviewMode?: boolean;
  demoConfig?: DemoConfig;
  currentUsage?: number;
  requiresVisitorSelector?: boolean;
}

const CustomUserText: FC<any> = (props) => {
  const rawText = props.part?.text || props.text || "";
  const text = rawText.trim();

  if (!text) return null;

  let isSystemAction = false;

  if (text.startsWith("[System Action]") || text.startsWith("[System:")) {
    isSystemAction = true;
  } else if (text.startsWith("{") && text.endsWith("}")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        isSystemAction = true;
      }
    } catch {}
  }

  if (isSystemAction) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground opacity-80 italic select-none py-1" dir="rtl">
        <FileCheck className="w-3.5 h-3.5" />
        <span className="text-xs">اطلاعات ارسال شد</span>
      </div>
    );
  }

  return <MarkdownText {...props} />;
};

const LimitBanner = memo(
  ({
    isPreviewMode,
    userMsgCount,
    demoConfig,
    currentUsage = 0,
  }: {
    isPreviewMode: boolean;
    userMsgCount: number;
    demoConfig?: DemoConfig;
    currentUsage?: number;
  }) => {
    if (!isPreviewMode || !demoConfig || demoConfig.message_limit_scope === "NONE") {
      return null;
    }

    const limit = demoConfig.message_limit_count;
    const scope = demoConfig.message_limit_scope;

    let used = 0;
    let label = "";

    if (scope === "SESSION") {
      used = userMsgCount;
      label = "پیام در این گفتگو";
    } else {
      used = currentUsage;
      label = scope === "DAILY" ? "پیام امروز" : "پیام کلی";
    }

    const percent = Math.min((used / limit) * 100, 100);
    const isFull = used >= limit;

    return (
      <div className="mx-auto w-full max-w-[var(--thread-max-width)] mb-4 px-4 animate-in slide-in-from-bottom-2 fade-in duration-500">
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 shadow-sm",
            isFull
              ? "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-900/50"
              : "bg-background/60 backdrop-blur-md border-border/50",
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded-lg", isFull ? "bg-amber-100 text-amber-600 dark:bg-amber-900/50" : "bg-primary/10 text-primary")}>
                {isFull ? <Lock className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              </div>
              <span className={cn("text-xs font-bold", isFull ? "text-amber-700 dark:text-amber-500" : "text-foreground")}>
                {isFull ? "ظرفیت دمو به پایان رسید" : "نسخه نمایشی"}
              </span>
            </div>
            <span className="text-[10px] font-mono font-medium opacity-60 bg-background/50 px-2 py-0.5 rounded-md border border-black/5">
              {used} / {limit} {label}
            </span>
          </div>

          <div className="h-1.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-700 ease-out rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)]",
                isFull ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-primary",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>

          {isFull && (
            <div className="mt-4 pt-3 border-t border-amber-200/50 dark:border-amber-800/30 flex justify-end">
              <Button size="sm" className="h-8 text-xs font-bold gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0 shadow-lg shadow-amber-500/20" asChild>
                <Link href="/dashboard/billing">
                  ارتقا به نسخه کامل <Zap className="w-3.5 h-3.5 fill-current" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  },
);
LimitBanner.displayName = "LimitBanner";

export const Thread: FC<ThreadProps> = ({
  suggestions = [],
  showVoiceInput = true,
  isPreviewMode = false,
  demoConfig,
  currentUsage,
  requiresVisitorSelector = false,
}) => {
  const [billingDialog, setBillingDialog] = React.useState<{
    open: boolean;
    title: string;
    message: string;
  }>({
    open: false,
    title: "اعتبار گفتگو تمام شد",
    message: "برای ادامه، یک طرح یا بسته اعتبار تهیه کنید.",
  });

  React.useEffect(() => {
    const handleBillingRequired = (event: Event) => {
      const detail = (event as CustomEvent<BillingRequiredDetail>).detail || {};
      setBillingDialog({
        open: true,
        title: detail.title || "اعتبار گفتگو تمام شد",
        message: detail.message || "برای ادامه، یک طرح یا بسته اعتبار تهیه کنید.",
      });
    };

    window.addEventListener(BILLING_REQUIRED_EVENT, handleBillingRequired as EventListener);
    return () => window.removeEventListener(BILLING_REQUIRED_EVENT, handleBillingRequired as EventListener);
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <>
          <ThreadPrimitive.Root
            className="aui-root aui-thread-root @container flex h-full flex-col bg-background"
            style={{
              ["--thread-max-width" as string]: "44rem",
            }}
          >
            <ThreadPrimitive.Viewport className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll px-4">
              <ThreadPrimitive.If empty>
                <ThreadWelcome suggestions={suggestions} />
              </ThreadPrimitive.If>

              <ThreadPrimitive.Messages
                components={{
                  UserMessage,
                  EditComposer,
                  AssistantMessage,
                }}
              />

              <ThreadPrimitive.If empty={false}>
                <div className="aui-thread-viewport-spacer min-h-8 grow" />
              </ThreadPrimitive.If>

              <Composer
                showVoiceInput={showVoiceInput}
                isPreviewMode={isPreviewMode}
                demoConfig={demoConfig}
                currentUsage={currentUsage}
                requiresVisitorSelector={requiresVisitorSelector}
              />
            </ThreadPrimitive.Viewport>
          </ThreadPrimitive.Root>
          <BillingRequiredDialog
            open={billingDialog.open}
            title={billingDialog.title}
            message={billingDialog.message}
            onOpenChange={(open) => setBillingDialog((prev) => ({ ...prev, open }))}
          />
        </>
      </MotionConfig>
    </LazyMotion>
  );
};

const BillingRequiredDialog: FC<{
  open: boolean;
  title: string;
  message: string;
  onOpenChange: (open: boolean) => void;
}> = ({ open, title, message, onOpenChange }) => {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader className="text-right">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            بعدا
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              router.push("/dashboard/billing");
            }}
          >
            مشاهده طرح‌ها
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="برو به پایین"
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC<{ suggestions: ServiceSuggestion[] }> = ({ suggestions }) => {
  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
      <div className="aui-thread-welcome-center flex w-full flex-grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex size-full flex-col justify-start px-8 pt-8">
          <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="aui-thread-welcome-message-motion-1 text-2xl font-semibold">
            {APP_CONFIG.TEXT.CHAT_WELCOME_TITLE}
          </m.div>
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ delay: 0.1 }}
            className="aui-thread-welcome-message-motion-2 text-1xl text-muted-foreground/65 mt-4"
          >
            {APP_CONFIG.TEXT.CHAT_WELCOME_SUBTITLE}
          </m.div>
        </div>
      </div>
      <ThreadSuggestions suggestions={suggestions} />
    </div>
  );
};

const ThreadSuggestions: FC<{ suggestions: ServiceSuggestion[] }> = ({ suggestions }) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="aui-thread-welcome-suggestions grid w-full gap-2 pb-4 @md:grid-cols-2">
      {suggestions.map((suggestion, index) => (
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${index}`}
          className="aui-thread-welcome-suggestion-display"
        >
          <ThreadPrimitive.Suggestion prompt={suggestion.prompt} send asChild>
            <Button
              variant="ghost"
              className="aui-thread-welcome-suggestion h-auto w-full flex-1 flex-wrap items-start justify-start gap-1 rounded-3xl border px-5 py-4 text-start text-sm @md:flex-col dark:hover:bg-accent/60"
            >
              <span className="aui-thread-welcome-suggestion-text-1 font-medium w-full">{suggestion.title}</span>
              <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground w-full">{suggestion.subtitle}</span>
            </Button>
          </ThreadPrimitive.Suggestion>
        </m.div>
      ))}
    </div>
  );
};

const Composer: FC<{
  showVoiceInput: boolean;
  isPreviewMode: boolean;
  demoConfig?: DemoConfig;
  currentUsage?: number;
  requiresVisitorSelector: boolean;
}> = ({ showVoiceInput, isPreviewMode, demoConfig, currentUsage = 0, requiresVisitorSelector }) => {
  const messages = useThread((t) => t.messages);
  const composer = useComposerRuntime();
  const attachmentCount = useAssistantState(({ composer }) => composer.attachments.length);
  const hasPendingAttachments = useAssistantState(({ composer }) =>
    composer.attachments.some((attachment) => attachment.status.type === "running" || attachment.status.type === "incomplete"),
  );
  const [isDragActive, setIsDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dragDepthRef = React.useRef(0);
  const userMsgCount = React.useMemo(() => messages.filter((m) => m.role === "user").length, [messages]);

  let isLocked = false;
  if (isPreviewMode && demoConfig && demoConfig.message_limit_scope !== "NONE") {
    const limit = demoConfig.message_limit_count;
    if (demoConfig.message_limit_scope === "SESSION") {
      if (userMsgCount >= limit) isLocked = true;
    } else {
      if (currentUsage >= limit) isLocked = true;
    }
  }

  const attachmentsDisabled = isLocked || isPreviewMode;

  const queueComposerFiles = React.useCallback(
    async (incomingFiles: File[]) => {
      if (attachmentsDisabled || incomingFiles.length === 0) return;

      const supportedFiles: File[] = [];
      let unsupportedCount = 0;

      for (const file of incomingFiles) {
        if (isSupportedComposerAttachment(file)) supportedFiles.push(file);
        else unsupportedCount++;
      }

      const remainingSlots = Math.max(0, COMPOSER_ATTACHMENT_MAX_FILES - attachmentCount);
      const acceptedFiles = supportedFiles.slice(0, remainingSlots);
      const overflowCount = Math.max(0, supportedFiles.length - acceptedFiles.length);

      if (unsupportedCount > 0) {
        toast.error("فقط تصویر و PDF قابل پیوست هستند.");
      }

      if (overflowCount > 0 || (remainingSlots === 0 && supportedFiles.length > 0)) {
        toast.error(`حداکثر ${COMPOSER_ATTACHMENT_MAX_FILES} فایل در هر پیام مجاز است.`);
      }

      for (const file of acceptedFiles) {
        try {
          await composer.addAttachment(file);
        } catch (error) {
          console.error("Failed to add attachment", error);
          toast.error(`افزودن فایل ${file.name} انجام نشد.`);
        }
      }
    },
    [attachmentCount, attachmentsDisabled, composer],
  );

  const handleFileSelection = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      void queueComposerFiles(files);
      event.target.value = "";
    },
    [queueComposerFiles],
  );

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(event.clipboardData.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      void queueComposerFiles(files);
    },
    [queueComposerFiles],
  );

  const shouldHandleDrag = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files");
  }, []);

  const handleDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (attachmentsDisabled || !shouldHandleDrag(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDragActive(true);
    },
    [attachmentsDisabled, shouldHandleDrag],
  );

  const handleDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (attachmentsDisabled || !shouldHandleDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!isDragActive) setIsDragActive(true);
    },
    [attachmentsDisabled, isDragActive, shouldHandleDrag],
  );

  const handleDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (attachmentsDisabled || !shouldHandleDrag(event)) return;
      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragActive(false);
      }
    },
    [attachmentsDisabled, shouldHandleDrag],
  );

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (attachmentsDisabled || !shouldHandleDrag(event)) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDragActive(false);
      void queueComposerFiles(Array.from(event.dataTransfer.files ?? []));
    },
    [attachmentsDisabled, queueComposerFiles, shouldHandleDrag],
  );

  return (
    <div className="aui-composer-wrapper sticky bottom-0 mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 overflow-visible rounded-t-3xl bg-background pb-4 md:pb-6">
      <ThreadScrollToBottom />

      <LimitBanner isPreviewMode={isPreviewMode} userMsgCount={userMsgCount} demoConfig={demoConfig} currentUsage={currentUsage} />

      <div className="relative" onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        <ComposerPrimitive.Root
          className={cn(
            "aui-composer-root group/input-group relative flex w-full flex-col rounded-3xl border border-input bg-background px-1 pt-2 shadow-sm transition-[color,box-shadow,opacity] duration-300 outline-none has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-[3px] has-[textarea:focus-visible]:ring-ring/20 dark:bg-background",
            isDragActive && !attachmentsDisabled && "border-primary ring-[3px] ring-primary/15 shadow-lg shadow-primary/10",
            isLocked && "opacity-50 pointer-events-none grayscale border-dashed bg-muted/30",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={COMPOSER_ATTACHMENT_ACCEPT}
            className="hidden"
            onChange={handleFileSelection}
          />

          <ComposerAttachments />

          {isDragActive && !attachmentsDisabled && (
            <div className="px-3.5 pb-2 text-xs font-medium text-primary" dir="rtl">
              برای پیوست کردن، فایل را رها کنید
            </div>
          )}

          <ComposerPrimitive.Input
            placeholder={isLocked ? "ظرفیت استفاده از دمو به پایان رسیده است." : APP_CONFIG.TEXT.CHAT_INPUT_PLACEHOLDER}
            disabled={isLocked}
            addAttachmentOnPaste={false}
            onPaste={handlePaste}
            className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0 text-start disabled:cursor-not-allowed"
            rows={1}
            autoFocus
            aria-label="ورودی پیام"
          />

          <ComposerAction
            showVoiceInput={showVoiceInput}
            isPreviewMode={isPreviewMode}
            isLocked={isLocked}
            hasPendingAttachments={hasPendingAttachments}
            requiresVisitorSelector={requiresVisitorSelector}
            onAddAttachment={() => fileInputRef.current?.click()}
          />
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
};

const ComposerAction: FC<{
  showVoiceInput: boolean;
  isPreviewMode: boolean;
  isLocked: boolean;
  hasPendingAttachments: boolean;
  requiresVisitorSelector: boolean;
  onAddAttachment: () => void;
}> = ({ showVoiceInput, isPreviewMode, isLocked, hasPendingAttachments, requiresVisitorSelector, onAddAttachment }) => {
  const isActuallyRunning = useThread((t: any) => Boolean(t.extras?.agui?.isRunning));
  const cancelRun = useThread((t: any) => t.extras?.agui?.cancel as (() => void) | undefined);
  const sendDisabled = isLocked || hasPendingAttachments;

  return (
    <div className="aui-composer-action-wrapper relative mx-1 mt-2 mb-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <div className={cn("transition-opacity", isPreviewMode && "opacity-30 pointer-events-none")}>
          <TooltipIconButton
            tooltip="افزودن فایل"
            side="bottom"
            variant="ghost"
            size="icon"
            onClick={onAddAttachment}
            disabled={isLocked || isPreviewMode}
            className="aui-composer-add-attachment size-[34px] rounded-full p-1 text-xs font-semibold hover:bg-muted-foreground/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30"
            aria-label="افزودن فایل"
          >
            <PlusIcon className="aui-attachment-add-icon size-5 stroke-[1.5px]" />
          </TooltipIconButton>
        </div>

        {requiresVisitorSelector && (
          <div className={cn("transition-opacity", isPreviewMode && "opacity-30 pointer-events-none")}>
            <PatientSelector />
          </div>
        )}

        {showVoiceInput && (
          <div className={cn("transition-opacity", isPreviewMode && "opacity-30 pointer-events-none")}>
            <VoiceInput />
          </div>
        )}
      </div>

      {!isActuallyRunning && (
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip={isLocked ? "قفل شده" : hasPendingAttachments ? "در حال آماده‌سازی فایل‌ها" : "ارسال پیام"}
            side="bottom"
            type="submit"
            variant="default"
            size="icon"
            disabled={sendDisabled}
            className="aui-composer-send size-[34px] rounded-full p-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="ارسال پیام"
          >
            {isLocked ? <Lock className="size-4" /> : <ArrowUpIcon className="aui-composer-send-icon size-5" />}
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      )}

      {isActuallyRunning && (
        <Button
          type="button"
          variant="default"
          size="icon"
          onClick={() => void cancelRun?.()}
          className="aui-composer-cancel size-[34px] rounded-full border border-muted-foreground/60 hover:bg-primary/75 dark:border-muted-foreground/90"
          aria-label="توقف تولید"
        >
          <Square className="aui-composer-cancel-icon size-3.5 fill-white dark:fill-black" />
        </Button>
      )}
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/5 dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantInProgressIndicator: FC = () => {
  const isRunning = useAssistantState(({ message }) => message.status?.type === "running");

  const isLastPartTool = useAssistantState(({ message }) => {
    const parts = message.content;
    const lastPart = parts[parts.length - 1];
    return lastPart?.type === "tool-call";
  });

  if (!isRunning || !isLastPartTool) return null;

  return (
    <div className="flex items-center gap-2 mt-2 h-6 animate-in fade-in slide-in-from-top-1 duration-300" dir="rtl">
      <div className="w-2 h-2 bg-foreground/50 rounded-full animate-pulse" />
      <span className="text-xs font-medium text-muted-foreground/80">
        <ShinyText speed={1.5} delay={0.3} color="#737373" shineColor="#ffffff" spread={120} yoyo={false} pauseOnHover={false} direction="right" text="در حال پردازش..." />
      </span>
    </div>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <div className="aui-assistant-message-root relative mx-auto w-full max-w-[var(--thread-max-width)] animate-in py-4 duration-150 ease-out fade-in slide-in-from-bottom-1 last:mb-24" data-role="assistant">
        <div className="aui-assistant-message-content mx-2 leading-7 break-words text-foreground text-start">
          <MessagePrimitive.Parts
            components={{
              Text: MarkdownText,
              Reasoning: Reasoning,
              ReasoningGroup: ReasoningGroup,
              tools: { Fallback: ToolStack },
            }}
          />

          <AssistantInProgressIndicator />
          <MessageError />
        </div>

        <div className="aui-assistant-message-footer mt-2 ms-2 flex">
          <BranchPicker />
          <AssistantActionBar />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="aui-assistant-action-bar-root col-start-3 row-start-2 -ms-1 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="کپی">
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="تلاش مجدد">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <div
        className="aui-user-message-root mx-auto grid w-full max-w-[var(--thread-max-width)] animate-in auto-rows-auto gap-y-2 px-2 py-4 duration-150 ease-out fade-in slide-in-from-bottom-1 first:mt-3 last:mb-5 
        grid-cols-[auto_1fr]  
        [&_>_*]:col-start-1"
        data-role="user"
      >
        <UserMessageAttachments />

        <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
          <div className="aui-user-message-content rounded-3xl bg-muted px-5 py-2.5 break-words text-foreground text-start">
            <MessagePrimitive.Parts components={{ Text: CustomUserText }} />
          </div>
          <div className="aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2">
            <UserActionBar />
          </div>
        </div>

        <BranchPicker className="aui-user-branch-picker col-span-full col-start-1 row-start-3 -me-1 justify-end" />
      </div>
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" className="aui-user-action-bar-root flex flex-col items-end">
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="ویرایش" className="aui-user-action-edit hidden p-4">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <div className="aui-edit-composer-wrapper mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 px-2 first:mt-4">
      <ComposerPrimitive.Root className="aui-edit-composer-root ms-auto flex w-full max-w-7/8 flex-col rounded-xl bg-muted">
        <ComposerPrimitive.Input className="aui-edit-composer-input flex min-h-[60px] w-full resize-none bg-transparent p-4 text-foreground outline-none text-start" autoFocus />

        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center justify-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm" aria-label="لغو ویرایش">
              لغو
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm" aria-label="بروزرسانی پیام">
              بروزرسانی
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({ className, ...rest }) => {
  return (
    <BranchPickerPrimitive.Root hideWhenSingleBranch className={cn("aui-branch-picker-root ms-2 -me-2 inline-flex items-center text-xs text-muted-foreground", className)} {...rest}>
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="قبلی">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="بعدی">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
