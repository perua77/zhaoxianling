---
name: trial_status 数据库枚举合法值
description: 招贤令 trials 表 trial_status 枚举的权威合法值及与应用状态语义的映射约定
type: project
---

DB 枚举 `trial_status` 的合法值为 `pending | confirmed | completed | cancelled`（通过 `SELECT enum_range(NULL::trial_status)` 确认，schema 文件里没有定义）。应用代码里试岗状态必须落在这四个值之内。

语义映射约定：`pending`=待开始，`confirmed`=进行中（旧代码里叫 active），`completed`=已完成，`cancelled`=已终止（旧代码里叫 terminated）。

**Why:** 曾出现 `invalid input value for enum trial_status: "active"` 报错——代码用 active/terminated，但 DB 枚举根本没有这两个值。修复方向是改代码对齐 DB，而非改 DB：`ALTER TYPE ... ADD VALUE` 在事务内不能立即生效且会被 PostgREST schema 缓存，还会污染干净的枚举。

**How to apply:**
- 写 trials 表 status 时只用上面四个值。
- 注意同名歧义：`terminated` 是合法的 **ApplicationStatus**（applications 表），但**不是** TrialStatus。改动时务必按 `.from()` 目标表区分——只改 trials 相关的 active→confirmed / terminated→cancelled，不要动 applications 表的 terminated。
- 前端状态映射对新旧键并存（confirmed+active、cancelled+terminated）以兜底潜在历史脏数据。