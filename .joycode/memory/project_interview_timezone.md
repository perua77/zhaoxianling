---
name: 面试时间时区存储约定
description: 招贤令面试 scheduled_at 存储/展示时区约定——datetime-local 需转 UTC 入库，展示统一 Asia/Shanghai
type: project
---

面试时间 `scheduled_at` 必须以 UTC ISO 字符串入库，展示端统一用 `toLocaleString/toLocaleDateString(..., { timeZone: "Asia/Shanghai" })` 还原。

**Why:** 招聘者表单用 `type="datetime-local"`，其 `e.target.value` 是不带时区的本地时间字符串（如 `2026-07-28T15:02`）。若原样入库，日历页 `new Date(str)` 在 SSR 环境按 UTC 解析，再 `+8` 转北京时间导致偏移 8 小时（15:02 显示为 23:02）。

**How to apply:**
- 提交面试时间前用 [`beijingLocalToUtcISO()`](src/lib/utils.ts) 转换（已应用于 interviews-management.tsx 的 schedule/reschedule 与 applications/page.tsx 的 schedule 三处提交点）。
- datetime-local 回填时用 [`utcToBeijingLocalInput()`](src/lib/utils.ts)。
- 历史遗留数据：修复前已存的面试记录是本地时间当 UTC 存的，仍会偏移 8 小时，如需修正需写一次性迁移脚本对旧记录 -8h。
- 轮次显示：候选人日历/消息、招聘者+面试官流程管理均按 application 内非取消面试的 scheduled_at 升序编号（首轮/第N轮）。相关 API：candidate/interviews、recruiter/interviewer-tasks、recruiter/interviews(GET 对 interviewMap 排序)。