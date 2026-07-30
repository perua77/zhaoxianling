- [登录会话 cookie 必须用 @supabase/ssr 写入](project_auth_cookie.md) — 招贤令登录后跳转被 middleware 拦回登录页的根因与约束

- [recruiter 区域白屏——cookie/localStorage 登录态双源不同步](project_auth_guard_race.md) — 招贤令 recruiter 冷启动白屏根因——middleware 认 cookie 已登录放行，但客户端 zustand 只读 localStorage 认为未登录

- [面试时间时区存储约定](project_interview_timezone.md) — 招贤令面试 scheduled_at 存储/展示时区约定——datetime-local 需转 UTC 入库，展示统一 Asia/Shanghai

- [trial_status 数据库枚举合法值](project_trial_status_enum.md) — 招贤令 trials 表 trial_status 枚举的权威合法值及与应用状态语义的映射约定

- [interviews表无round列（轮次为虚拟概念）](project_interviews_schema.md) — 招贤令 interviews 表没有 round 列，面试轮次是运行时动态计算的虚拟概念，切勿 insert/select round

- [trials表无scheduled_at列（时间字段是start_date/end_date）](project_trials_schema.md) — 招贤令 trials 表没有 scheduled_at 列，排序/读写须用 start_date，误用会导致 PostgREST 静默失败使试岗数据整体丢失
