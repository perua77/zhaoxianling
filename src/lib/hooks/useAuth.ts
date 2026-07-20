"use client";

import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/types";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;

  /** 初始化：订阅 Supabase auth 状态变化 */
  init: () => () => void;
  /** 从 profiles 表拉取当前用户资料 */
  fetchProfile: (userId: string) => Promise<void>;
  /** 登出 */
  signOut: () => Promise<void>;
  /** 清空状态 */
  reset: () => void;
}

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient();
  }
  return _supabase;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  role: null,
  loading: true,
  error: null,

  init: () => {
    const client = getSupabase();
    // 订阅认证状态变化
    const { data: authListener } = client.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;

        set({ user: currentUser, loading: !!currentUser });

        if (currentUser) {
          await get().fetchProfile(currentUser.id);
        } else {
          set({ profile: null, role: null, loading: false });
        }
      }
    );

    // 返回取消订阅函数
    return () => {
      authListener.subscription.unsubscribe();
    };
  },

  fetchProfile: async (userId: string) => {
    try {
      set({ loading: true, error: null });

      const client = getSupabase();
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.warn("Profile fetch error:", error.message);
        set({ profile: null, role: "candidate" as UserRole });
        return;
      }

      const profileData = data as Profile;
      const primaryRole = profileData.roles?.[0] || "candidate";
      set({ profile: profileData, role: primaryRole as UserRole });
    } catch (err) {
      console.warn("Profile fetch exception:", err);
      set({
        profile: null,
        role: "candidate" as UserRole,
      });
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    try {
      const client = getSupabase();
      await client.auth.signOut();
      set({ user: null, profile: null, role: null, error: null });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "登出失败",
      });
    }
  },

  reset: () => {
    set({ user: null, profile: null, role: null, loading: false, error: null });
  },
}));
