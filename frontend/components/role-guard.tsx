"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import { Loader2 } from "lucide-react";
import { normalizeRoleSlug } from "@/lib/roles";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[]; // e.g. ['doctor']
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, loading } = useUser();
  const router = useRouter();
  const normalizedAllowedRoles = allowedRoles.map((r) => normalizeRoleSlug(r) || r);
  const normalizedUserRole = normalizeRoleSlug(user?.role_slug);

  useEffect(() => {
    if (!loading) {
      // If user is logged in BUT their role is not in the allowed list
      if (user && normalizedUserRole && !normalizedAllowedRoles.includes(normalizedUserRole)) {
        // Redirect to main dashboard
        router.replace("/dashboard");
      }
    }
  }, [user, loading, normalizedAllowedRoles, normalizedUserRole, router]);

  if (loading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Use optional chaining or check to ensure user exists before checking role
  if (!user || !normalizedUserRole || !normalizedAllowedRoles.includes(normalizedUserRole)) {
    return null; // Don't render protected content while redirecting
  }

  return <>{children}</>;
}
