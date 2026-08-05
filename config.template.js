/**
 * 研学库运行时配置模板
 *
 * 复制本文件为 config.js，填入你的真实配置后部署。
 * config.js 已被 .gitignore 忽略，不会被提交到仓库。
 */
window.__YANXUEKU_CONFIG__ = {
  // Supabase 项目配置
  // 请勿在公开仓库中提交真实的 anon key。如需轮换 key，请前往 Supabase Dashboard。
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_KEY: 'your-anon-key',

  // Cloudflare Turnstile Site Key（仅注册时使用）
  // 如不需要人机验证，可留空字符串 ''
  TURNSTILE_SITE_KEY: ''
};
