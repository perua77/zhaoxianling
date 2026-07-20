"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { USER_ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

const REGISTER_ROLES: UserRole[] = [
  "candidate",
  "recruiter",
  "interviewer",
  "referrer",
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("candidate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/home");
        router.refresh();
      } else {
        // 注册
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              phone,
              role,
            },
          },
        });
        if (error) throw error;

        // 如果注册成功且需要邮箱确认，data.user 存在但 session 为 null
        if (data.user && !data.session) {
          setError("注册成功！请检查邮箱完成验证后再登录。");
          setMode("login");
        } else if (data.session) {
          router.push("/home");
          router.refresh();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* 模式切换 */}
      <div className="mb-6 flex rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
          }}
          className={cn(
            "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
            mode === "login"
              ? "bg-background text-brand-green shadow-sm"
              : "text-muted-foreground"
          )}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register");
            setError(null);
          }}
          className={cn(
            "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
            mode === "register"
              ? "bg-background text-brand-green shadow-sm"
              : "text-muted-foreground"
          )}
        >
          注册
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <>
            <Input
              label="姓名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入姓名"
              required
            />
            <Input
              label="手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号"
              required
            />
          </>
        )}

        <Input
          label="邮箱"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="请输入邮箱"
          required
        />

        <Input
          label="密码"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "login" ? "请输入密码" : "至少 6 位"}
          minLength={6}
          required
        />

        {mode === "register" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              注册角色
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REGISTER_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "rounded-lg border py-2.5 text-sm font-medium transition-colors",
                    role === r
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-border text-muted-foreground hover:border-brand-green/30"
                  )}
                >
                  {USER_ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          fullWidth
          disabled={loading}
        >
          {loading ? (
            <LoadingSpinner size="sm" />
          ) : mode === "login" ? (
            "登录"
          ) : (
            "注册"
          )}
        </Button>
      </form>
    </div>
  );
}
