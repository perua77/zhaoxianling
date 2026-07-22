"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const ALLOWED_ROLES = ["recruiter", "interviewer", "referrer"];

interface RecruiterGuardProps {
  children: ReactNode;
}

export function RecruiterGuard({ children }: RecruiterGuardProps) {
  const { roles, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && roles) {
      const hasPermission = roles.some((role) =>
        ALLOWED_ROLES.includes(role)
      );

      if (!hasPermission) {
        router.push("/");
      }
    }
  }, [roles, loading, router]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">加载中...</div>;
  }

  if (!roles) {
    return null;
  }

  const hasPermission = roles.some((role) => ALLOWED_ROLES.includes(role));

  if (!hasPermission) {
    return null;
  }

  return <>{children}</>;
}