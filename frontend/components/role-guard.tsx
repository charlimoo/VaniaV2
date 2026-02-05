"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import { Loader2 } from "lucide-react";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[]; // e.g. ['doctor']
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // If user is logged in BUT their role is not in the allowed list
      if (user && user.role_slug && !allowedRoles.includes(user.role_slug)) {
        // Redirect to main dashboard
        router.replace("/dashboard");
      }
    }
  }, [user, loading, allowedRoles, router]);

  if (loading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Use optional chaining or check to ensure user exists before checking role
  if (!user || !user.role_slug || !allowedRoles.includes(user.role_slug)) {
    return null; // Don't render protected content while redirecting
  }

  return <>{children}</>;
}