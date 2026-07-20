-- 创建函数：在用户注册后自动设置角色
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    -- 检查用户邮箱是否为手机号格式（以 @zhaoxianling.cn 结尾）
    IF NEW.email LIKE '%@zhaoxianling.cn' THEN
      -- 候选人：自动设置为 candidate 角色
      INSERT INTO public.profiles (id, roles, full_name, phone)
      VALUES (
        NEW.id,
        ARRAY['candidate']::text[],
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', '')
      )
      ON CONFLICT (id) DO UPDATE SET
        roles = ARRAY['candidate']::text[],
        full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', profiles.full_name),
        phone = COALESCE(NEW.raw_user_meta_data->>'phone', profiles.phone);
    ELSE
      -- 管理端用户（邮箱注册）：不自动分配角色，由管理员手动设置
      INSERT INTO public.profiles (id, roles, full_name)
      VALUES (
        NEW.id,
        ARRAY[]::text[],
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- 如果插入失败（表不存在、权限问题等），记录错误但不阻止注册
    RAISE NOTICE 'handle_new_user failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器：在 auth.users 表插入时触发
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 创建函数：防止候选人修改自己的角色为管理员
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    -- 如果用户原本只有 candidate 角色，不允许添加其他角色
    IF OLD.roles = ARRAY['candidate']::text[] THEN
      NEW.roles = ARRAY['candidate']::text[];
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'prevent_role_escalation failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器：在 profiles 表更新时检查角色升级
DROP TRIGGER IF EXISTS on_profile_update_prevent_escalation ON public.profiles;
CREATE TRIGGER on_profile_update_prevent_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- 创建函数：为管理员提供手动设置角色的功能
CREATE OR REPLACE FUNCTION public.set_user_role(user_id UUID, new_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.profiles
  SET roles = ARRAY[new_role]::text[]
  WHERE id = user_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建函数：为管理员提供批量设置角色的功能
CREATE OR REPLACE FUNCTION public.set_user_roles(user_id UUID, new_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.profiles
  SET roles = new_roles
  WHERE id = user_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;