"use client";

import dynamic from "next/dynamic";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useMemo } from "react";

// 1. Define the interface for the props passed to the dynamic component
export interface DynamicCanvasProps {
  data: any;
  onEdit: (newData: any) => void;
  isLocked: boolean;
}

interface CanvasRegistryProps extends DynamicCanvasProps {
  componentKey: string;
}

const CanvasLoading = () => (
  <div className="flex h-full w-full items-center justify-center text-muted-foreground gap-2">
    <Loader2 className="h-5 w-5 animate-spin" />
    <span className="text-sm">در حال بارگذاری ابزار...</span>
  </div>
);

const CanvasError = ({ name }: { name: string }) => (
  <div className="flex flex-col items-center justify-center h-full w-full bg-muted/10 text-muted-foreground p-6 text-center animate-in fade-in zoom-in-95 duration-200">
    <div className="bg-background rounded-full p-4 mb-4 shadow-sm border border-border">
      <AlertTriangle className="size-8 text-amber-500" />
    </div>
    <h3 className="font-semibold text-foreground text-lg mb-1">ابزار یافت نشد</h3>
    <p className="text-sm text-muted-foreground max-w-xs mb-4">
      کامپوننت رابط کاربری پیدا نشد:
    </p>
    <code className="text-xs font-mono bg-muted px-3 py-1.5 rounded border border-border text-foreground">
      {name}
    </code>
  </div>
);

export function CanvasRegistry({ componentKey, data, onEdit, isLocked }: CanvasRegistryProps) {
  
  const DynamicCanvas = useMemo(() => {
    if (!componentKey) return null;

    // Mapping legacy backend keys to filenames if necessary
    const keyMap: Record<string, string> = {
      "VANIA_PATIENT_JOURNEY": "PatientJourneyCanvas",
      "VANIA_PATIENT_MANAGER": "PatientManagerCanvas",
      // "CODE_EDITOR": "CodeEditorCanvas",
    };

    const fileName = keyMap[componentKey] || componentKey;

    // [FIX] Explicitly type the dynamic import using the Props interface
    return dynamic<DynamicCanvasProps>(
      () => import(`./renderers/${fileName}`)
        .then((mod: any) => {
            // [CRITICAL FIX] Handle Module Resolution
            // 1. Prefer default export
            if (mod.default) return mod.default;
            
            // 2. Fallback to named export matching the filename
            // (e.g. export function TradeDashboardCanvas)
            if (mod[fileName]) return mod[fileName];

            // 3. Last resort: First exported function
            const firstExport = Object.values(mod).find(e => typeof e === 'function');
            if (firstExport) return firstExport as any;

            throw new Error(`Module ${fileName} has no valid component export.`);
        })
        .catch(err => {
          console.error(`Failed to load canvas: ${fileName}`, err);
          // Return a component compatible with DynamicCanvasProps to show error
          return () => <CanvasError name={fileName} />;
        }),
      { 
        loading: () => <CanvasLoading />,
        ssr: false 
      }
    );
  }, [componentKey]);

  if (!componentKey) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <span className="text-sm">تنظیمات بوم نامعتبر است</span>
      </div>
    );
  }

  if (!DynamicCanvas) return <CanvasError name={componentKey} />;

  return (
    <DynamicCanvas 
      data={data} 
      onEdit={onEdit} 
      isLocked={isLocked} 
    />
  );
}