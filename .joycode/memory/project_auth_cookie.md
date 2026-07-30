---
name: 登录会话 cookie 必须用 @supabase/ssr 写入
description: 招贤令登录后跳转被 middleware 拦回登录页的根因与约束
type: project
---

服务端登录/写会话 cookie 必须使用 `@supabase/ssr` 的 `createServerClient`，不能手写 `sb-<ref>-auth-token` 纯 JSON cookie。

**Why:** middleware 用 `createServerClient` + `getUser()` 校验身份。此前 `/api/auth/login` 手写 JSON 格式 cookie，与 ssr 期望的编码格式不兼容，`getUser()` 解析失败判定未登录，登录后跳转被拦回 /login（getSession 时代因直接读 cookie 侥幸生效，改 getUser 后暴露）。

**How to apply:** 任何服务端签发/刷新 Supabase 会话都走 `createServerClient` 的 cookies.getAll/setAll，返回时用 `{ headers: response.headers }` 合并；middleware 一律 `getUser()` 而非 `getSession()`。