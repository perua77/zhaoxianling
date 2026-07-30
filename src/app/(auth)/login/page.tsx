"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { cn } from "@/lib/utils";
import { getHomePathByRoles } from "@/lib/auth-redirect";

type Tab = "candidate" | "admin";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("candidate");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  
  const { login, register, loading, error, reset } = useAuth();

  const validatePhone = (value: string) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!value) {
      return "请输入手机号";
    }
    if (!phoneRegex.test(value)) {
      return "请输入正确的11位手机号";
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    
    // 清除之前的错误信息
    if (error) {
      useAuth.setState({ error: null });
    }

    if (tab === "candidate") {
      const validationError = validatePhone(phone);
      if (validationError) {
        setPhoneError(validationError);
        return;
      }

      if (mode === "login") {
        const result = await login(`${phone}@zhaoxianling.cn`, password);
        if (result.success) {
          router.push(getHomePathByRoles(useAuth.getState().user?.roles || []));
        }
      } else {
        const result = await register(phone, password, fullName);
        if (result.success) {
          if (result.requireLogin) {
            alert("注册成功！请使用手机号登录");
            setMode("login");
            setPhone(phone);
          } else {
            router.push("/home");
          }
        }
      }
    } else {
      if (!email || !password) {
        useAuth.setState({ error: "请填写邮箱和密码" });
        return;
      }
      
      const result = await login(email, password);
      if (result.success) {
        const state = useAuth.getState();
        const roles = state.user?.roles || [];

        router.push(getHomePathByRoles(roles));
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-green mb-2">招贤令</h1>
          <p className="text-muted-foreground">招聘平台</p>
        </div>

        <div className="rounded-xl border bg-background p-6 shadow-lg">
          <div className="mb-6 flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => {
                setTab("candidate");
                setMode("login");
                reset();
                setPhoneError(null);
              }}
              className={cn(
                "flex-1 rounded-md py-2.5 text-sm font-medium transition-colors",
                tab === "candidate"
                  ? "bg-background text-brand-green shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              候选人
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("admin");
                setMode("login");
                reset();
              }}
              className={cn(
                "flex-1 rounded-md py-2.5 text-sm font-medium transition-colors",
                tab === "admin"
                  ? "bg-background text-brand-green shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              管理端
            </button>
          </div>

          {tab === "candidate" && mode === "register" && (
            <div className="mb-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3">
              <p className="text-sm text-orange-700 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <strong>重要提示：</strong>手机号填写错误将导致招聘方无法联系您，请仔细核对！
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "candidate" ? (
              <>
                {mode === "register" && (
                  <Input
                    label="姓名"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="请输入真实姓名"
                    required
                  />
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    手机号 *
                  </label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, ""));
                      setPhoneError(null);
                    }}
                    placeholder="请输入11位手机号"
                    required
                    className={phoneError ? "border-red-500 focus:ring-red-500" : ""}
                  />
                  {phoneError && (
                    <p className="mt-1 text-xs text-red-500">{phoneError}</p>
                  )}
                </div>

                <Input
                  label="密码"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "login" ? "请输入密码" : "至少 6 位"}
                  minLength={6}
                  required
                />

                {mode === "login" ? (
                  <Button type="submit" variant="primary" fullWidth disabled={loading}>
                    {loading ? <LoadingSpinner size="sm" /> : "登录"}
                  </Button>
                ) : (
                  <>
                    <Button type="submit" variant="primary" fullWidth disabled={loading}>
                      {loading ? <LoadingSpinner size="sm" /> : "注册"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        reset();
                      }}
                      className="w-full py-2 text-sm text-brand-green hover:text-brand-green-dark transition-colors"
                    >
                      已有账号？立即登录
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
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
                  placeholder="请输入密码"
                  minLength={6}
                  required
                />

                <Button type="submit" variant="primary" fullWidth disabled={loading}>
                  {loading ? <LoadingSpinner size="sm" /> : "登录"}
                </Button>

                <p className="text-center text-xs text-muted-foreground mt-4">
                  管理端账号由系统管理员创建
                </p>
              </>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            {tab === "candidate" && mode === "login" && (
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  reset();
                }}
                className="w-full py-2 text-sm text-brand-green hover:text-brand-green-dark transition-colors"
              >
                还没有账号？立即注册
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
