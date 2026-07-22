-- 添加 interviews 表缺失的列
ALTER TABLE interviews 
ADD COLUMN IF NOT EXISTS contact_person TEXT;

ALTER TABLE interviews 
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

ALTER TABLE interviews 
ADD COLUMN IF NOT EXISTS result TEXT;