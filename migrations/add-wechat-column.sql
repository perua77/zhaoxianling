-- 为 applications 表新增微信号字段（分步迁移，避免历史数据违反 NOT NULL 约束）

-- 步骤 1：先以可空方式新增字段（历史行该列为 NULL，不影响已有查询）
ALTER TABLE applications ADD COLUMN IF NOT EXISTS wechat TEXT;

-- 步骤 2：为历史数据回填占位值（如无历史数据可跳过）
UPDATE applications SET wechat = '未填写' WHERE wechat IS NULL;

-- 步骤 3：待新前端全量上线、确认新投递均带微信号后，再收紧为 NOT NULL
-- （如需保留历史行的宽松策略，可不执行此步）
-- ALTER TABLE applications ALTER COLUMN wechat SET NOT NULL;