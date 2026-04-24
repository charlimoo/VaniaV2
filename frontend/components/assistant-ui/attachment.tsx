"use client";

import { PropsWithChildren, useEffect, useMemo, useState, type FC } from "react";
import Image from "next/image";
import { XIcon, PlusIcon, FileImage, FileText } from "lucide-react";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAssistantState,
  useAssistantApi,
} from "@assistant-ui/react";
import { useShallow } from "zustand/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { cn } from "@/lib/utils";

const useFileSrc = (file: File | undefined) => {
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!file) {
      setSrc(undefined);
      return;
    }

    if (!((file as any) instanceof Blob) && !((file as any) instanceof File)) {
        return; 
    }
    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return src;
};

const isPdfName = (name?: string) => !!name?.toLowerCase().endsWith(".pdf");

const useAttachmentPreviewData = () => {
  const attachment = useAssistantState(({ attachment }) => attachment);
  const localSrc = useFileSrc(attachment.file);
  const imageSrc = attachment.content?.find((c) => c.type === "image")?.image;
  const contentType = attachment.file?.type || attachment.contentType || "application/octet-stream";
  const isImage = attachment.type === "image";
  const isPdf = contentType.includes("pdf") || isPdfName(attachment.name);
  const src = localSrc ?? imageSrc;

  return useMemo(
    () => ({
      src,
      isImage,
      isPdf,
      name: attachment.name,
      contentType,
      isPreviewable: Boolean(src && (isImage || isPdf)),
    }),
    [attachment.name, contentType, isImage, isPdf, src],
  );
};

type AttachmentPreviewProps = {
  src: string;
};

const AttachmentPreview: FC<AttachmentPreviewProps> = ({ src }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <Image
      src={src}
      alt="Image Preview"
      width={1}
      height={1}
      className={
        isLoaded
          ? "aui-attachment-preview-image-loaded block h-auto max-h-[80vh] w-auto max-w-full object-contain"
          : "aui-attachment-preview-image-loading hidden"
      }
      onLoadingComplete={() => setIsLoaded(true)}
      priority={false}
    />
  );
};

const AttachmentPreviewDialog: FC<PropsWithChildren> = ({ children }) => {
  const { src, isImage, isPdf, name, isPreviewable } = useAttachmentPreviewData();

  if (!src || !isPreviewable) return children;

  return (
    <Dialog>
      <DialogTrigger
        className="aui-attachment-preview-trigger cursor-pointer transition-colors hover:bg-accent/50"
        asChild
      >
        {children}
      </DialogTrigger>
      <DialogContent className="aui-attachment-preview-dialog-content p-2 sm:max-w-3xl [&_svg]:text-background [&>button]:rounded-full [&>button]:bg-foreground/60 [&>button]:p-1 [&>button]:opacity-100 [&>button]:!ring-0 [&>button]:hover:[&_svg]:text-destructive">
        <DialogTitle className="aui-sr-only sr-only">
          Attachment Preview
        </DialogTitle>
        <div className="aui-attachment-preview relative mx-auto flex max-h-[80dvh] w-full items-center justify-center overflow-hidden bg-background">
          {isImage ? <AttachmentPreview src={src} /> : null}
          {isPdf ? (
            <iframe
              src={src}
              title={name || "PDF Preview"}
              className="h-[80dvh] w-full rounded-lg border-0 bg-background"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AttachmentThumb: FC = () => {
  const { src, isImage, isPdf, name } = useAttachmentPreviewData();

  return (
    <div className="h-full w-full">
      {isImage && src ? (
        <Avatar className="aui-attachment-tile-avatar h-full w-full rounded-none">
          <AvatarImage
            src={src}
            alt="Attachment preview"
            className="aui-attachment-tile-image object-cover"
          />
          <AvatarFallback delayMs={200}>
            <FileImage className="aui-attachment-tile-fallback-icon size-8 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/70 px-2 text-center">
          <div
            className={cn(
              "rounded-full p-2",
              isPdf ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300" : "bg-background text-muted-foreground"
            )}
          >
            <FileText className="size-5" />
          </div>
          <div className="max-w-full truncate text-[10px] font-medium">
            {isPdf ? "PDF" : "FILE"}
          </div>
          {name ? <div className="max-w-full truncate text-[9px] text-muted-foreground">{name}</div> : null}
        </div>
      )}
    </div>
  );
};

const AttachmentUI: FC = () => {
  const api = useAssistantApi();
  const isComposer = api.attachment.source === "composer";

  const { isImage, isPdf } = useAttachmentPreviewData();
  const typeLabel = useAssistantState(({ attachment }) => {
    const type = attachment.type;
    switch (type) {
      case "image":
        return "تصویر";
      case "document":
        return "سند";
      case "file":
        return attachment.contentType?.includes("pdf") || isPdfName(attachment.name) ? "PDF" : "فایل";
      default:
        const _exhaustiveCheck: never = type;
        throw new Error(`Unknown attachment type: ${_exhaustiveCheck}`);
    }
  });

  return (
    <Tooltip>
      <AttachmentPrimitive.Root
        className={cn(
          "aui-attachment-root relative",
          isImage &&
            "aui-attachment-root-composer only:[&>#attachment-tile]:size-24",
        )}
      >
        <AttachmentPreviewDialog>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "aui-attachment-tile size-14 cursor-pointer overflow-hidden rounded-[14px] border bg-muted transition-opacity hover:opacity-75",
                isComposer &&
                  "aui-attachment-tile-composer border-foreground/20",
                isPdf && "border-red-200/80 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/20"
              )}
              role="button"
              id="attachment-tile"
              aria-label={`${typeLabel} attachment`}
            >
              <AttachmentThumb />
            </div>
          </TooltipTrigger>
        </AttachmentPreviewDialog>
        {isComposer && <AttachmentRemove />}
      </AttachmentPrimitive.Root>
      <TooltipContent side="top">
        <div className="text-right">
          <div><AttachmentPrimitive.Name /></div>
          <div className="text-[10px] text-muted-foreground">{typeLabel}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

const AttachmentRemove: FC = () => {
  return (
    <AttachmentPrimitive.Remove asChild>
      <TooltipIconButton
        tooltip="Remove file"
        className="aui-attachment-tile-remove absolute top-1.5 right-1.5 size-3.5 rounded-full bg-white text-muted-foreground opacity-100 shadow-sm hover:!bg-white [&_svg]:text-black hover:[&_svg]:text-destructive"
        side="top"
      >
        <XIcon className="aui-attachment-remove-icon size-3 dark:stroke-[2.5px]" />
      </TooltipIconButton>
    </AttachmentPrimitive.Remove>
  );
};

export const UserMessageAttachments: FC = () => {
  return (
    <div className="aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2">
      <MessagePrimitive.Attachments components={{ Attachment: AttachmentUI }} />
    </div>
  );
};

export const ComposerAttachments: FC = () => {
  return (
    <div className="aui-composer-attachments mb-2 flex w-full flex-row items-center gap-2 overflow-x-auto px-1.5 pt-0.5 pb-1 empty:hidden">
      <ComposerPrimitive.Attachments
        components={{ Attachment: AttachmentUI }}
      />
    </div>
  );
};

export const ComposerAddAttachment: FC = () => {
  return (
    <ComposerPrimitive.AddAttachment asChild>
      <TooltipIconButton
        tooltip="افزودن فایل"
        side="bottom"
        variant="ghost"
        size="icon"
        className="aui-composer-add-attachment size-[34px] rounded-full p-1 text-xs font-semibold hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30"
        aria-label="Add Attachment"
      >
        <PlusIcon className="aui-attachment-add-icon size-5 stroke-[1.5px]" />
      </TooltipIconButton>
    </ComposerPrimitive.AddAttachment>
  );
};
