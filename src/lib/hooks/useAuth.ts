"use client";

import { create } from "zustand";
import type { Profile, UserRole } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  roles: UserRole[];
}

interface AuthState {
  user: AuthUser | null;
  profile: Profile | null;
  role: UserRole | null;
  session: Session | null;
  loading: boolean;
  error: string | null;

  init: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (phone: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string; requireLogin?: boolean }>;
  fetchProfile: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  reset: () => void;
}

const STORAGE_KEY = "auth_session";
const USER_KEY = "auth_user";

function loadFromStorage(): { user: AuthUser | null; session: Session | null } {
  if (typeof window === "undefined") {
    return { user: null, session: null };
  }
  
  try {
    const userStr = localStorage.getItem(USER_KEY);
    const sessionStr = localStorage.getItem(STORAGE_KEY);
    
    const user = userStr ? JSON.parse(userStr) : null;
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    
    if (session) {
      const now = Date.now();
      if (session.expires_at && now > session.expires_at) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(USER_KEY);
        return { user: null, session: null };
      }
    }
    
    return { user, session };
  } catch {
    return { user: null, session: null };
  }
}

function saveToStorage(user: AuthUser, session: Session) {
  if (typeof window === "undefined") return;
  
  const sessionWithExpiry = {
    ...session,
    expires_at: Date.now() + (session.expires_in * 1000) - 60000,
  };
  
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionWithExpiry));
}

function clearStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_KEY);
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  role: null,
  session: null,
  loading: false,
  error: null,

  init: () => {
    const { user, session } = loadFromStorage();

    if (user && session) {
      set({
        user,
        session,
        role: user.roles?.[0] || "candidate",
      });

      const supabase = createClient();
      supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: "bearer",
        expires_in: session.expires_in,
        expires_at: Math.floor(Date.now() / 1000) + session.expires_in,
      }).catch((err: unknown) => {
        console.warn("Failed to restore Supabase session:", err);
      });

      // 恢复登录态后主动拉取 profile，避免刷新/重新进入时 profile 为空
      // （否则个人中心显示空白、投递页无法自动填充）
      get().fetchProfile(user.id);
      return;
    }

    // localStorage 无登录态，但 Supabase cookie 可能仍有效（middleware 用 cookie 判断，
    // 若不从 cookie 回退恢复，会出现「服务端放行 200、客户端却认为未登录 → 白屏」）。
    set({ loading: true });
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(async ({ data: { user: authUser } }: Awaited<ReturnType<typeof supabase.auth.getUser>>) => {
        if (!authUser) {
          set({ loading: false });
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const sess = sessionData.session;

        const restoredUser: AuthUser = {
          id: authUser.id,
          email: authUser.email || "",
          fullName: (authUser.user_metadata?.full_name as string) || "",
          phone: authUser.phone || "",
          roles: [],
        };
        const restoredSession: Session | null = sess
          ? {
              access_token: sess.access_token,
              refresh_token: sess.refresh_token,
              expires_in: sess.expires_in ?? 3600,
            }
          : null;

        set({ user: restoredUser, session: restoredSession });
        if (restoredSession) {
          saveToStorage(restoredUser, restoredSession);
        }
        await get().fetchProfile(authUser.id);
        set({ loading: false });
      })
      .catch((err: unknown) => {
        console.warn("Failed to restore session from cookie:", err);
        set({ loading: false });
      });
  },

  login: async (email: string, password: string) => {
    set({ loading: true, error: null });
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.error || "登录失败";
        set({ error: errorMsg, loading: false });
        return { success: false, error: errorMsg };
      }

      const { user, session } = data;
      saveToStorage(user, session);
      
      set({ 
        user, 
        session,
        role: user.roles?.[0] || "candidate",
        loading: false,
        error: null 
      });

      const supabase = createClient();
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: "bearer",
        expires_in: session.expires_in,
        expires_at: Math.floor(Date.now() / 1000) + session.expires_in,
      }).catch((err: unknown) => {
        console.warn("Failed to sync Supabase session:", err);
      });

      get().fetchProfile(user.id);

      return { success: true };
    } catch (err: any) {
      const errorMsg = err?.message?.includes("Failed to fetch") 
        ? "网络连接失败，请检查网络后重试"
        : "登录请求失败，请稍后重试";
      set({ error: errorMsg, loading: false });
      return { success: false, error: errorMsg };
    }
  },

  register: async (phone: string, password: string, fullName: string) => {
    set({ loading: true, error: null });
    
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, password, fullName }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.error || "注册失败";
        set({ error: errorMsg, loading: false });
        return { success: false, error: errorMsg };
      }

      set({ loading: false, error: null });
      return { success: true, requireLogin: data.requireLogin };
    } catch (err: any) {
      const errorMsg = "注册请求失败，请稍后重试";
      set({ error: errorMsg, loading: false });
      return { success: false, error: errorMsg };
    }
  },

  fetchProfile: async (userId: string) => {
    const { session } = get();
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    // 网络抖动容错：最多重试 3 次（指数退避），避免瞬时失败导致 profile 为空
    const MAX_RETRY = 3;
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        const response = await fetch(`/api/profile/${userId}`, { headers });

        if (!response.ok) {
          console.warn(`Profile fetch failed (attempt ${attempt}):`, response.status);
          if (attempt < MAX_RETRY) {
            await new Promise((r) => setTimeout(r, attempt * 400));
            continue;
          }
          return;
        }

        const data = await response.json();
        if (data.success && data.profile) {
          const profileData = data.profile as Profile;
          const primaryRole = profileData.roles?.[0] || "candidate";
          set({ profile: profileData, role: primaryRole as UserRole });
        }
        return;
      } catch (err) {
        console.warn(`Profile fetch exception (attempt ${attempt}):`, err);
        if (attempt < MAX_RETRY) {
          await new Promise((r) => setTimeout(r, attempt * 400));
        }
      }
    }
  },

  signOut: async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Supabase sign out error:", err);
    }
    
    clearStorage();
    set({ 
      user: null, 
      profile: null, 
      role: null, 
      session: null,
      error: null 
    });
  },

  reset: () => {
    clearStorage();
    set({ 
      user: null, 
      profile: null, 
      role: null, 
      session: null,
      loading: false, 
      error: null 
    });
  },
}));

export function getAuthHeaders(): Record<string, string> {
  const { session } = useAuth.getState();
  if (session?.access_token) {
    return {
      "Authorization": `Bearer ${session.access_token}`,
    };
  }
  return {};
}
