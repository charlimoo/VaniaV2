// frontend/components/billing/WalletSkeleton.tsx

import { Skeleton } from "@/components/ui/skeleton";

// Define the props for the component
interface WalletSkeletonProps {
    hasPlan: boolean;
}

export function WalletSkeleton({ hasPlan }: WalletSkeletonProps) {
  // If the user has a plan, show a two-column layout skeleton
  if (hasPlan) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Skeleton className="h-[350px] w-full rounded-xl" />
        </div>
        <div className="lg:col-span-1">
          <Skeleton className="h-[350px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Otherwise, show the single, narrow card skeleton
  return (
    <div className="lg:col-span-3">
      <Skeleton className="h-[280px] w-full max-w-md mx-auto rounded-xl" />
    </div>
  );
}