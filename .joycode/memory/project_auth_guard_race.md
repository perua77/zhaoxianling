---
name: recruiter 区域白屏——cookie/localStorage 登录态双源不同步
description: >-
  招贤令 recruiter 冷启动白屏根因——middleware 认 cookie 已登录放行，但客户端 zustand 只读 localStorage
  认为未登录
type: project
---

middleware(src/middleware.ts) 用 @supabase/ssr cookie 的 getUser() 判登录；客户端 zustand store(src/lib/hooks/useAuth.ts) 的 init() 只从 localStorage(auth_user/auth_session) 恢复。两者是**不同来源**。

**Why:** 当 cookie session 有效但 localStorage 被清（换端口/过期清理）时，middleware 放行 dashboard 返回 200，但客户端 userId=null → RecruiterGuard return null 白屏，且 push('/login') 又被 middleware 因 cookie 已登录重定向回来，视觉上「白屏不跳转、连加载中都不显示」。

**How to apply:** 客户端登录态恢复必须能从 Supabase cookie 回退——init() 在 localStorage 为空时调用 createClient().auth.getUser()/getSession() 恢复 user 并 fetchProfile，期间 set loading=true。切勿只依赖 localStorage。RecruiterGuard 用 restoring=Boolean(userId)&&roles.length===0 区分「恢复中」与「无权限」。