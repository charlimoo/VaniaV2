"use client";

import "@assistant-ui/react-markdown/styles/dot.css";

import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import { type FC, memo, useState, Children, isValidElement } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { cn } from "@/lib/utils";

// --- UTILITY: Detect Direction based on content ---
const PERSIAN_CHAR_REGEX = /[\u0600-\u06FF]/;

/**
 * Recursively extracts text from React Children to determine direction.
 */
const getTextFromChildren = (children: React.ReactNode): string => {
  if (typeof children === "string") return children;
  if (typeof children === "number") return children.toString();
  
  if (Array.isArray(children)) {
    return children.map(getTextFromChildren).join("");
  }
  
  if (isValidElement(children) && children.props) {
    // @ts-ignore - basic prop access
    return getTextFromChildren(children.props.children);
  }
  
  return "";
};

/**
 * Returns 'rtl' if the content contains Persian/Arabic characters, otherwise 'ltr'.
 * Defaults to 'rtl' for this specific app if empty, to match the layout.
 */
const getDirection = (text: string): "rtl" | "ltr" => {
  if (!text || text.trim().length === 0) return "rtl"; // Default to RTL layout
  // If it has Persian characters, it's RTL. If purely Latin, it's LTR.
  return PERSIAN_CHAR_REGEX.test(text) ? "rtl" : "ltr";
};

// --- WRAPPER COMPONENT ---
// Automatically applies text-right/text-left based on content
const AutoDir = ({ 
  as: Component = "div", 
  className, 
  children, 
  ...props 
}: any) => {
  const text = getTextFromChildren(children);
  const dir = getDirection(text);
  
  return (
    <Component
      dir={dir}
      className={cn(
        className,
        dir === "rtl" ? "text-right" : "text-left font-sans" // Use standard sans for English
      )}
      {...props}
    >
      {children}
    </Component>
  );
};

const MarkdownTextImpl = () => {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      className="aui-md"
      components={defaultComponents}
    />
  );
};

export const MarkdownText = memo(MarkdownTextImpl);

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div 
      className="aui-code-header-root mt-4 flex items-center justify-between gap-4 rounded-t-lg bg-muted-foreground/15 px-4 py-2 text-sm font-semibold text-foreground dark:bg-muted-foreground/20"
      dir="ltr" 
    >
      <span className="aui-code-header-language lowercase [&>span]:text-xs font-mono">
        {language}
      </span>
      <TooltipIconButton tooltip="کپی" onClick={onCopy}>
        {!isCopied && <CopyIcon />}
        {isCopied && <CheckIcon />}
      </TooltipIconButton>
    </div>
  );
};

const useCopyToClipboard = ({
  copiedDuration = 3000,
}: {
  copiedDuration?: number;
} = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copyToClipboard = (value: string) => {
    if (!value) return;

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };

  return { isCopied, copyToClipboard };
};

const defaultComponents = memoizeMarkdownComponents({
  // HEADERS: Auto-detect direction
  h1: ({ className, ...props }) => (
    <AutoDir
      as="h1"
      className={cn(
        "aui-md-h1 mb-8 scroll-m-20 text-2xl font-extrabold tracking-tight last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <AutoDir
      as="h2"
      className={cn(
        "aui-md-h2 mt-8 mb-4 scroll-m-20 text-1xl leading-7 font-bold tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <AutoDir
      as="h3"
      className={cn(
        "aui-md-h3 mt-6 mb-4 scroll-m-20 text-1xl leading-7 font-semibold tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <AutoDir
      as="h4"
      className={cn(
        "aui-md-h4 mt-6 mb-4 scroll-m-20 text-xl font-semibold tracking-tight first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h5: ({ className, ...props }) => (
    <AutoDir
      as="h5"
      className={cn(
        "aui-md-h5 my-4 text-lg font-semibold first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h6: ({ className, ...props }) => (
    <AutoDir
      as="h6"
      className={cn(
        "aui-md-h6 my-4 font-semibold first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  // PARAGRAPH: Auto-detect direction
  p: ({ className, ...props }) => (
    <AutoDir
      as="p"
      className={cn(
        "aui-md-p mt-5 mb-5 leading-7 first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "aui-md-a font-medium text-primary underline underline-offset-4",
        className,
      )}
      {...props}
    />
  ),
  // BLOCKQUOTE: Auto-detect direction (border and padding flip handled by AutoDir + Logical CSS or specific checks)
  blockquote: ({ className, children, ...props }) => {
    // We determine direction manually here to apply specific border styles
    const text = getTextFromChildren(children);
    const dir = getDirection(text);
    
    return (
      <blockquote
        dir={dir}
        className={cn(
          "aui-md-blockquote italic",
          dir === "rtl" ? "border-r-2 pr-6 text-right" : "border-l-2 pl-6 text-left",
          className
        )}
        {...props}
      >
        {children}
      </blockquote>
    )
  },
  // LISTS: Auto-detect direction
  ul: ({ className, ...props }) => (
    <AutoDir
      as="ul"
      className={cn(
        // Use logical margins/padding if supported, or rely on AutoDir class
        "aui-md-ul my-5 mr-6 list-disc [&>li]:mt-2", 
        className
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <AutoDir
      as="ol"
      className={cn(
        "aui-md-ol my-5 mr-6 list-decimal [&>li]:mt-2",
        className
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("aui-md-hr my-5 border-b", className)} {...props} />
  ),
  // TABLE: Force Right alignment for Persian app, but let content decide if needed
  table: ({ className, ...props }) => (
    <table
      className={cn(
        "aui-md-table my-5 w-full border-separate border-spacing-0 overflow-y-auto text-right",
        className,
      )}
      {...props}
    />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "aui-md-th bg-muted px-4 py-2 text-right font-bold first:rounded-tr-lg last:rounded-tl-lg [&[align=center]]:text-center [&[align=right]]:text-left",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        "aui-md-td border-b border-r px-4 py-2 text-right last:border-l [&[align=center]]:text-center [&[align=right]]:text-left",
        className,
      )}
      {...props}
    />
  ),
  tr: ({ className, ...props }) => (
    <tr
      className={cn(
        "aui-md-tr m-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-br-lg [&:last-child>td:last-child]:rounded-bl-lg",
        className,
      )}
      {...props}
    />
  ),
  sup: ({ className, ...props }) => (
    <sup
      className={cn("aui-md-sup [&>a]:text-xs [&>a]:no-underline", className)}
      {...props}
    />
  ),
  // CODE BLOCKS: Always LTR
  pre: ({ className, ...props }) => (
    <pre
      dir="ltr"
      className={cn(
        "aui-md-pre overflow-x-auto !rounded-t-none rounded-b-lg bg-black p-4 text-white text-left font-mono",
        className,
      )}
      {...props}
    />
  ),
  // INLINE CODE: Always LTR
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code
        dir="ltr"
        className={cn(
          !isCodeBlock &&
            "aui-md-inline-code rounded border bg-muted font-semibold font-mono px-1 mx-1",
          className,
        )}
        {...props}
      />
    );
  },
  CodeHeader,
});