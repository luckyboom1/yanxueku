/**
 * 研学库运行时配置
 *
 * 说明：GitHub Pages 为纯静态托管（文件仅来自 git 仓库），
 * 因此本文件随仓库提交以保证线上可用。
 * 注意：anon key 与 Turnstile Site Key 均为"公开凭据"
 * （前端每次请求都会携带 anon key），提交无安全风险；
 * 真正的敏感凭据（service_role / Turnstile secret）绝不出现在前端。
 */
window.__YANXUEKU_CONFIG__ = {
  SUPABASE_URL: 'https://gwihiemggugzwhutsfea.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3aWhpZW1nZ3VnendodXRzZmVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTMyODksImV4cCI6MjEwMTQyOTI4OX0.UcE502jd3DINEHwxmOgDXsGR3kQ3YYda48v5myCAHA4',

  // Cloudflare Turnstile Site Key（仅注册时使用，留空则关闭人机验证）
  TURNSTILE_SITE_KEY: '0x4AAAAAAEGrawQkO7430Qen'
};
