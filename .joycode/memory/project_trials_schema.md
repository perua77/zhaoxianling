---
name: trials表无scheduled_at列（时间字段是start_date/end_date）
description: 招贤令 trials 表没有 scheduled_at 列，排序/读写须用 start_date，误用会导致 PostgREST 静默失败使试岗数据整体丢失
type: project
---

trials 表的时间字段是 `start_date` / `end_date`（date/timestamptz），**没有 `scheduled_at` 列**（scheduled_at 是 interviews 表的列）。

Why: recruiter/applications/route.ts 的 GET 曾对 trials 查询写 `.order("scheduled_at")`，因列不存在导致 PostgREST 报错，`{ data: trials }` 返回 null 且未捕获 error，trialMap 全空 → 投递管理页所有卡片 `app.trials` 都是 []，试岗信息整体消失。

How to apply: 读写 trials 时合法列包含 id/application_id/job_id/interviewer_id/start_date/end_date/location/status/feedback/is_hired。排序用 start_date。禁止对 trials 使用 scheduled_at。孤岛页 interviews/route.ts 第127行 trials 查询无 order，是正确参考。