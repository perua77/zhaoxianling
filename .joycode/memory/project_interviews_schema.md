---
name: interviews表无round列（轮次为虚拟概念）
description: 招贤令 interviews 表没有 round 列，面试轮次是运行时动态计算的虚拟概念，切勿 insert/select round
type: project
---

interviews 表**没有 round 列**。面试"轮次"是虚拟概念——运行时按该 application 下非 cancelled 面试的数量/时间顺序动态计算（roundNo = 已有非取消面试数 + 1），仅用于组织通知文案 roundLabel。

**Why:** 曾在 applications API 的 schedule-interview 里 `insert({ ..., round: roundNo })` 并在 GET `.select(..., round, ...)`，导致 PostgREST 因列不存在返回 500，安排面试功能整体失效。

**How to apply:** 改 interviews 读写时，合法列包含 application_id/job_id/interviewer_id/scheduled_at/location/contact_person/contact_phone/status/result/evaluation/response_status/response_reason。**禁止** insert 或 select `round`。孤岛页 interviews/route.ts 的 schedule-interview 与 reschedule-interview 都不写 round，是权威参考。前端 UI 用 `interview.round ?? index+1` 兜底，round 恒为 undefined 时退化为 index+1，无害。