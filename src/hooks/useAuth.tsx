"use client";

import { useAuth as useAuthStore } from "@/lib/hooks/useAuth";

interface AuthState {
  userId: string | null;
  roles: string[];
  fullName: string | null;
  phone: string | null;
  age: number | null;
  gender: string | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const { user, profile, loading } = useAuthStore();

  return {
    userId: user?.id || null,
    roles: profile?.roles || [],
    fullName: profile?.full_name || null,
    phone: profile?.phone || null,
    age: profile?.age || null,
    gender: profile?.gender || null,
    loading,
  };
}