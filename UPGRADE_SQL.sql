-- 研学库 多用户升级 SQL
-- 在 Supabase SQL Editor 中执行：https://gwihiemggugzwhutsfea.supabase.co/project/default/sql/new
-- 另外需要在 Authentication → Providers 中开启 Email 登录

-- 1. 改造 app_state 支持多用户
ALTER TABLE app_state DROP CONSTRAINT IF EXISTS app_state_pkey;
ALTER TABLE app_state ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT NULL;
-- 将现有的公共数据迁移给第一个用户（如果有的话）
UPDATE app_state SET user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1) WHERE user_id IS NULL;
ALTER TABLE app_state ADD PRIMARY KEY (user_id);

-- 2. 用户资料表
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT DEFAULT '考研人',
  avatar_color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 新建用户时自动创建 profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', '考研人'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. 更新 RLS 策略
DROP POLICY IF EXISTS "allow_all" ON app_state;
CREATE POLICY "user_own_app_state" ON app_state
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_readable" ON profiles;
CREATE POLICY "profiles_readable" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_own_writable" ON profiles;
CREATE POLICY "profiles_own_writable" ON profiles FOR ALL USING (auth.uid() = user_id);

-- 4. 全文搜索（对知识库标题和内容）
CREATE INDEX IF NOT EXISTS idx_app_state_gin ON app_state USING GIN ((data) jsonb_path_ops);

-- 5. 排行榜视图
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.display_name,
  p.avatar_color,
  COALESCE((a.data->'studyLog')::jsonb, '[]'::jsonb) AS study_log,
  a.user_id
FROM profiles p
LEFT JOIN app_state a ON a.user_id = p.user_id;
