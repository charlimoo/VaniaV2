// start of frontend/components/assistant-ui/thread.tsx
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
  RefreshCwIcon,
  Square,
  FileCheck,
  Lock,
  Sparkles,
  Zap
} from "lucide-react";

import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAssistantState,
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
import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";

import { cn } from "@/lib/utils";
import { ToolStack } from "@/components/assistant-ui/tool-stack";
import { ServiceSuggestion, DemoConfig } from "@/lib/types";
import { APP_CONFIG } from "@/lib/config";
import ShinyText from '@/components/react-bits/ShinyText';
import { VoiceInput } from "./voice-input";

// [NEW] Import the Patient Selector (Ensure this component exists in your project)
import { PatientSelector } from "@/components/chat/PatientSelector";

interface ThreadProps {
  suggestions?: ServiceSuggestion[];
  showVoiceInput?: boolean;
  isPreviewMode?: boolean;
  demoConfig?: DemoConfig;
  currentUsage?: number;
  capabilities?: string[]; // [NEW] Added capabilities prop
}

// ============================================================================
// Custom Text Renderer (Masks JSON Form Data & System Actions)
// ============================================================================
const CustomUserText: FC<any> = (props) => {
  const rawText = props.part?.text || props.text || "";
  const text = rawText.trim();

  if (!text) return null;

  let isSystemAction = false;

  // 1. Check for the System Action tags (Old & New patterns)
  if (text.startsWith("[System Action]") || text.startsWith("[System:")) {
    isSystemAction = true;
  }
  // 2. Fallback: check if the content is pure JSON (often from a form)
  else if (text.startsWith("{") && text.endsWith("}")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        isSystemAction = true;
      }
    } catch {
      // ignore
    }
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

// ============================================================================
// Memoized Limit Banner
// ============================================================================
const LimitBanner = memo(({ 
    isPreviewMode, 
    userMsgCount, 
    demoConfig,
    currentUsage = 0 
}: { 
    isPreviewMode: boolean; 
    userMsgCount: number; 
    demoConfig?: DemoConfig;
    currentUsage?: number;
}) => {
    if (!isPreviewMode || !demoConfig || demoConfig.message_limit_scope === 'NONE') {
      return null;
    }

    const limit = demoConfig.message_limit_count;
    const scope = demoConfig.message_limit_scope;
    
    let used = 0;
    let label = "";

    if (scope === 'SESSION') {
        used = userMsgCount;
        label = `پیام در این گفتگو`;
    } else {
        used = currentUsage; 
        label = scope === 'DAILY' ? `پیام امروز` : `پیام کلی`;
    }

    const percent = Math.min((used / limit) * 100, 100);
    const isFull = used >= limit;

    return (
        <div className="mx-auto w-full max-w-[var(--thread-max-width)] mb-4 px-4 animate-in slide-in-from-bottom-2 fade-in duration-500">
            <div className={cn(
              "relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 shadow-sm",
              isFull 
                ? "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-900/50" 
                : "bg-background/60 backdrop-blur-md border-border/50"
            )}>
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
                            isFull ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-primary"
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
});
LimitBanner.displayName = "LimitBanner";

// ============================================================================
// Main Thread Component
// ============================================================================
export const Thread: FC<ThreadProps> = ({ 
  suggestions = [], 
  showVoiceInput = true,
  isPreviewMode = false,
  demoConfig,
  currentUsage,
  capabilities = [] // [NEW] Accept capabilities
}) => {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
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
              capabilities={capabilities} // [NEW] Pass capabilities
            />
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </MotionConfig>
    </LazyMotion>
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
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="aui-thread-welcome-message-motion-1 text-2xl font-semibold"
          >
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
          <ThreadPrimitive.Suggestion
            prompt={suggestion.prompt}
            send
            asChild
          >
            <Button
              variant="ghost"
              className="aui-thread-welcome-suggestion h-auto w-full flex-1 flex-wrap items-start justify-start gap-1 rounded-3xl border px-5 py-4 text-start text-sm @md:flex-col dark:hover:bg-accent/60"
            >
              <span className="aui-thread-welcome-suggestion-text-1 font-medium w-full">
                {suggestion.title}
              </span>
              <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground w-full">
                {suggestion.subtitle}
              </span>
            </Button>
          </ThreadPrimitive.Suggestion>
        </m.div>
      ))}
    </div>
  );
};

// ============================================================================
// Composer (Input Area)
// ============================================================================
const Composer: FC<{ 
  showVoiceInput: boolean; 
  isPreviewMode: boolean; 
  demoConfig?: DemoConfig;
  currentUsage?: number;
  capabilities: string[];
}> = ({ showVoiceInput, isPreviewMode, demoConfig, currentUsage = 0, capabilities }) => {
  const messages = useThread((t) => t.messages);
  const userMsgCount = React.useMemo(() => messages.filter(m => m.role === 'user').length, [messages]);
  
  let isLocked = false;
  if (isPreviewMode && demoConfig && demoConfig.message_limit_scope !== 'NONE') {
      const limit = demoConfig.message_limit_count;
      if (demoConfig.message_limit_scope === 'SESSION') {
          if (userMsgCount >= limit) isLocked = true;
      } else {
          if (currentUsage >= limit) isLocked = true;
      }
  }

  return (
    <div className="aui-composer-wrapper sticky bottom-0 mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 overflow-visible rounded-t-3xl bg-background pb-4 md:pb-6">
      <ThreadScrollToBottom />
      
      <LimitBanner 
        isPreviewMode={isPreviewMode} 
        userMsgCount={userMsgCount}
        demoConfig={demoConfig}
        currentUsage={currentUsage}
      />

      <ComposerPrimitive.Root className={cn(
        "aui-composer-root group/input-group relative flex w-full flex-col rounded-3xl border border-input bg-background px-1 pt-2 shadow-sm transition-[color,box-shadow,opacity] duration-300 outline-none has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-[3px] has-[textarea:focus-visible]:ring-ring/20 dark:bg-background",
        isLocked && "opacity-50 pointer-events-none grayscale border-dashed bg-muted/30"
      )}>
        
        <ComposerAttachments />
        
        <ComposerPrimitive.Input
          placeholder={isLocked ? "ظرفیت استفاده از دمو به پایان رسیده است." : APP_CONFIG.TEXT.CHAT_INPUT_PLACEHOLDER}
          disabled={isLocked}
          className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0 text-start disabled:cursor-not-allowed"
          rows={1}
          autoFocus
          aria-label="ورودی پیام"
        />
        
        <ComposerAction 
          showVoiceInput={showVoiceInput} 
          isPreviewMode={isPreviewMode} 
          isLocked={isLocked}
          capabilities={capabilities} // [NEW]
        />
      </ComposerPrimitive.Root>
    </div>
  );
};

// ============================================================================
// Composer Action (Buttons)
// ============================================================================
const ComposerAction: FC<{ 
  showVoiceInput: boolean; 
  isPreviewMode: boolean; 
  isLocked: boolean; 
  capabilities: string[];
}> = ({ showVoiceInput, isPreviewMode, isLocked, capabilities }) => {
  
  // [NEW] Check for Doctor capability
  const showPatientSelector = capabilities.includes("vania_doctor");

  return (
    <div className="aui-composer-action-wrapper relative mx-1 mt-2 mb-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        
        <div className={cn("transition-opacity", isPreviewMode && "opacity-30 pointer-events-none")}>
           <ComposerAddAttachment />
        </div>

        {/* [NEW] Conditionally Render Patient Selector */}
        {showPatientSelector && (
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

      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip={isLocked ? "قفل شده" : "ارسال پیام"}
            side="bottom"
            type="submit"
            variant="default"
            size="icon"
            disabled={isLocked}
            className="aui-composer-send size-[34px] rounded-full p-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="ارسال پیام"
          >
            {isLocked ? <Lock className="size-4" /> : <ArrowUpIcon className="aui-composer-send-icon size-5" />}
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>

      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-cancel size-[34px] rounded-full border border-muted-foreground/60 hover:bg-primary/75 dark:border-muted-foreground/90"
            aria-label="توقف تولید"
          >
            <Square className="aui-composer-cancel-icon size-3.5 fill-white dark:fill-black" />
          </Button>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
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
        <ShinyText
          speed={1.5}
          delay={0.3}
          color="#737373"
          shineColor="#ffffff"
          spread={120}
          yoyo={false}
          pauseOnHover={false}
          direction="right"
          text="در حال پردازش..."
        />
      </span>
    </div>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <div
        className="aui-assistant-message-root relative mx-auto w-full max-w-[var(--thread-max-width)] animate-in py-4 duration-150 ease-out fade-in slide-in-from-bottom-1 last:mb-24"
        data-role="assistant"
      >
        <div className="aui-assistant-message-content mx-2 leading-7 break-words text-foreground text-start">
          <MessagePrimitive.Parts
            components={{
              Text: MarkdownText,
              Reasoning: Reasoning,
              ReasoningGroup: ReasoningGroup,
              tools: { Fallback: ToolStack } 
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
            <MessagePrimitive.Parts 
              components={{ 
                Text: CustomUserText 
              }} 
            />
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
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="ویرایش" className="aui-user-action-edit p-4">
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
        <ComposerPrimitive.Input
          className="aui-edit-composer-input flex min-h-[60px] w-full resize-none bg-transparent p-4 text-foreground outline-none text-start"
          autoFocus
        />

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

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root ms-2 -me-2 inline-flex items-center text-xs text-muted-foreground",
        className,
      )}
      {...rest}
    >
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
// end of frontend/components/assistant-ui/thread.tsx