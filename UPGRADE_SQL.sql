-- 研学库 多用户升级 SQL（第二步：建表。第一步先单独跑 DROP TABLE IF EXISTS app_state CASCADE;）

CREATE TABLE app_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT DEFAULT '考研人',
  avatar_color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now()
);

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

ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own" ON app_state FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_write" ON profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 排行榜视图：不暴露 user_id，直接在数据库层聚合学习时长，减少客户端解析开销
-- minutes 用正则校验后再 ::int，防御历史脏数据（非数字字符串）导致视图查询报错
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.display_name,
  p.avatar_color,
  COALESCE(
    (SELECT SUM(CASE WHEN x->>'minutes' ~ '^[0-9]+$' THEN (x->>'minutes')::int ELSE 0 END)
     FROM jsonb_array_elements(a.data->'studyLog') AS x),
    0
  ) AS total_minutes
FROM profiles p
LEFT JOIN app_state a ON a.user_id = p.user_id;
