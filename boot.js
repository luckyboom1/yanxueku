/* boot.js — 启动引导（原 index.html 三段内联脚本外置，为 CSP 移除 unsafe-inline 服务）
 * 加载顺序：config.js → boot.js → 其余业务脚本（全部 defer，按序执行） */

// 框架逃逸：被 iframe 嵌套时跳出（点击劫持防护）
try{ if(window.top!==window.self){ document.documentElement.style.display="none"; window.top.location=window.self.location; } }catch(e){}

// 版本跳变检测：每次发布 bump __APP_VERSION，旧版本自动强制刷新
var __APP_VERSION = "3.0.0-beta.25";
(function(){
  var __sv = localStorage.getItem('yanxueku_ver');
  if(__sv && __sv !== __APP_VERSION){
    // 旧版本用户：清除 SW 缓存 → 硬刷新
    if('serviceWorker' in navigator){
      navigator.serviceWorker.getRegistrations().then(function(regs){
        regs.forEach(function(r){ r.unregister(); });
        localStorage.setItem('yanxueku_ver', __APP_VERSION);
        location.reload(true);
      });
    }else{
      localStorage.setItem('yanxueku_ver', __APP_VERSION);
      location.reload(true);
    }
  }else{
    localStorage.setItem('yanxueku_ver', __APP_VERSION);
  }
})();

// gate.css 非阻塞加载（media-swap）：原 onload 属性随 unsafe-inline 一起移除，
// 改由这里挂监听——登录墙样式加载完成后切回 all
(function(){
  var g = document.getElementById('gate-css');
  if(!g) return;
  g.addEventListener('load', function(){ g.media = 'all'; });
})();
