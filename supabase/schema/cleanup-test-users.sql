-- 清理旧测试用户脚本
-- 注意：此脚本会删除数据，请谨慎执行

-- 1. 查询所有用户，确认要删除的用户
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- 2. 删除不是手机号注册的测试用户（邮箱注册的测试用户）
-- DELETE FROM auth.users 
-- WHERE email NOT LIKE '%@zhaoxianling.cn'
-- AND created_at < NOW() - INTERVAL '1 day';

-- 3. 删除对应的 profiles 记录
-- DELETE FROM public.profiles
-- WHERE id IN (
--   SELECT id FROM auth.users 
--   WHERE email NOT LIKE '%@zhaoxianling.cn'
--   AND created_at < NOW() - INTERVAL '1 day'
-- );

-- 4. 删除对应的 applications 记录
-- DELETE FROM public.applications
-- WHERE candidate_id IN (
--   SELECT id FROM auth.users 
--   WHERE email NOT LIKE '%@zhaoxianling.cn'
--   AND created_at < NOW() - INTERVAL '1 day'
-- );

-- 5. 验证删除结果
-- SELECT COUNT(*) FROM auth.users;
-- SELECT COUNT(*) FROM public.profiles;