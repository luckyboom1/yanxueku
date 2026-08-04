-- 研学库 多用户升级 SQL（重建表版）
-- Supabase SQL Editor: https://gwihiemggugzwhutsfea.supabase.co/project/default/sql/new
-- 还需要: Authentication → Providers → Email 开启

-- 1. 彻底删除旧表重建
DROP TABLE IF EXISTS app_state CASCADE;
CREATE TABLE app_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 用户资料表
DROP TABLE IF EXISTS profiles CASCADE;
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT DEFAULT '考研人',
  avatar_color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 新建用户自动创建 profile
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

-- 4. RLS
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own" ON app_state FOR ALL USING (auth.uid() = user_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_write" ON profiles FOR ALL USING (auth.uid() = user_id);

-- 5. 排行榜
CREATE OR REPLACE VIEW leaderboard AS
SELECT p.display_name, p.avatar_color, COALESCE((a.data->'studyLog')::jsonb, '[]'::jsonb) AS study_log, a.user_id
FROM profiles p LEFT JOIN app_state a ON a.user_id = p.user_id;
